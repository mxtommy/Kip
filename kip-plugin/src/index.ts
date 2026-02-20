import { ActionResult, Path, Plugin, ServerAPI, SKVersion } from '@signalk/server-api'
import { Request, Response, NextFunction } from 'express'
import * as openapi from './openApi.json';
import { HistorySeriesService, IHistoryQueryParams, IHistoryValuesResponse, ISeriesDefinition, THistoryMethod } from './history-series.service';
import { DuckDbParquetStorageService } from './duckdb-parquet-storage.service';

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
    HISTORY_PATHS: '/history/paths',
    HISTORY_CONTEXTS: '/history/contexts',
    HISTORY_VALUES: '/history/values'
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
    description: 'KIP plugin runtime mode configuration.',
    properties: {
      historySeriesServiceEnabled: {
        type: 'boolean',
        title: 'Enable History-Series Service',
        description: 'Automatically capture widget history-series data from widget configuration. If disabled, configure data capture in your chosen history provider plugin.',
        default: true
      },
      registerAsHistoryApiProvider: {
        type: 'boolean',
        title: 'Enable History API Provider',
        description: 'Use plugin provider for widget history data. Turn this off to use another History API provider.',
        default: true
      }
    }
  };

  const historySeries = new HistorySeriesService(() => Date.now(), false);
  const storageService = new DuckDbParquetStorageService();
  let retentionSweepTimer: NodeJS.Timeout | null = null;
  let storageFlushTimer: NodeJS.Timeout | null = null;
  let duckDbInitializationPromise: Promise<boolean> | null = null;
  const DUCKDB_INIT_WAIT_TIMEOUT_MS = 5000;
  let streamUnsubscribes: Array<() => void> = [];
  let historyApiRegistry: { unregisterHistoryApiProvider: () => void } | null = null;
  let historySeriesServiceEnabled = true;
  let registerAsHistoryApiProvider = true;
  let historyApiProviderRegistered = false;

  interface IHistoryModeConfig {
    historySeriesServiceEnabled: boolean;
    registerAsHistoryApiProvider: boolean;
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

    return {
      historySeriesServiceEnabled: historySeriesServiceEnabledSetting !== false,
      registerAsHistoryApiProvider: registerAsHistoryApiProviderSetting !== false
    };
  }

  // Helpers
  function getDisplaySelfPath(displayId: string, suffix?: string): object | undefined {
    const tail = suffix ? `.${suffix}` : ''
    const want = `displays.${displayId}${tail}`
    const full = server.getSelfPath(want)
    server.debug(`getDisplaySelfPath: displayId: ${displayId}, suffix: ${suffix}, want=${want}, fullPath=${JSON.stringify(full)}`)
    return typeof full === 'object' && full !== null ? full : undefined;
  }

  function getAvailableDisplays(): object | undefined {
    const fullPath = server.getSelfPath('displays') ;
    server.debug(`getAvailableDisplays: fullPath=${JSON.stringify(fullPath)}`);
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

  function getDuckDbUnavailableMessage(): string {
    const details = storageService.getLastInitError();
    return details
      ? `DuckDB storage unavailable: ${details}`
      : 'DuckDB storage unavailable';
  }

  function isDuckDbUnavailable(): boolean {
    return Boolean(storageService.getLastInitError());
  }

  async function waitForDuckDbInitialization(timeoutMs = DUCKDB_INIT_WAIT_TIMEOUT_MS): Promise<boolean> {
    if (!duckDbInitializationPromise) {
      return storageService.isDuckDbParquetReady();
    }

    try {
      const ready = await Promise.race<boolean>([
        duckDbInitializationPromise,
        new Promise<boolean>(resolvePromise => {
          setTimeout(() => resolvePromise(false), timeoutMs);
        })
      ]);

      if (!ready && !storageService.isDuckDbParquetReady()) {
        server.error(`[SERIES STORAGE] DuckDB initialization wait timed out after ${timeoutMs}ms`);
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
      normalized.includes('duckdb')
      || normalized.includes('storage unavailable')
      || normalized.includes('not initialized')
      || isDuckDbUnavailable()
    ) {
      return { statusCode: 503, message };
    }

    return { statusCode: 500, message };
  }

  function findSeriesById(seriesId: string): ISeriesDefinition | null {
    const current = historySeries.listSeries().find(item => item.seriesId === seriesId);
    return current ? JSON.parse(JSON.stringify(current)) as ISeriesDefinition : null;
  }

  function isHistorySeriesServiceEnabled(): boolean {
    return historySeriesServiceEnabled;
  }

  function isHistoryApiProviderEnabled(): boolean {
    return registerAsHistoryApiProvider;
  }

  function logOperationalMode(stage: string): void {
    server.debug(
      `[HISTORY MODE] stage=${stage} historySeriesServiceEnabled=${isHistorySeriesServiceEnabled()} historyApiProviderEnabled=${isHistoryApiProviderEnabled()} historyApiProviderRegistered=${historyApiProviderRegistered}`
    );
  }

  async function ensureDuckDbReadyForRequest(res: Response): Promise<boolean> {
    await waitForDuckDbInitialization();
    if (storageService.isDuckDbParquetReady()) {
      return true;
    }
    sendFail(res, 503, getDuckDbUnavailableMessage());
    return false;
  }

  function ensureHistorySeriesServiceEnabledForRequest(res: Response): boolean {
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
    server.debug(`[WRITE TRACE] applyDisplayWrite path=${path} value=${JSON.stringify(value)}`);
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
      server.debug(`[WRITE TRACE] handleMessage success path=${path}`);
      return completed(200);
    } catch (error) {
      const message = (error as Error)?.message ?? 'Unable to write display path';
      server.error(`[WRITE TRACE] handleMessage failure path=${path} message=${message}`);
      return completed(400, message);
    }
  }

  function handleSetDisplay(value: unknown): ActionResult {
    server.debug(`[COMMAND TRACE] handleSetDisplay payload=${JSON.stringify(value)}`);
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
    server.debug(`[COMMAND TRACE] handleScreenWrite suffix=${suffix} payload=${JSON.stringify(value)}`);
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
    server.debug(`[REST TRACE] sendActionAsRest statusCode=${result.statusCode} message=${result.message ?? ''}`);
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
    await waitForDuckDbInitialization();
    if (!storageService.isDuckDbParquetReady()) {
      throw new Error(getDuckDbUnavailableMessage());
    }

    try {
      await storageService.flush();
    } catch (flushError) {
      server.error(`[SERIES STORAGE] pre-paths flush failed: ${String((flushError as Error).message || flushError)}`);
    }
    return storageService.getStoredPaths(query);
  }

  async function resolveHistoryContexts(query?: IHistoryRangeQuery): Promise<string[]> {
    await waitForDuckDbInitialization();
    if (!storageService.isDuckDbParquetReady()) {
      throw new Error(getDuckDbUnavailableMessage());
    }

    try {
      await storageService.flush();
    } catch (flushError) {
      server.error(`[SERIES STORAGE] pre-contexts flush failed: ${String((flushError as Error).message || flushError)}`);
    }
    return storageService.getStoredContexts(query);
  }

  async function resolveHistoryValues(query: IHistoryQueryParams): Promise<IHistoryValuesResponse> {
    await waitForDuckDbInitialization();
    if (!storageService.isDuckDbParquetReady()) {
      throw new Error(getDuckDbUnavailableMessage());
    }

    try {
      await storageService.flush();
    } catch (flushError) {
      server.error(`[SERIES STORAGE] pre-query flush failed: ${String((flushError as Error).message || flushError)}`);
    }
    const values = await storageService.getValues(query);
    if (!values) {
      throw new Error('DuckDB storage did not return history values.');
    }
    return values;
  }

  function registerHistoryProvider(): void {
    historyApiProviderRegistered = false;

    if (!isHistoryApiProviderEnabled()) {
      server.debug('[HISTORY PROVIDER] Registration disabled by plugin configuration');
      return;
    }

    const host = server as ServerAPI & {
      history?: { registerHistoryApiProvider?: (provider: { getValues: (query: IHistoryApiValuesRequestLike) => Promise<unknown>; getPaths: (query: IHistoryApiRangeRequestLike) => Promise<string[]>; getContexts: (query: IHistoryApiRangeRequestLike) => Promise<string[]>; }) => void; unregisterHistoryApiProvider?: () => void };
      registerHistoryApiProvider?: (provider: { getValues: (query: IHistoryApiValuesRequestLike) => Promise<unknown>; getPaths: (query: IHistoryApiRangeRequestLike) => Promise<string[]>; getContexts: (query: IHistoryApiRangeRequestLike) => Promise<string[]>; }) => void;
      unregisterHistoryApiProvider?: () => void;
    };

    const apiProvider = {
      getValues: async (query: IHistoryApiValuesRequestLike): Promise<unknown> => {
        const resolved = await resolveHistoryValues(buildHistoryQueryFromValuesRequest(query));
        return {
          ...resolved,
          values: resolved.values.map(valueSpec => ({
            path: valueSpec.path,
            method: valueSpec.method === 'avg' ? 'average' : valueSpec.method
          }))
        };
      },
      getPaths: (query: IHistoryApiRangeRequestLike): Promise<string[]> =>
        resolveHistoryPaths(buildHistoryQueryFromRangeRequest(query)),
      getContexts: (query: IHistoryApiRangeRequestLike): Promise<string[]> =>
        resolveHistoryContexts(buildHistoryQueryFromRangeRequest(query))
    };

    const registry = host.history && typeof host.history.registerHistoryApiProvider === 'function'
      ? host.history
      : (typeof host.registerHistoryApiProvider === 'function'
        ? {
          registerHistoryApiProvider: host.registerHistoryApiProvider.bind(host),
          unregisterHistoryApiProvider: typeof host.unregisterHistoryApiProvider === 'function'
            ? host.unregisterHistoryApiProvider.bind(host)
            : undefined
        }
        : null);

    if (registry && typeof registry.registerHistoryApiProvider === 'function') {
      registry.registerHistoryApiProvider(apiProvider);
      historyApiProviderRegistered = true;
      if (typeof registry.unregisterHistoryApiProvider === 'function') {
        historyApiRegistry = { unregisterHistoryApiProvider: registry.unregisterHistoryApiProvider.bind(registry) };
      }
      server.debug('[HISTORY PROVIDER] Registered KIP as History API provider');
      return;
    }

    server.debug('[HISTORY PROVIDER] Registration requested but no compatible registration API was found on server host');
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

    const seriesByPath = new Map<string, ISeriesDefinition[]>();
    historySeries.listSeries().filter(series => series.enabled !== false).forEach(series => {
      const list = seriesByPath.get(series.path) ?? [];
      list.push(series);
      seriesByPath.set(series.path, list);
    });

    const uniquePaths = Array.from(seriesByPath.keys());
    uniquePaths.forEach(path => {
      try {
        const pathSeries = seriesByPath.get(path) ?? [];
        const allSelfContext = pathSeries.every(series => (series.context ?? 'vessels.self') === 'vessels.self');
        const bus = allSelfContext && typeof (streamBundle as { getSelfBus?: unknown }).getSelfBus === 'function'
          ? (streamBundle as { getSelfBus: (p: Path) => unknown }).getSelfBus(path as Path)
          : streamBundle.getBus(path as Path);
        if (!bus || typeof (bus as { onValue?: unknown }).onValue !== 'function') {
          return;
        }

        const unsubscribe = (bus as { onValue: (cb: (value: unknown) => void) => (() => void) | void }).onValue((sample: unknown) => {
          try {
            const count = historySeries.recordFromSignalKSample(sample as { path?: unknown; value?: unknown; timestamp?: unknown; context?: unknown; source?: unknown; $source?: unknown });
            if (count > 0) {
              // server.debug(`[SERIES CAPTURE] path=${path} recorded=${count}`);
            }
          } catch (error) {
            server.error(`[SERIES CAPTURE] failed to record sample path=${path}: ${String((error as Error).message || error)}`);
          }
        });

        if (typeof unsubscribe === 'function') {
          streamUnsubscribes.push(unsubscribe);
        }
      } catch (error) {
        server.error(`[SERIES CAPTURE] failed to subscribe path=${path}: ${String((error as Error).message || error)}`);
      }
    });

    // server.debug(`[SERIES CAPTURE] activePathSubscriptions=${uniquePaths.length}`);
  }

  function startStorageFlushTimer(intervalMs: number): void {
    if (storageFlushTimer) {
      clearInterval(storageFlushTimer);
      storageFlushTimer = null;
    }

    if (!storageService.isDuckDbParquetEnabled()) {
      return;
    }

    storageFlushTimer = setInterval(() => {
      void storageService.flush()
        .then(result => {
          if (result.inserted > 0 || result.exported > 0) {
            server.debug(`[SERIES STORAGE] flushed inserted=${result.inserted} exported=${result.exported}`);
          }
        })
        .catch(error => {
          server.error(`[SERIES STORAGE] flush failed: ${String((error as Error).message || error)}`);
        });
    }, intervalMs);

    storageFlushTimer.unref?.();
  }

  const plugin: Plugin = {
    id: 'kip',
    name: 'KIP',
    description: 'KIP server plugin',
    start: (settings) => {
      server.debug(`Starting plugin with settings: ${JSON.stringify(settings)}`);
      const modeConfig = resolveHistoryModeConfig(settings);
      historySeriesServiceEnabled = modeConfig.historySeriesServiceEnabled;
      registerAsHistoryApiProvider = modeConfig.registerAsHistoryApiProvider;
      logOperationalMode('start-configured');

      storageService.setLogger({
        debug: (msg: string) => server.debug(msg),
        error: (msg: string) => server.error(msg)
      });
      const storageConfig = storageService.configure(settings);
      server.debug(`[SERIES STORAGE] engine=${storageConfig.engine} db=${storageConfig.databaseFile} parquetDir=${storageConfig.parquetDirectory} flushMs=${storageConfig.flushIntervalMs}`);
      historySeries.setSampleSink(sample => {
        storageService.enqueueSample(sample);
      });

      duckDbInitializationPromise = storageService.initialize();
      void duckDbInitializationPromise.then((ready) => {
        server.debug(`[SERIES STORAGE] duckdbReady=${ready}`);
        if (ready && storageService.isDuckDbParquetEnabled()) {
          if (isHistorySeriesServiceEnabled()) {
            void storageService.getSeriesDefinitions()
              .then((storedSeries) => {
                if (storedSeries.length > 0) {
                  historySeries.reconcileSeries(storedSeries);
                  rebuildSeriesCaptureSubscriptions();
                }
                startStorageFlushTimer(storageConfig.flushIntervalMs);
                logOperationalMode('duckdb-ready');
                server.setPluginStatus(`KIP plugin started with DuckDB/Parquet history storage. Loaded ${storedSeries.length} persisted series. historySeriesServiceEnabled=${isHistorySeriesServiceEnabled()} historyApiProviderEnabled=${isHistoryApiProviderEnabled()} historyApiProviderRegistered=${historyApiProviderRegistered}`);
              })
              .catch((loadError) => {
                server.error(`[SERIES STORAGE] failed to load persisted series: ${String((loadError as Error).message || loadError)}`);
                startStorageFlushTimer(storageConfig.flushIntervalMs);
                logOperationalMode('duckdb-ready-series-load-failed');
                server.setPluginStatus(`KIP plugin started with DuckDB/Parquet history storage. historySeriesServiceEnabled=${isHistorySeriesServiceEnabled()} historyApiProviderEnabled=${isHistoryApiProviderEnabled()} historyApiProviderRegistered=${historyApiProviderRegistered}`);
              });
          } else {
            historySeries.reconcileSeries([]);
            stopSeriesCapture();
            startStorageFlushTimer(storageConfig.flushIntervalMs);
            logOperationalMode('duckdb-ready-series-disabled');
            server.setPluginStatus(`KIP plugin started with history-series service disabled. historyApiProviderEnabled=${isHistoryApiProviderEnabled()} historyApiProviderRegistered=${historyApiProviderRegistered}`);
          }
          return;
        }

        if (storageFlushTimer) {
          clearInterval(storageFlushTimer);
          storageFlushTimer = null;
        }

        const initError = storageService.getLastInitError();
        if (initError) {
          server.setPluginError(`DuckDB unavailable. ${initError}`);
          logOperationalMode('duckdb-unavailable');
          server.setPluginStatus(`KIP plugin started with DuckDB unavailable. historySeriesServiceEnabled=${isHistorySeriesServiceEnabled()} historyApiProviderEnabled=${isHistoryApiProviderEnabled()} historyApiProviderRegistered=${historyApiProviderRegistered}`);
        }
      });

      if (retentionSweepTimer) {
        clearInterval(retentionSweepTimer);
      }
      retentionSweepTimer = setInterval(() => {
        try {
          if (storageService.isDuckDbParquetReady()) {
            const lifecycleToken = storageService.getLifecycleToken();
            void storageService.pruneExpiredSamples(Date.now(), lifecycleToken)
              .then(removedPersistedRows => {
                if (removedPersistedRows > 0) {
                  server.debug(`[SERIES RETENTION] duckdbPrune removedRows=${removedPersistedRows}`);
                }
              })
              .catch(error => {
                server.error(`[SERIES RETENTION] duckdbPrune failed: ${String((error as Error).message || error)}`);
              });
          }
        } catch (error) {
          server.error(`[SERIES RETENTION] sweep failed: ${String((error as Error).message || error)}`);
        }
      }, 60 * 60_000);
      retentionSweepTimer.unref?.();
      rebuildSeriesCaptureSubscriptions();

      if (server.registerPutHandler) {
        server.debug(`[COMMAND TRACE] Registering PUT handlers under context=${PUT_CONTEXT}`);
        server.registerPutHandler(PUT_CONTEXT, COMMAND_PATHS.SET_DISPLAY, (context, path, value) => {
          server.debug(`[COMMAND TRACE] PUT handler hit path=${String(path)} context=${String(context)} command=${COMMAND_PATHS.SET_DISPLAY}`);
          void context;
          void path;
          return handleSetDisplay(value);
        }, plugin.id);

        server.registerPutHandler(PUT_CONTEXT, COMMAND_PATHS.SET_SCREEN_INDEX, (context, path, value) => {
          server.debug(`[COMMAND TRACE] PUT handler hit path=${String(path)} context=${String(context)} command=${COMMAND_PATHS.SET_SCREEN_INDEX}`);
          void context;
          void path;
          return handleScreenWrite(value, 'screenIndex');
        }, plugin.id);

        server.registerPutHandler(PUT_CONTEXT, COMMAND_PATHS.REQUEST_ACTIVE_SCREEN, (context, path, value) => {
          server.debug(`[COMMAND TRACE] PUT handler hit path=${String(path)} context=${String(context)} command=${COMMAND_PATHS.REQUEST_ACTIVE_SCREEN}`);
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
      server.debug(`Stopping plugin`);
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

      if (historyApiRegistry) {
        try {
          historyApiRegistry.unregisterHistoryApiProvider();
          server.debug('[HISTORY PROVIDER] Unregistered KIP History API provider');
        } catch (error) {
          server.error(`[HISTORY PROVIDER] unregister failed: ${String((error as Error).message || error)}`);
        }
        historyApiRegistry = null;
      }

      duckDbInitializationPromise = null;

      const msg = 'Stopped.';
      server.setPluginStatus(msg);
    },
    schema: () => CONFIG_SCHEMA,
    registerWithRouter(router) {
      server.debug(`Registering plugin routes: ${API_PATHS.DISPLAYS}, ${API_PATHS.INSTANCE}, ${API_PATHS.SCREEN_INDEX}, ${API_PATHS.ACTIVATE_SCREEN}`);

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
          server.debug(`[AUTH TRACE] router.param:displayId:normalized displayId=${id}`);
          next()
        } catch {
          server.error(`[AUTH TRACE] router.param:displayId:failed rawDisplayId=${String(displayId)}`);
          return sendFail(res, 400, 'Missing or invalid displayId parameter')
        }
      })

      router.put(`${API_PATHS.INSTANCE}`, async (req: Request & { displayId?: string }, res: Response) => {
        logAuthTrace(req, 'route:PUT:INSTANCE:entry');
        server.debug(`** PUT ${API_PATHS.INSTANCE}. Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);
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
        server.debug(`** PUT ${API_PATHS.SCREEN_INDEX}. Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);
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
        server.debug(`** PUT ${API_PATHS.ACTIVATE_SCREEN}. Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);
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
        server.debug(`*** GET DISPLAY ${API_PATHS.DISPLAYS}. Params: ${JSON.stringify(req.params)}`);
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
          server.debug(`getAvailableDisplays returned: ${JSON.stringify(displays)}`);
          server.debug(`Found ${items.length} displays: ${JSON.stringify(items)}`);
          return res.status(200).json(items);
        } catch (error) {
          server.error(`Error reading displays: ${String((error as Error).message || error)}`);
          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(`${API_PATHS.INSTANCE}`, (req: Request, res: Response) => {
        server.debug(`*** GET INSTANCE ${API_PATHS.INSTANCE}. Params: ${JSON.stringify(req.params)}`);
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
        server.debug(`*** GET SCREEN_INDEX ${API_PATHS.SCREEN_INDEX}. Params: ${JSON.stringify(req.params)}`);
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
        server.debug(`*** GET ACTIVATE_SCREEN ${API_PATHS.ACTIVATE_SCREEN}. Params: ${JSON.stringify(req.params)}`);
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
        server.debug(`*** GET SERIES ${API_PATHS.SERIES}. Params: ${JSON.stringify(req.params)}`);
        try {
          if (!ensureHistorySeriesServiceEnabledForRequest(res)) {
            return;
          }
          if (!(await ensureDuckDbReadyForRequest(res))) {
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
        server.debug(`** PUT ${API_PATHS.SERIES_INSTANCE}. Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);
        try {
          if (!ensureHistorySeriesServiceEnabledForRequest(res)) {
            return;
          }
          if (!(await ensureDuckDbReadyForRequest(res))) {
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
        server.debug(`** DELETE ${API_PATHS.SERIES_INSTANCE}. Params: ${JSON.stringify(req.params)}`);
        try {
          if (!ensureHistorySeriesServiceEnabledForRequest(res)) {
            return;
          }
          if (!(await ensureDuckDbReadyForRequest(res))) {
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
        server.debug(`** POST ${API_PATHS.SERIES_RECONCILE}. Body: ${JSON.stringify(req.body)}`);
        try {
          if (!ensureHistorySeriesServiceEnabledForRequest(res)) {
            return;
          }
          if (!(await ensureDuckDbReadyForRequest(res))) {
            return;
          }
          const payload = req.body;
          if (!Array.isArray(payload)) {
            return sendFail(res, 400, 'Body must be an array of series definitions');
          }

          const simulated = new HistorySeriesService(() => Date.now(), false);
          historySeries.listSeries().forEach(series => {
            simulated.upsertSeries(series);
          });

          const result = simulated.reconcileSeries(payload as ISeriesDefinition[]);
          const nextSeries = simulated.listSeries();

          await storageService.replaceSeriesDefinitions(nextSeries);
          historySeries.reconcileSeries(nextSeries);

          server.debug(`[SERIES RECONCILE] created=${result.created} updated=${result.updated} deleted=${result.deleted} total=${result.total}`);
          rebuildSeriesCaptureSubscriptions();
          return sendOk(res, result);
        } catch (error) {
          server.error(`Error reconciling series: ${String((error as Error).message || error)}`);
          const mapped = getRouteError(error, 'Failed to reconcile series');
          return sendFail(res, mapped.statusCode, mapped.message)
        }
      });

      router.get(API_PATHS.HISTORY_PATHS, async (_req: Request, res: Response) => {
        try {
          if (!ensureHistorySeriesServiceEnabledForRequest(res)) {
            return;
          }
          if (!(await ensureDuckDbReadyForRequest(res))) {
            return;
          }
          const query = {
            from: _req.query.from ? String(_req.query.from) : undefined,
            to: _req.query.to ? String(_req.query.to) : undefined,
            duration: _req.query.duration ? String(_req.query.duration) : undefined
          };
          return sendOk(res, await resolveHistoryPaths(query));
        } catch (error) {
          server.error(`Error reading history paths: ${String((error as Error).message || error)}`);
          const mapped = getRouteError(error, 'Failed to read history paths');
          return sendFail(res, mapped.statusCode, mapped.message)
        }
      });

      router.get(API_PATHS.HISTORY_CONTEXTS, async (_req: Request, res: Response) => {
        try {
          if (!ensureHistorySeriesServiceEnabledForRequest(res)) {
            return;
          }
          if (!(await ensureDuckDbReadyForRequest(res))) {
            return;
          }
          const query = {
            from: _req.query.from ? String(_req.query.from) : undefined,
            to: _req.query.to ? String(_req.query.to) : undefined,
            duration: _req.query.duration ? String(_req.query.duration) : undefined
          };
          return sendOk(res, await resolveHistoryContexts(query));
        } catch (error) {
          server.error(`Error reading history contexts: ${String((error as Error).message || error)}`);
          const mapped = getRouteError(error, 'Failed to read history contexts');
          return sendFail(res, mapped.statusCode, mapped.message)
        }
      });

      router.get(API_PATHS.HISTORY_VALUES, async (req: Request, res: Response) => {
        server.debug(`*** GET HISTORY_VALUES ${API_PATHS.HISTORY_VALUES}. Query: ${JSON.stringify(req.query)}`);
        try {
          if (!ensureHistorySeriesServiceEnabledForRequest(res)) {
            return;
          }
          if (!(await ensureDuckDbReadyForRequest(res))) {
            return;
          }
          const paths = String(req.query.paths ?? '').trim();
          if (!paths) {
            return sendFail(res, 400, 'Query parameter paths is required');
          }

          const query = {
            paths,
            context: req.query.context ? String(req.query.context) : undefined,
            from: req.query.from ? String(req.query.from) : undefined,
            to: req.query.to ? String(req.query.to) : undefined,
            duration: req.query.duration ? String(req.query.duration) : undefined,
            resolution: req.query.resolution ? String(req.query.resolution) : undefined
          };

          return sendOk(res, await resolveHistoryValues(query));
        } catch (error) {
          server.error(`Error reading history values: ${String((error as Error).message || error)}`);
          const mapped = getRouteError(error, 'Failed to read history values');
          return sendFail(res, mapped.statusCode, mapped.message)
        }
      });

      // List all registered routes for debugging
      if (router.stack) {
        router.stack.forEach((layer: { route?: { path?: string; stack: { method: string }[] } }) => {
          if (layer.route && layer.route.path) {
            server.debug(`Registered route: ${layer.route.stack[0].method.toUpperCase()} ${layer.route.path}`);
          }
        });
      }

      server.setPluginStatus(`Providing remote display screen control and history series API`);
    },
    getOpenApi: () => mutableOpenApi
  };

  return plugin;
}
module.exports = start;
