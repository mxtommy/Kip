import { ActionResult, Path, Plugin, ServerAPI, SKVersion } from '@signalk/server-api'
import { Request, Response, NextFunction } from 'express'
import * as openapi from './openApi.json';
import { HistorySeriesService, IHistoryQueryParams, IHistoryValuesResponse, ISeriesDefinition, THistoryMethod } from './history-series.service';
import { SqliteHistoryStorageService } from './sqlite-history-storage.service';
import { HistoryApi, ValuesRequest, ValuesResponse, PathsRequest, PathsResponse, ContextsRequest, ContextsResponse } from '@signalk/server-api/history';

type TSqliteModule = { DatabaseSync?: unknown; Database?: unknown } | null;
type TGetSqliteModule = () => Promise<TSqliteModule>;

async function defaultGetSqliteModule(): Promise<TSqliteModule> {
  try {
    return await import('node:sqlite') as { DatabaseSync?: unknown; Database?: unknown } | null;
  } catch {
    return null;
  }
}

const start = (server: ServerAPI): Plugin => {
  const mutableOpenApi = JSON.parse(JSON.stringify((openapi as { default?: unknown }).default ?? openapi));
  const API_PATHS = {
    DISPLAYS: `/displays`,
    INSTANCE: `/displays/:displayId`,
    SCREEN_INDEX: `/displays/:displayId/screenIndex`,
    ACTIVATE_SCREEN: `/displays/:displayId/activeScreen`,
    SERIES: '/series',
    SERIES_INSTANCE: '/series/:seriesId',
    SERIES_RECONCILE: '/series/reconcile',

  } as const;
  const PUT_CONTEXT = 'vessels.self';
  const COMMAND_PATHS = {
    SET_DISPLAY: 'kip.remote.setDisplay',
    SET_SCREEN_INDEX: 'kip.remote.setScreenIndex',
    REQUEST_ACTIVE_SCREEN: 'kip.remote.requestActiveScreen'
  } as const;
  const CONFIG_SCHEMA = {
    type: 'object',
    title: 'Remote Control and Data Series',
    description: 'NOTE: All plugin settings are also managed from within KIP\'s Display Options panel. Changes made here will be overridden when KIP applies settings from the Display Options.',
    properties: {
      nodeSqliteAvailable: {
        type: 'boolean',
        title: 'node:sqlite Available',
        description: 'Indicates if node:sqlite is available in the current runtime (requires Node.js version 22.5.0 or newer). This is set automatically and is read-only.\n\nBefore upgrading Node.js, always verify compatibility with your Signal K server version at https://demo.signalk.org/documentation.',
        readOnly: true
      },
      historySeriesServiceEnabled: {
        type: 'boolean',
        title: 'Enable Automatic Historical Time-Series Capture and Management',
        description: 'Historical Time-Series are data captures that supply the widget historical data and seed the Data Chart and Wind Trends widgets. If disabled, data capture must be configured in your chosen history provider plugin.',
        default: true
      },
      registerAsHistoryApiProvider: {
        type: 'boolean',
        title: 'Enable Query Provider',
        description: 'The built-in History-API query provider is a feature that enables the plugin to respond to History-API requests. If you want to use another History-API provider, disable this option and configure your chosen History-API compatible provider accordingly and KIP will query that provider.',
        default: true
      }
    }
  };
  const historySeries = new HistorySeriesService(() => Date.now());
  const storageService = new SqliteHistoryStorageService();
  let retentionSweepTimer: NodeJS.Timeout | null = null;
  let storageFlushTimer: NodeJS.Timeout | null = null;
  let sqliteInitializationPromise: Promise<boolean> | null = null;
  const SQLITE_INIT_WAIT_TIMEOUT_MS = 5000;
  const MIN_NODE_SQLITE_VERSION = '22.5.0';
  let streamUnsubscribes: (() => void)[] = [];
  let historyApiProviderRegistered = false;
  let runtimeSqliteUnavailableMessage: string | null = null;

  interface IHistoryModeConfig {
    historySeriesServiceEnabled: boolean;
    registerAsHistoryApiProvider: boolean;
    nodeSqliteAvailable: boolean;
  }

  interface IHistoryApiPathSpecLike {
    path?: unknown;
    aggregate?: unknown;
    parameter?: unknown;
  }

  interface IHistoryApiValuesRequestLike {
    context?: unknown;
    resolution?: unknown;
    from?: unknown;
    to?: unknown;
    duration?: unknown;
    pathSpecs?: unknown;
  }

  interface IHistoryApiRangeRequestLike {
    from?: unknown;
    to?: unknown;
    duration?: unknown;
  }

  interface IHistoryRangeQuery {
    from?: string;
    to?: string;
    duration?: string | number;
  }

  function logRuntimeDependencyVersions(): void {
    const nodeIdentity = `node@${process.version}`;
    const sqliteAvailability = modeConfig && modeConfig.nodeSqliteAvailable ? 'available' : 'unavailable';
    server.debug(`[KIP][RUNTIME] ${nodeIdentity} node:sqlite=${sqliteAvailability}`);
  }

  async function detectSqliteRuntime(): Promise<boolean> {
    const exportedStart = start as typeof start & { getSqliteModule?: TGetSqliteModule };
    const resolveSqliteModule = typeof exportedStart.getSqliteModule === 'function'
      ? exportedStart.getSqliteModule
      : defaultGetSqliteModule;
    const sqliteModule = await resolveSqliteModule();
    if (!sqliteModule) {
      runtimeSqliteUnavailableMessage = `node:sqlite requires Node ${MIN_NODE_SQLITE_VERSION}+`;
      return false;
    }

    if (!sqliteModule.DatabaseSync && !sqliteModule.Database) {
      runtimeSqliteUnavailableMessage = 'node:sqlite module missing required exports';
      return false;
    }

    runtimeSqliteUnavailableMessage = null;
    return true;
  }

  function getSqliteUnavailableMessage(): string {
    if (!(modeConfig && modeConfig.nodeSqliteAvailable)) {
      return `node:sqlite is not supported in the installed Node.js runtime. Node ${MIN_NODE_SQLITE_VERSION}+ is required.`;
    }

    const details = storageService.getLastInitError();
    return details
      ? `node:sqlite storage unavailable: ${details}`
      : 'node:sqlite storage unavailable';
  }

  function isSqliteUnavailable(): boolean {
    return !(modeConfig && modeConfig.nodeSqliteAvailable) || Boolean(storageService.getLastInitError());
  }

  function resolveHistoryModeConfig(settings: unknown): IHistoryModeConfig {
    const root = (settings && typeof settings === 'object' ? settings : {}) as Record<string, unknown>;

    const historySeriesServiceEnabledSetting =
      typeof root.historySeriesServiceEnabled === 'boolean'
        ? root.historySeriesServiceEnabled
        : undefined;

    const registerAsHistoryApiProviderSetting =
      typeof root.registerAsHistoryApiProvider === 'boolean'
        ? root.registerAsHistoryApiProvider
        : undefined;

    const nodeSqliteAvailable =
      typeof root.nodeSqliteAvailable === 'boolean'
        ? root.nodeSqliteAvailable
        : undefined;

    return {
      historySeriesServiceEnabled: historySeriesServiceEnabledSetting !== false,
      registerAsHistoryApiProvider: registerAsHistoryApiProviderSetting !== false,
      nodeSqliteAvailable: nodeSqliteAvailable !== false
    };
  }

  function getDisplaySelfPath(displayId: string, suffix?: string): object | undefined {
    const tail = suffix ? `.${suffix}` : ''
    const want = `displays.${displayId}${tail}`
    const full = server.getSelfPath(want)
    server.debug(`[KIP][SELF_PATH] displayId=${displayId} suffix=${String(suffix ?? '')} requested=${want} resolved=${JSON.stringify(full)}`)
    return typeof full === 'object' && full !== null ? full : undefined;
  }

  function getAvailableDisplays(): object | undefined {
    const fullPath = server.getSelfPath('displays') ;
    server.debug(`[KIP][DISPLAYS] resolved=${JSON.stringify(fullPath)}`);
    return typeof fullPath === 'object' && fullPath !== null ? fullPath : undefined;
  }

  function sendOk(res: Response, body?: unknown) {
    if (body === undefined) return res.status(204).end()
    return res.status(200).json(body)
  }

  function sendFail(res: Response, statusCode: number, message: string) {
    return res.status(statusCode).json({ state: 'FAILED', statusCode, message })
  }

  function getHistorySeriesServiceDisabledMessage(): string {
    return 'KIP history-series service is disabled by plugin configuration';
  }

  async function waitForSqliteInitialization(timeoutMs = SQLITE_INIT_WAIT_TIMEOUT_MS): Promise<boolean> {
    if (!sqliteInitializationPromise) {
      return storageService.isSqliteReady();
    }

    try {
      const ready = await Promise.race<boolean>([
        sqliteInitializationPromise,
        new Promise<boolean>(resolvePromise => {
          setTimeout(() => resolvePromise(false), timeoutMs);
        })
      ]);

      if (!ready && !storageService.isSqliteReady()) {
        server.error(`[SERIES STORAGE] node:sqlite initialization wait timed out after ${timeoutMs}ms`);
      }

      return ready;
    } catch {
      return false;
    }
  }

  function getRouteError(error: unknown, fallbackMessage: string): { statusCode: number; message: string } {
    const message = String((error as Error)?.message || fallbackMessage);
    const normalized = message.toLowerCase();

    if (
      normalized.includes('invalid ')
      || normalized.includes('missing ')
      || normalized.includes('body must')
      || normalized.includes('required')
      || normalized.includes('expected an iso')
    ) {
      return { statusCode: 400, message };
    }

    if (
      normalized.includes('sqlite')
      || normalized.includes('storage unavailable')
      || normalized.includes('not initialized')
      || isSqliteUnavailable()
    ) {
      return { statusCode: 503, message };
    }

    return { statusCode: 500, message };
  }

  function findSeriesById(seriesId: string): ISeriesDefinition | null {
    const current = historySeries.findSeriesById(seriesId);
    return current ? JSON.parse(JSON.stringify(current)) as ISeriesDefinition : null;
  }

  function isHistorySeriesServiceEnabled(): boolean {
    return !!(modeConfig && modeConfig.historySeriesServiceEnabled && modeConfig.nodeSqliteAvailable);
  }

  function isHistoryApiProviderEnabled(): boolean {
    return !!(modeConfig && modeConfig.registerAsHistoryApiProvider && modeConfig.nodeSqliteAvailable);
  }

  function logOperationalMode(stage: string): void {
    server.debug(
      `[HISTORY MODE] stage=${stage} historySeriesServiceEnabled=${isHistorySeriesServiceEnabled()} historyApiProviderEnabled=${isHistoryApiProviderEnabled()} historyApiProviderRegistered=${historyApiProviderRegistered}`
    );
  }

  async function ensureSqliteReadyForRequest(res: Response): Promise<boolean> {
    await waitForSqliteInitialization();
    if (storageService.isSqliteReady()) {
      return true;
    }
    sendFail(res, 503, getSqliteUnavailableMessage());
    return false;
  }

  function ensureHistorySeriesServiceEnabledForRequest(res: Response): boolean {
    if (!(modeConfig && modeConfig.nodeSqliteAvailable)) {
      sendFail(res, 503, getSqliteUnavailableMessage());
      return false;
    }
    if (isHistorySeriesServiceEnabled()) {
      return true;
    }

    sendFail(res, 503, getHistorySeriesServiceDisabledMessage());
    return false;
  }

  function logAuthTrace(req: Request, stage: string) {
    const hasAuthorizationHeader = typeof req.headers.authorization === 'string' && req.headers.authorization.length > 0;
    const hasCookieHeader = typeof req.headers.cookie === 'string' && req.headers.cookie.length > 0;
    const origin = req.headers.origin ?? null;
    const userAgent = req.headers['user-agent'] ?? null;
    const contentType = req.headers['content-type'] ?? null;

    server.debug(
      `[AUTH TRACE] stage=${stage} method=${req.method} path=${req.path} ip=${req.ip} origin=${String(origin)} authHeader=${hasAuthorizationHeader} cookieHeader=${hasCookieHeader} contentType=${String(contentType)} userAgent=${String(userAgent)}`
    );
  }

  function completed(statusCode: number, message?: string): ActionResult {
    return { state: 'COMPLETED', statusCode, message };
  }

  function isValidDisplayId(displayId: unknown): displayId is string {
    return typeof displayId === 'string' && /^[A-Za-z0-9-]+$/.test(displayId);
  }

  function applyDisplayWrite(displayId: string, suffix: 'screenIndex' | 'activeScreen' | null, value: string | number | boolean | object | null): ActionResult {
    const path = suffix ? `displays.${displayId}.${suffix}` : `displays.${displayId}`;
    server.debug(`[KIP][WRITE] applyDisplayWrite path=${path} value=${JSON.stringify(value)}`);
    try {
      server.handleMessage(
        plugin.id,
        {
          updates: [
            {
              values: [
                {
                  path: path as Path,
                  value: value ?? null
                }
              ]
            }
          ]
        },
        SKVersion.v1
      );
      server.debug(`[KIP][WRITE] handleMessage success path=${path}`);
      return completed(200);
    } catch (error) {
      const message = (error as Error)?.message ?? 'Unable to write display path';
      server.error(`[WRITE TRACE] handleMessage failure path=${path} message=${message}`);
      return completed(400, message);
    }
  }

  function handleSetDisplay(value: unknown): ActionResult {
    server.debug(`[KIP][COMMAND] handleSetDisplay payload=${JSON.stringify(value)}`);
    const command = value as { displayId?: unknown; display?: unknown } | null;
    if (!command || typeof command !== 'object') {
      return completed(400, 'Command payload is required');
    }

    if (!isValidDisplayId(command.displayId)) {
      return completed(400, 'Invalid displayId format');
    }

    const displayValue = command.display ?? null;
    if (displayValue !== null && typeof displayValue !== 'object') {
      return completed(400, 'display must be an object or null');
    }

    return applyDisplayWrite(command.displayId, null, displayValue as object | null);
  }

  function handleScreenWrite(value: unknown, suffix: 'screenIndex' | 'activeScreen'): ActionResult {
    server.debug(`[KIP][COMMAND] handleScreenWrite suffix=${suffix} payload=${JSON.stringify(value)}`);
    const command = value as { displayId?: unknown; screenIdx?: unknown } | null;
    if (!command || typeof command !== 'object') {
      return completed(400, 'Command payload is required');
    }

    if (!isValidDisplayId(command.displayId)) {
      return completed(400, 'Invalid displayId format');
    }

    const screenIdxValue = command.screenIdx ?? null;
    if (screenIdxValue !== null && typeof screenIdxValue !== 'number') {
      return completed(400, 'screenIdx must be a number or null');
    }

    return applyDisplayWrite(command.displayId, suffix, screenIdxValue as number | null);
  }

  function sendActionAsRest(res: Response, result: ActionResult) {
    server.debug(`[KIP][REST] sendActionAsRest statusCode=${result.statusCode} message=${result.message ?? ''}`);
    if (result.statusCode === 200) {
      return res.status(200).json({ state: 'SUCCESS', statusCode: 200 });
    }
    return sendFail(res, result.statusCode || 400, result.message || 'Command failed');
  }

  function stopSeriesCapture(): void {
    streamUnsubscribes.forEach(unsub => {
      try {
        unsub();
      } catch {
        // ignore unsubscribe failures
      }
    });
    streamUnsubscribes = [];
  }

  function toIsoString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value && typeof value === 'object' && typeof (value as { toString?: () => string }).toString === 'function') {
      const serialized = (value as { toString: () => string }).toString();
      return serialized && serialized !== '[object Object]' ? serialized : undefined;
    }

    return undefined;
  }

  function toDurationString(value: unknown): string | number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    if (value && typeof value === 'object' && typeof (value as { toString?: () => string }).toString === 'function') {
      const serialized = (value as { toString: () => string }).toString();
      return serialized && serialized !== '[object Object]' ? serialized : undefined;
    }

    return undefined;
  }

  function normalizeHistoryMethod(method: unknown): THistoryMethod {
    const raw = String(method ?? 'avg').trim().toLowerCase();
    if (raw === 'average') {
      return 'avg';
    }
    if (raw === 'min' || raw === 'max' || raw === 'sma' || raw === 'ema' || raw === 'avg') {
      return raw;
    }
    return 'avg';
  }

  function normalizeHistoryPath(path: unknown): string {
    const trimmed = typeof path === 'string' ? path.trim() : '';
    if (!trimmed) {
      return '';
    }

    if (trimmed.startsWith('vessels.self.')) {
      return trimmed.slice('vessels.self.'.length);
    }

    if (trimmed.startsWith('self.')) {
      return trimmed.slice('self.'.length);
    }

    return trimmed;
  }

  function buildPathsFromPathSpecs(pathSpecs: unknown): string {
    if (!Array.isArray(pathSpecs)) {
      return '';
    }

    const specs = pathSpecs as IHistoryApiPathSpecLike[];
    const encoded = specs
      .map(spec => {
        const path = normalizeHistoryPath(spec.path);
        if (!path) {
          return '';
        }
        const method = normalizeHistoryMethod(spec.aggregate);
        const params = Array.isArray(spec.parameter)
          ? (spec.parameter as unknown[]).map(item => String(item).trim()).filter(Boolean)
          : [];
        return [path, method, ...params].join(':');
      })
      .filter(Boolean);

    return encoded.join(',');
  }

  function buildHistoryQueryFromValuesRequest(query: IHistoryApiValuesRequestLike): IHistoryQueryParams {
    const from = toIsoString(query?.from);
    const to = toIsoString(query?.to);
    const duration = toDurationString(query?.duration);
    const paths = buildPathsFromPathSpecs(query?.pathSpecs);

    return {
      paths,
      context: typeof query?.context === 'string' ? query.context : undefined,
      from,
      to,
      duration,
      resolution: typeof query?.resolution === 'number' || typeof query?.resolution === 'string' ? query.resolution : undefined
    };
  }

  function buildHistoryQueryFromRangeRequest(query: IHistoryApiRangeRequestLike): IHistoryRangeQuery {
    return {
      from: toIsoString(query?.from),
      to: toIsoString(query?.to),
      duration: toDurationString(query?.duration)
    };
  }

  async function resolveHistoryPaths(query?: IHistoryRangeQuery): Promise<string[]> {
    await waitForSqliteInitialization();
    if (!storageService.isSqliteReady()) {
      throw new Error(getSqliteUnavailableMessage());
    }

    try {
      await storageService.flush();
    } catch (flushError) {
      server.error(`[SERIES STORAGE] pre-paths flush failed: ${String((flushError as Error).message || flushError)}`);
    }
    return storageService.getStoredPaths({
      ...(query ?? {})
    });
  }

  async function resolveHistoryContexts(query?: IHistoryRangeQuery): Promise<string[]> {
    await waitForSqliteInitialization();
    if (!storageService.isSqliteReady()) {
      throw new Error(getSqliteUnavailableMessage());
    }

    try {
      await storageService.flush();
    } catch (flushError) {
      server.error(`[SERIES STORAGE] pre-contexts flush failed: ${String((flushError as Error).message || flushError)}`);
    }
    return storageService.getStoredContexts({
      ...(query ?? {})
    });
  }

  async function resolveHistoryValues(query: IHistoryQueryParams): Promise<IHistoryValuesResponse> {
    await waitForSqliteInitialization();
    if (!storageService.isSqliteReady()) {
      throw new Error(getSqliteUnavailableMessage());
    }

    try {
      await storageService.flush();
    } catch (flushError) {
      server.error(`[SERIES STORAGE] pre-query flush failed: ${String((flushError as Error).message || flushError)}`);
    }
    const values = await storageService.getValues({
      ...query
    });
    if (!values) {
      throw new Error('node:sqlite storage did not return history values.');
    }
    return values;
  }

  function registerHistoryProvider(): void {
    historyApiProviderRegistered = false;

    if (!isHistoryApiProviderEnabled()) {
      server.debug('[KIP][HISTORY_PROVIDER] registration skipped reason=config-disabled');
      return;
    }

    const serverWithHistoryApi = server as ServerAPI & {
      registerHistoryApiProvider?: (provider: HistoryApi) => void;
      unregisterHistoryApiProvider?: () => void;
      history?: {
        registerHistoryApiProvider?: (provider: HistoryApi) => void;
        unregisterHistoryApiProvider?: () => void;
      };
    };
    const registerHistoryApiProvider =
      typeof serverWithHistoryApi.registerHistoryApiProvider === 'function'
        ? serverWithHistoryApi.registerHistoryApiProvider.bind(serverWithHistoryApi)
        : (typeof serverWithHistoryApi.history?.registerHistoryApiProvider === 'function'
            ? serverWithHistoryApi.history.registerHistoryApiProvider.bind(serverWithHistoryApi.history)
            : null);

    // guard when running in SK variants that do not support History API registration
    if (!registerHistoryApiProvider) {
      server.debug('[KIP][HISTORY_PROVIDER] registration skipped reason=api-unavailable');
      return;
    }

    const apiProvider: HistoryApi = {
      getValues: async (query: ValuesRequest): Promise<ValuesResponse> => {
        const resolved = await resolveHistoryValues(buildHistoryQueryFromValuesRequest(query));
        return {
          ...resolved,
          values: resolved.values.map(valueSpec => ({
            path: valueSpec.path,
            method: valueSpec.method === 'avg' ? 'average' : valueSpec.method
          }))
        } as ValuesResponse;
      },
      getPaths: (query: PathsRequest): Promise<PathsResponse> =>
        resolveHistoryPaths(buildHistoryQueryFromRangeRequest(query)) as Promise<PathsResponse>,
      getContexts: (query: ContextsRequest): Promise<ContextsResponse> =>
        resolveHistoryContexts(buildHistoryQueryFromRangeRequest(query)) as Promise<ContextsResponse>
    };

    registerHistoryApiProvider(apiProvider);
    historyApiProviderRegistered = true;
    server.debug('[KIP][HISTORY_PROVIDER] registration success provider=kip');
  }

  function rebuildSeriesCaptureSubscriptions(): void {
    stopSeriesCapture();

    if (!isHistorySeriesServiceEnabled()) {
      return;
    }

    const streamBundle = server.streambundle;
    if (!streamBundle || typeof streamBundle.getBus !== 'function') {
      // server.debug('[SERIES CAPTURE] streambundle.getBus not available; capture disabled');
      return;
    }

    const subscriptionCandidates = new Map<string, { allSelfContext: boolean }>();

    const addCandidate = (path: string, allSelfContext: boolean): void => {
      const normalized = typeof path === 'string' ? path.trim() : '';
      if (!normalized) {
        return;
      }

      const existing = subscriptionCandidates.get(normalized);
      if (!existing) {
        subscriptionCandidates.set(normalized, { allSelfContext });
        return;
      }

      // If any series for this path requires non-self context, force generic bus subscription.
      existing.allSelfContext = existing.allSelfContext && allSelfContext;
    };

    historySeries.listSeries().filter(series => series.enabled !== false).forEach(series => {
      const allSelfContext = (series.context ?? 'vessels.self') === 'vessels.self';
      addCandidate(series.path, allSelfContext);

      // Workaround: subscribe to immediate parent path so object deltas (e.g. navigation.attitude)
      // are captured and flattened into leaf numeric paths (e.g. navigation.attitude.pitch).
      // Remove this fallback when KIP adds first-class object-path capture support.
      const parentIdx = series.path.lastIndexOf('.');
      if (parentIdx > 0) {
        addCandidate(series.path.slice(0, parentIdx), allSelfContext);
      }
    });

    const candidates = Array.from(subscriptionCandidates.entries()).map(([path, meta]) => ({
      path,
      allSelfContext: meta.allSelfContext
    }));

    candidates.forEach(candidate => {
      try {
        const bus = candidate.allSelfContext && typeof (streamBundle as { getSelfBus?: unknown }).getSelfBus === 'function'
          ? (streamBundle as { getSelfBus: (p: Path) => unknown }).getSelfBus(candidate.path as Path)
          : streamBundle.getBus(candidate.path as Path);
        if (!bus || typeof (bus as { onValue?: unknown }).onValue !== 'function') {
          return;
        }

        const unsubscribe = (bus as { onValue: (cb: (value: unknown) => void) => (() => void) | void }).onValue((sample: unknown) => {
          try {
            const count = historySeries.recordFromSignalKSample(sample as { path?: unknown; value?: unknown; timestamp?: unknown; context?: unknown; source?: unknown; $source?: unknown });
            if (count > 0) {
              // server.debug(`[SERIES CAPTURE] path=${candidate.path} recorded=${count}`);
            }
          } catch (error) {
            server.error(`[SERIES CAPTURE] failed to record sample path=${candidate.path}: ${String((error as Error).message || error)}`);
          }
        });

        if (typeof unsubscribe === 'function') {
          streamUnsubscribes.push(unsubscribe);
        }
      } catch (error) {
        server.error(`[SERIES CAPTURE] failed to subscribe path=${candidate.path}: ${String((error as Error).message || error)}`);
      }
    });

    // server.debug(`[SERIES CAPTURE] activePathSubscriptions=${candidates.length}`);
  }

  function startStorageFlushTimer(intervalMs: number): void {
    if (storageFlushTimer) {
      clearInterval(storageFlushTimer);
      storageFlushTimer = null;
    }

    if (!storageService.isSqliteEnabled()) {
      return;
    }

    storageFlushTimer = setInterval(() => {
      void storageService.flush()
        .catch(error => {
          server.error(`[SERIES STORAGE] flush failed: ${String((error as Error).message || error)}`);
        });
    }, intervalMs);

    storageFlushTimer.unref?.();
  }
  let modeConfig: IHistoryModeConfig | null = null;
  const plugin: Plugin = {
    id: 'kip',
    name: 'KIP',
    description: 'KIP server plugin',
    start: async (settings) => {
      server.debug('[KIP][LIFECYCLE] start');
      modeConfig = resolveHistoryModeConfig(settings);
      // Overwrite runtime-detected properties in modeConfig
      modeConfig.nodeSqliteAvailable = await detectSqliteRuntime();
      if (!modeConfig.nodeSqliteAvailable) {
        server.error(`[KIP][RUNTIME] node:sqlite unavailable. ${runtimeSqliteUnavailableMessage}`);
      }
      const serverWithApp = server as ServerAPI & { app?: { getDataDirPath?: () => string } };
      const dataDirPath = serverWithApp.app?.getDataDirPath?.();
      storageService.setDataDirPath(typeof dataDirPath === 'string' ? dataDirPath : null);
      storageService.setRuntimeAvailability(modeConfig.nodeSqliteAvailable, runtimeSqliteUnavailableMessage ?? undefined);
      logRuntimeDependencyVersions();
      logOperationalMode('start-configured');

      const needsSqlite = (modeConfig.historySeriesServiceEnabled || modeConfig.registerAsHistoryApiProvider) && modeConfig.nodeSqliteAvailable;

      if (needsSqlite) {
        storageService.setLogger({
          debug: (msg: string) => server.debug(msg),
          error: (msg: string) => server.error(msg)
        });
        const storageConfig = storageService.configure();
        server.debug(`[KIP][STORAGE] config engine=${storageConfig.engine} db=${storageConfig.databaseFile} flushMs=${storageConfig.flushIntervalMs}`);
        historySeries.setSampleSink(sample => {
          storageService.enqueueSample(sample);
        });

        sqliteInitializationPromise = storageService.initialize();
        void sqliteInitializationPromise.then((ready) => {
          server.debug(`[KIP][STORAGE] sqliteReady=${ready}`);
          if (ready && storageService.isSqliteEnabled()) {
            if (modeConfig && modeConfig.historySeriesServiceEnabled) {
              void storageService.getSeriesDefinitions()
                .then((storedSeries) => {
                  if (storedSeries.length > 0) {
                    historySeries.reconcileSeries(storedSeries);
                    rebuildSeriesCaptureSubscriptions();
                  }
                  startStorageFlushTimer(storageConfig.flushIntervalMs);
                  logOperationalMode('sqlite-ready');
                  server.setPluginStatus(`Providing: Remote Control${historyApiProviderRegistered ? ', History service' : ', No History service'}${storedSeries.length > 0 ? `, ${storedSeries.length} Time-Series` : ', No Time-Series'}.`);
                })
                .catch((loadError) => {
                  server.error(`[SERIES STORAGE] failed to load persisted series: ${String((loadError as Error).message || loadError)}`);
                  startStorageFlushTimer(storageConfig.flushIntervalMs);
                  logOperationalMode('sqlite-ready-series-load-failed');
                  server.setPluginStatus(`Providing: Remote Control${historyApiProviderRegistered ? ', History service' : ', No History service'}, No Time-Series.`);
                });
            } else {
              historySeries.reconcileSeries([]);
              stopSeriesCapture();
              startStorageFlushTimer(storageConfig.flushIntervalMs);
              logOperationalMode('sqlite-ready-series-disabled');
              server.setPluginStatus(`Providing: Remote Control${historyApiProviderRegistered ? ', History service' : ', No History service'}, No Time-Series.`);
            }
            return;
          }

          if (storageFlushTimer) {
            clearInterval(storageFlushTimer);
            storageFlushTimer = null;
          }

          const initError = storageService.getLastInitError();
          if (initError) {
            server.setPluginError(`node:sqlite unavailable. ${initError}`);
            logOperationalMode('sqlite-unavailable');
            server.setPluginStatus(`Providing: Remote Control${historyApiProviderRegistered ? ', History service' : ', No History service'}, No Time-Series.`);
          }
        });

        if (retentionSweepTimer) {
          clearInterval(retentionSweepTimer);
        }
        retentionSweepTimer = setInterval(() => {
          try {
            if (storageService.isSqliteReady()) {
              const lifecycleToken = storageService.getLifecycleToken();
              void storageService.pruneExpiredSamples(Date.now(), lifecycleToken)
                .then(removedPersistedRows => {
                  if (removedPersistedRows > 0) {
                    server.debug(`[KIP][RETENTION] pruneExpired removedRows=${removedPersistedRows}`);
                  }
                  return storageService.pruneOrphanedSamples(lifecycleToken)
                    .then(removedOrphanRows => {
                      if (removedOrphanRows > 0) {
                        server.debug(`[KIP][RETENTION] pruneOrphaned removedRows=${removedOrphanRows}`);
                      }
                    });
                })
                .catch(error => {
                  server.error(`[SERIES RETENTION] node:sqlite Prune failed: ${String((error as Error).message || error)}`);
                });
            }
          } catch (error) {
            server.error(`[SERIES RETENTION] node:sqlite sweep failed: ${String((error as Error).message || error)}`);
          }
        }, 60 * 60_000);
        retentionSweepTimer.unref?.();
        rebuildSeriesCaptureSubscriptions();
      } else {
        if (modeConfig && !modeConfig.nodeSqliteAvailable && (modeConfig.historySeriesServiceEnabled || modeConfig.registerAsHistoryApiProvider)) {
          server.setPluginStatus(getSqliteUnavailableMessage());
        }
        server.debug('[KIP][STORAGE] sqlite init skipped reason=config-disabled-or-runtime');
        sqliteInitializationPromise = null;
        stopSeriesCapture();
      }

      if (server.registerPutHandler) {
        server.debug(`[KIP][COMMAND] registerPutHandlers context=${PUT_CONTEXT}`);
        server.registerPutHandler(PUT_CONTEXT, COMMAND_PATHS.SET_DISPLAY, (context, path, value) => {
          server.debug(`[KIP][COMMAND] putHandlerHit command=${COMMAND_PATHS.SET_DISPLAY} path=${String(path)} context=${String(context)}`);
          void context;
          void path;
          return handleSetDisplay(value);
        }, plugin.id);

        server.registerPutHandler(PUT_CONTEXT, COMMAND_PATHS.SET_SCREEN_INDEX, (context, path, value) => {
          server.debug(`[KIP][COMMAND] putHandlerHit command=${COMMAND_PATHS.SET_SCREEN_INDEX} path=${String(path)} context=${String(context)}`);
          void context;
          void path;
          return handleScreenWrite(value, 'screenIndex');
        }, plugin.id);

        server.registerPutHandler(PUT_CONTEXT, COMMAND_PATHS.REQUEST_ACTIVE_SCREEN, (context, path, value) => {
          server.debug(`[KIP][COMMAND] putHandlerHit command=${COMMAND_PATHS.REQUEST_ACTIVE_SCREEN} path=${String(path)} context=${String(context)}`);
          void context;
          void path;
          return handleScreenWrite(value, 'activeScreen');
        }, plugin.id);
      }

      registerHistoryProvider();
      logOperationalMode('post-provider-registration');

      server.setPluginStatus(`Starting...`);
    },
    stop: () => {
      server.debug('[KIP][LIFECYCLE] stop');
      stopSeriesCapture();
      if (retentionSweepTimer) {
        clearInterval(retentionSweepTimer);
        retentionSweepTimer = null;
      }
      if (storageFlushTimer) {
        clearInterval(storageFlushTimer);
        storageFlushTimer = null;
      }

      const storageLifecycleToken = storageService.getLifecycleToken();
      void storageService.flush(storageLifecycleToken)
        .catch(() => undefined)
        .then(() => storageService.close(storageLifecycleToken))
        .catch(() => undefined);

      const serverWithHistoryApi = server as ServerAPI & {
        unregisterHistoryApiProvider?: () => void;
        history?: {
          unregisterHistoryApiProvider?: () => void;
        };
      };
      const unregisterHistoryApiProvider =
        typeof serverWithHistoryApi.unregisterHistoryApiProvider === 'function'
          ? serverWithHistoryApi.unregisterHistoryApiProvider.bind(serverWithHistoryApi)
          : (typeof serverWithHistoryApi.history?.unregisterHistoryApiProvider === 'function'
              ? serverWithHistoryApi.history.unregisterHistoryApiProvider.bind(serverWithHistoryApi.history)
              : null);
      if (unregisterHistoryApiProvider) {
        unregisterHistoryApiProvider();
      }
      historyApiProviderRegistered = false;

      sqliteInitializationPromise = null;

      const msg = 'Stopped.';
      server.setPluginStatus(msg);
    },
    schema: () => {
      // Return schema with live modeConfig values
      const schema = JSON.parse(JSON.stringify(CONFIG_SCHEMA));
      if (schema && schema.properties && modeConfig) {
        if (typeof modeConfig.nodeSqliteAvailable === 'boolean') {
          schema.properties.nodeSqliteAvailable.default = modeConfig.nodeSqliteAvailable;
        }
        if (typeof modeConfig.historySeriesServiceEnabled === 'boolean') {
          schema.properties.historySeriesServiceEnabled.default = modeConfig.historySeriesServiceEnabled;
        }
        if (typeof modeConfig.registerAsHistoryApiProvider === 'boolean') {
          schema.properties.registerAsHistoryApiProvider.default = modeConfig.registerAsHistoryApiProvider;
        }
      }
      return schema;
    },

    registerWithRouter(router) {
      server.debug(`[KIP][ROUTES] register displays=${API_PATHS.DISPLAYS} instance=${API_PATHS.INSTANCE} screenIndex=${API_PATHS.SCREEN_INDEX} activeScreen=${API_PATHS.ACTIVATE_SCREEN}`);

      // Validate/normalize :displayId where present
      router.param('displayId', (req: Request & { displayId?: string }, res: Response, next: NextFunction, displayId: string) => {
        logAuthTrace(req, 'router.param:displayId:entry');
        if (displayId == null) return sendFail(res, 400, 'Missing displayId parameter')
        try {
          let id = String(displayId)
          // Decode percent-encoding if present
          try {
            id = decodeURIComponent(id)
          } catch {
            // ignore decode errors, keep original id
          }
          // If someone sent JSON as the path segment, try to recover {"displayId":"..."}
          if (id.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(id)
              if (parsed && typeof parsed.displayId === 'string') {
                id = parsed.displayId
              } else {
                return sendFail(res, 400, 'Invalid displayId format in JSON')
              }
            } catch {
              return sendFail(res, 400, 'Invalid displayId JSON')
            }
          }
          // Basic safety: allow UUID-like strings (alphanum + dash)
          if (!/^[A-Za-z0-9-]+$/.test(id)) {
            return sendFail(res, 400, 'Invalid displayId format')
          }
          req.displayId = id
          server.debug(`[KIP][AUTH] displayIdNormalized value=${id}`);
          next()
        } catch {
          server.error(`[AUTH TRACE] router.param:displayId:failed rawDisplayId=${String(displayId)}`);
          return sendFail(res, 400, 'Missing or invalid displayId parameter')
        }
      })

      router.put(`${API_PATHS.INSTANCE}`, async (req: Request & { displayId?: string }, res: Response) => {
        logAuthTrace(req, 'route:PUT:INSTANCE:entry');
        server.debug(`[KIP][ROUTE] method=PUT path=${API_PATHS.INSTANCE} params=${JSON.stringify(req.params)} body=${JSON.stringify(req.body)}`);
        try {
          const displayId = req.displayId;
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter');
          }
          const result = handleSetDisplay({ displayId, display: req.body ?? null });
          return sendActionAsRest(res, result);

        } catch (error) {
          const msg = `HandleMessage failed with errors!`
          server.setPluginError(msg)
          server.error(`Error in HandleMessage: ${error}`);

          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.put(`${API_PATHS.SCREEN_INDEX}`, async (req: Request & { displayId?: string }, res: Response) => {
        logAuthTrace(req, 'route:PUT:SCREEN_INDEX:entry');
        server.debug(`[KIP][ROUTE] method=PUT path=${API_PATHS.SCREEN_INDEX} params=${JSON.stringify(req.params)} body=${JSON.stringify(req.body)}`);
        try {
          const displayId = req.displayId;
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter');
          }
          const result = handleScreenWrite({
            displayId,
            screenIdx: req.body?.screenIdx !== undefined ? req.body.screenIdx : null
          }, 'screenIndex');
          return sendActionAsRest(res, result);

        } catch (error) {
          const msg = `HandleMessage failed with errors!`
          server.setPluginError(msg)
          server.error(`Error in HandleMessage: ${error}`);

          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.put(`${API_PATHS.ACTIVATE_SCREEN}`, async (req: Request & { displayId?: string }, res: Response) => {
        logAuthTrace(req, 'route:PUT:ACTIVATE_SCREEN:entry');
        server.debug(`[KIP][ROUTE] method=PUT path=${API_PATHS.ACTIVATE_SCREEN} params=${JSON.stringify(req.params)} body=${JSON.stringify(req.body)}`);
        try {
          const displayId = req.displayId;
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter');
          }
          const result = handleScreenWrite({
            displayId,
            screenIdx: req.body?.screenIdx !== undefined ? req.body.screenIdx : null
          }, 'activeScreen');
          return sendActionAsRest(res, result);

        } catch (error) {
          const msg = `HandleMessage failed with errors!`
          server.setPluginError(msg)
          server.error(`Error in HandleMessage: ${error}`);

          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(API_PATHS.DISPLAYS, (req: Request, res: Response) => {
        server.debug(`[KIP][ROUTE] method=GET path=${API_PATHS.DISPLAYS} params=${JSON.stringify(req.params)}`);
        try {
          const displays = getAvailableDisplays();
          const items = displays && typeof displays === 'object'
            ? Object.entries(displays)
                .filter(([, v]) => v && typeof v === 'object')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map(([displayId, v]: [string, any]) => ({
                  displayId,
                  displayName: v?.value?.displayName ?? null
                }))
            : [];
          server.debug(`[KIP][DISPLAYS] raw=${JSON.stringify(displays)}`);
          server.debug(`[KIP][DISPLAYS] count=${items.length} items=${JSON.stringify(items)}`);
          return res.status(200).json(items);
        } catch (error) {
          server.error(`Error reading displays: ${String((error as Error).message || error)}`);
          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(`${API_PATHS.INSTANCE}`, (req: Request, res: Response) => {
        server.debug(`[KIP][ROUTE] method=GET path=${API_PATHS.INSTANCE} params=${JSON.stringify(req.params)}`);
        try {
          const displayId = (req as Request & { displayId?: string }).displayId
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter')
          }

          const node = getDisplaySelfPath(displayId);
          if (node === undefined) {
            return sendFail(res, 404, `Display ${displayId} not found`)
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const screens = (node as any)?.value?.screens ?? null;

          return sendOk(res, screens);
        } catch (error) {
          server.error(`Error reading display ${req.params?.displayId}: ${String((error as Error).message || error)}`);
          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(`${API_PATHS.SCREEN_INDEX}`, (req: Request, res: Response) => {
        server.debug(`[KIP][ROUTE] method=GET path=${API_PATHS.SCREEN_INDEX} params=${JSON.stringify(req.params)}`);
        try {
          const displayId = (req as Request & { displayId?: string }).displayId
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter')
          }

          const node = getDisplaySelfPath(displayId, 'screenIndex');
          if (node === undefined) {
            return sendFail(res, 404, `Active screen for display Id ${displayId} not found in path`)
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const idx = (node as any)?.value ?? null;

          return sendOk(res, idx);
        } catch (error) {
          server.error(`Error reading activeScreen for ${req.params?.displayId}: ${String((error as Error).message || error)}`);
          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(`${API_PATHS.ACTIVATE_SCREEN}`, (req: Request, res: Response) => {
        server.debug(`[KIP][ROUTE] method=GET path=${API_PATHS.ACTIVATE_SCREEN} params=${JSON.stringify(req.params)}`);
        try {
          const displayId = (req as Request & { displayId?: string }).displayId
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter')
          }

          const node = getDisplaySelfPath(displayId, 'activeScreen');
          if (node === undefined) {
            return sendFail(res, 404, `Change display screen Id ${displayId} not found in path`)
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const idx = (node as any)?.value ?? null;

          return sendOk(res, idx);
        } catch (error) {
          server.error(`Error reading activeScreen for ${req.params?.displayId}: ${String((error as Error).message || error)}`);
          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(API_PATHS.SERIES, async (req: Request, res: Response) => {
        server.debug(`[KIP][ROUTE] method=GET path=${API_PATHS.SERIES} params=${JSON.stringify(req.params)}`);
        try {
          if (!ensureHistorySeriesServiceEnabledForRequest(res)) {
            return;
          }
          if (!(await ensureSqliteReadyForRequest(res))) {
            return;
          }
          return sendOk(res, historySeries.listSeries());
        } catch (error) {
          server.error(`Error reading series: ${String((error as Error).message || error)}`);
          const mapped = getRouteError(error, 'Failed to read series');
          return sendFail(res, mapped.statusCode, mapped.message)
        }
      });

      router.put(API_PATHS.SERIES_INSTANCE, async (req: Request, res: Response) => {
        server.debug(`[KIP][ROUTE] method=PUT path=${API_PATHS.SERIES_INSTANCE} params=${JSON.stringify(req.params)} body=${JSON.stringify(req.body)}`);
        try {
          if (!ensureHistorySeriesServiceEnabledForRequest(res)) {
            return;
          }
          if (!(await ensureSqliteReadyForRequest(res))) {
            return;
          }
          const seriesId = String(req.params.seriesId ?? '').trim();
          if (!seriesId) {
            return sendFail(res, 400, 'Missing seriesId parameter');
          }

          const payload = (req.body ?? {}) as Partial<ISeriesDefinition>;
          const previous = findSeriesById(seriesId);
          const next = historySeries.upsertSeries({
            ...payload,
            seriesId,
            datasetUuid: String(payload.datasetUuid ?? seriesId)
          } as ISeriesDefinition);

          try {
            await storageService.upsertSeriesDefinition(next);
          } catch (storageError) {
            if (previous) {
              historySeries.upsertSeries(previous);
            } else {
              historySeries.deleteSeries(seriesId);
            }
            throw storageError;
          }

          rebuildSeriesCaptureSubscriptions();

          return sendOk(res, next);
        } catch (error) {
          server.error(`Error writing series: ${String((error as Error).message || error)}`);
          const mapped = getRouteError(error, 'Failed to write series');
          return sendFail(res, mapped.statusCode, mapped.message)
        }
      });

      router.delete(API_PATHS.SERIES_INSTANCE, async (req: Request, res: Response) => {
        server.debug(`[KIP][ROUTE] method=DELETE path=${API_PATHS.SERIES_INSTANCE} params=${JSON.stringify(req.params)}`);
        try {
          if (!ensureHistorySeriesServiceEnabledForRequest(res)) {
            return;
          }
          if (!(await ensureSqliteReadyForRequest(res))) {
            return;
          }
          const seriesId = String(req.params.seriesId ?? '').trim();
          if (!seriesId) {
            return sendFail(res, 400, 'Missing seriesId parameter');
          }

          const previous = findSeriesById(seriesId);
          if (!previous) {
            return sendFail(res, 404, `Series ${seriesId} not found`);
          }

          await storageService.deleteSeriesDefinition(seriesId);
          historySeries.deleteSeries(seriesId);

          rebuildSeriesCaptureSubscriptions();

          return sendOk(res, { state: 'SUCCESS', statusCode: 200 });
        } catch (error) {
          server.error(`Error deleting series: ${String((error as Error).message || error)}`);
          const mapped = getRouteError(error, 'Failed to delete series');
          return sendFail(res, mapped.statusCode, mapped.message)
        }
      });

      router.post(API_PATHS.SERIES_RECONCILE, async (req: Request, res: Response) => {
        server.debug(`[KIP][ROUTE] method=POST path=${API_PATHS.SERIES_RECONCILE} body=${JSON.stringify(req.body)}`);
        try {
          if (!ensureHistorySeriesServiceEnabledForRequest(res)) {
            return;
          }
          if (!(await ensureSqliteReadyForRequest(res))) {
            return;
          }
          const payload = req.body;
          if (!Array.isArray(payload)) {
            return sendFail(res, 400, 'Body must be an array of series definitions');
          }

          const simulated = new HistorySeriesService(() => Date.now());
          historySeries.listSeries().forEach(series => {
            simulated.upsertSeries(series);
          });

          const scopedPayload = (payload as ISeriesDefinition[]).map(series => ({
            ...series
          }));

          const result = simulated.reconcileSeries(scopedPayload);
          const nextSeries = simulated.listSeries();

          await storageService.replaceSeriesDefinitions(nextSeries);

          const seriesOutsideScope = historySeries.listSeries();
          historySeries.reconcileSeries([...seriesOutsideScope, ...nextSeries]);

          server.debug(`[KIP][SERIES_RECONCILE] created=${result.created} updated=${result.updated} deleted=${result.deleted} total=${result.total}`);
          rebuildSeriesCaptureSubscriptions();
          return sendOk(res, result);
        } catch (error) {
          server.error(`Error reconciling series: ${String((error as Error).message || error)}`);
          const mapped = getRouteError(error, 'Failed to reconcile series');
          return sendFail(res, mapped.statusCode, mapped.message)
        }
      });

      // List all registered routes for debugging
      if (router.stack) {
        router.stack.forEach((layer: { route?: { path?: string; stack: { method: string }[] } }) => {
          if (layer.route && layer.route.path) {
            server.debug(`[KIP][ROUTES] registered method=${layer.route.stack[0].method.toUpperCase()} path=${layer.route.path}`);
          }
        });
      }

      server.setPluginStatus(`Providing remote display screen control and history series API`);
    },
    getOpenApi: () => mutableOpenApi
  };

  return plugin;
}
const startWithHooks = start as typeof start & { getSqliteModule?: TGetSqliteModule };
startWithHooks.getSqliteModule = defaultGetSqliteModule;
module.exports = start;
