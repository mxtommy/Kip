import { mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { IHistoryQueryParams, IHistoryValuesResponse, ISeriesDefinition, THistoryMethod } from './history-series.service';

export interface ISqliteHistoryStorageConfig {
  engine: 'node:sqlite';
  databaseFile: string;
  flushIntervalMs: number;
}

export interface IRecordedSample {
  seriesId: string;
  datasetUuid: string;
  ownerWidgetUuid: string;
  path: string;
  context: string;
  source: string;
  timestamp: number;
  value: number;
}

interface IRequestedPath {
  path: string;
  method?: THistoryMethod;
  period?: number;
}

interface IPathRow {
  ts_ms: number;
  value: number;
}

interface IPathValueRow extends IPathRow {
  path: string;
}

interface ISeriesRow {
  series_id: string;
  dataset_uuid: string;
  owner_widget_uuid: string;
  owner_widget_selector: string | null;
  path: string;
  source: string | null;
  context: string | null;
  time_scale: string | null;
  period: number | null;
  retention_duration_ms: number | null;
  sample_time: number | null;
  enabled: boolean | number;
  methods_json: string | null;
  reconcile_ts: number | null;
}

interface IStringRow {
  value: string;
}

interface IHistoryRangeQuery {
  from?: string;
  to?: string;
  duration?: string | number;
}

interface TLogger {
  debug: (msg: string) => void;
  error: (msg: string) => void;
}

interface ISqliteStatement {
  all: () => unknown[];
}

interface ISqliteDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => ISqliteStatement;
  close: () => void;
}

interface ISqliteModule {
  DatabaseSync?: new (path: string, options?: { timeout?: number }) => ISqliteDatabase;
}

const DEFAULT_STORAGE_CONFIG: ISqliteHistoryStorageConfig = {
  engine: 'node:sqlite',
  databaseFile: 'plugin-config-data/kip/historicalData/kip-history.sqlite',
  flushIntervalMs: 30_000
};

/**
 * Provides node:sqlite storage for captured history samples.
 */
export class SqliteHistoryStorageService {
  private static readonly EIGHT_HOURS_INTERVAL = 8 * 60 * 60 * 1000;
  private static readonly FOUR_HOURS_INTERVAL = 4 * 60 * 60 * 1000;
  private static readonly STALE_SERIES_AGE_MS = 180 * 24 * 60 * 60 * 1000;
  private static readonly PRUNE_BATCH_SIZE = 10_000;

  private config: ISqliteHistoryStorageConfig = { ...DEFAULT_STORAGE_CONFIG };
  private dataDirPath: string | null = null;
  private logger: TLogger = {
    debug: () => undefined,
    error: () => undefined
  };

  private db: ISqliteDatabase | null = null;
  private pendingRows: IRecordedSample[] = [];
  private lastInitError: string | null = null;
  private lifecycleToken = 0;
  private initialized = false;
  private runtimeAvailable = true;
  private maintenanceInProgress = false;
  private flushInProgress = false;
  private vacuumJob: NodeJS.Timeout | null = null;
  private pruneJob: NodeJS.Timeout | null = null;
  private staleSeriesCleanupJob: NodeJS.Timeout | null = null;

  /**
   * Sets logger callbacks used by the storage service.
   *
   * @param {TLogger} logger Logger implementation from plugin runtime.
   * @returns {void}
   *
   * @example
   * storage.setLogger({ debug: console.log, error: console.error });
   */
  public setLogger(logger: TLogger): void {
    this.logger = logger;
  }

  /**
   * Applies the fixed storage backend configuration.
   *
   * @returns {ISqliteHistoryStorageConfig} Fixed storage configuration.
   *
   * @example
   * const cfg = storage.configure();
   * console.log(cfg.engine);
   */
  public configure(): ISqliteHistoryStorageConfig {
    this.initialized = false;
    const databaseFile = this.dataDirPath
      ? join(this.dataDirPath, 'historicalData', 'kip-history.sqlite')
      : DEFAULT_STORAGE_CONFIG.databaseFile;
    this.config = {
      ...DEFAULT_STORAGE_CONFIG,
      databaseFile
    };
    return this.config;
  }

  /**
   * Sets the base directory for persisted history data.
   *
   * @param {string | null} baseDir Absolute directory path for plugin data.
   * @returns {void}
   *
   * @example
   * storage.setDataDirPath('/var/lib/signalk');
   */
  public setDataDirPath(baseDir: string | null): void {
    this.dataDirPath = typeof baseDir === 'string' && baseDir.trim() ? baseDir.trim() : null;
  }

  /**
   * Updates runtime availability of node:sqlite, clearing stored errors when enabled.
   *
   * @param {boolean} available Whether node:sqlite is available at runtime.
   * @param {string | undefined} errorMessage Optional runtime error message.
   * @returns {void}
   *
   * @example
   * storage.setRuntimeAvailability(false, 'node:sqlite unavailable');
   */
  public setRuntimeAvailability(available: boolean, errorMessage?: string): void {
    this.runtimeAvailable = available;
    this.lastInitError = available ? null : (errorMessage ?? 'node:sqlite unavailable');
    if (!available) {
      this.initialized = false;
      this.db = null;
    }
  }

  /**
   * Initializes node:sqlite storage.
   *
   * @returns {Promise<boolean>} True when node:sqlite is initialized and ready.
   *
   * @example
   * const ready = await storage.initialize();
   */
  public async initialize(): Promise<boolean> {
    if (!this.isSqliteEnabled() || !this.runtimeAvailable) {
      return false;
    }

    this.initialized = false;
    this.lifecycleToken += 1;

    try {
      const sqlite = await this.loadSqliteModule();
      if (!sqlite?.DatabaseSync) {
        throw new Error('node:sqlite DatabaseSync is unavailable');
      }

      const dbPath = resolve(this.config.databaseFile);
      mkdirSync(dirname(dbPath), { recursive: true });

      this.db = new sqlite.DatabaseSync(dbPath, { timeout: 5000 });
      this.db.exec('PRAGMA journal_mode=WAL;');
      this.db.exec('PRAGMA synchronous=NORMAL;');
      this.db.exec('PRAGMA temp_store=MEMORY;');
      this.db.exec('PRAGMA foreign_keys=ON;');

      await this.createCoreTables();
      await this.runSql('CREATE INDEX IF NOT EXISTS idx_history_series_scope_ts ON history_samples(series_id, ts_ms)');
      await this.runSql('CREATE INDEX IF NOT EXISTS idx_history_series_scope_id ON history_series(series_id)');
      await this.runSql('CREATE INDEX IF NOT EXISTS idx_history_samples_scope_context_path_ts ON history_samples(context, path, ts_ms)');
      await this.runSql('CREATE INDEX IF NOT EXISTS idx_history_samples_scope_ts_path ON history_samples(ts_ms, path)');
      await this.runSql('CREATE INDEX IF NOT EXISTS idx_history_samples_scope_ts_context ON history_samples(ts_ms, context)');

      this.logger.debug(`[SERIES STORAGE] node:sqlite initialized at ${dbPath}`);
      this.lastInitError = null;
      this.initialized = true;

      this.startVacuumJob();
      this.startPruneJob();
      this.startStaleSeriesCleanupJob();

      return true;
    } catch (error) {
      const message = (error as Error)?.message ?? String(error);
      this.lastInitError = message;
      this.logger.error(`[SERIES STORAGE] node:sqlite initialization failed: ${message}`);
      this.db = null;
      this.pendingRows = [];
      this.initialized = false;
      this.stopVacuumJob();
      this.stopPruneJob();
      this.stopStaleSeriesCleanupJob();
      return false;
    }
  }

  /**
   * Returns last node:sqlite initialization error when initialization failed.
   *
   * @returns {string | null} Initialization error text or null.
   *
   * @example
   * const err = storage.getLastInitError();
   */
  public getLastInitError(): string | null {
    return this.lastInitError;
  }

  /**
   * Indicates whether node:sqlite mode is selected.
   *
   * @returns {boolean} True when the selected engine is `node:sqlite`.
   *
   * @example
   * if (storage.isSqliteEnabled()) {
   *   console.log('node:sqlite mode enabled');
   * }
   */
  public isSqliteEnabled(): boolean {
    return this.config.engine === 'node:sqlite';
  }

  /**
   * Indicates whether node:sqlite mode is initialized and ready.
   *
   * @returns {boolean} True when node:sqlite mode is selected and an active connection exists.
   *
   * @example
   * if (storage.isSqliteReady()) {
   *   console.log('node:sqlite ready');
   * }
   */
  public isSqliteReady(): boolean {
    return this.isSqliteEnabled() && this.initialized && this.db !== null && this.runtimeAvailable;
  }

  /**
   * Returns the current storage lifecycle token.
   *
   * @returns {number} Current lifecycle token.
   *
   * @example
   * const token = storage.getLifecycleToken();
   */
  public getLifecycleToken(): number {
    return this.lifecycleToken;
  }

  /**
   * Adds a captured sample row to the pending storage queue.
   *
   * @param {IRecordedSample} sample Captured sample metadata and value.
   * @returns {void}
   *
   * @example
   * storage.enqueueSample(sample);
   */
  public enqueueSample(sample: IRecordedSample): void {
    if (!this.isSqliteReady()) {
      return;
    }

    this.pendingRows.push(sample);
  }

  /**
   * Flushes queued samples into node:sqlite.
   *
   * @param {number} [expectedLifecycleToken] Optional lifecycle token guard to skip stale flushes.
   * @returns {Promise<{ inserted: number; exported: number }>} Number of inserted rows (exported is always 0).
   *
   * @example
   * const result = await storage.flush();
   */
  public async flush(expectedLifecycleToken?: number): Promise<{ inserted: number; exported: number }> {
    if (expectedLifecycleToken !== undefined && expectedLifecycleToken !== this.lifecycleToken) {
      return { inserted: 0, exported: 0 };
    }

    if (!this.isSqliteEnabled() || !this.db || this.pendingRows.length === 0) {
      return { inserted: 0, exported: 0 };
    }

    if (this.flushInProgress) {
      return { inserted: 0, exported: 0 };
    }

    this.flushInProgress = true;

    const rows = this.pendingRows;
    this.pendingRows = [];
    const startedAt = Date.now();

    try {
      await this.insertRows(rows);
      const elapsedMs = Date.now() - startedAt;
      this.logger.debug(`[SERIES STORAGE] flush inserted=${rows.length} durationMs=${elapsedMs}`);
      return { inserted: rows.length, exported: 0 };
    } catch (error) {
      this.pendingRows = [...rows, ...this.pendingRows];
      throw error;
    } finally {
      this.flushInProgress = false;
    }
  }

  /**
   * Returns persisted series definitions from node:sqlite.
   *
   * @returns {Promise<ISeriesDefinition[]>} Stored series definitions.
   *
   * @example
   * const series = await storage.getSeriesDefinitions();
   */
  public async getSeriesDefinitions(): Promise<ISeriesDefinition[]> {
    if (!this.isSqliteEnabled() || !this.db) {
      return [];
    }

    const rows = await this.querySql<ISeriesRow>(`
      SELECT
        series_id,
        dataset_uuid,
        owner_widget_uuid,
        owner_widget_selector,
        path,
        source,
        context,
        time_scale,
        period,
        retention_duration_ms,
        sample_time,
        enabled,
        methods_json,
        reconcile_ts
      FROM history_series
      ORDER BY series_id ASC
    `);

    return rows.map(row => ({
      seriesId: row.series_id,
      datasetUuid: row.dataset_uuid,
      ownerWidgetUuid: row.owner_widget_uuid,
      ownerWidgetSelector: row.owner_widget_selector ?? undefined,
      path: row.path,
      source: row.source ?? undefined,
      context: row.context ?? undefined,
      timeScale: row.time_scale ?? undefined,
      period: this.toNumberOrUndefined(row.period),
      retentionDurationMs: this.toNumberOrUndefined(row.retention_duration_ms),
      sampleTime: this.toNumberOrUndefined(row.sample_time),
      enabled: this.toBoolean(row.enabled),
      methods: this.parseMethods(row.methods_json),
      reconcileTs: this.toNumberOrUndefined(row.reconcile_ts)
    }));
  }

  /**
   * Persists one series definition in node:sqlite.
   *
   * @param {ISeriesDefinition} series Series definition to persist.
   * @returns {Promise<void>}
   *
   * @example
   * await storage.upsertSeriesDefinition(series);
   */
  public async upsertSeriesDefinition(series: ISeriesDefinition): Promise<void> {
    if (!this.isSqliteEnabled() || !this.db) {
      return;
    }

    await this.runSql(`DELETE FROM history_series WHERE series_id = ${this.escape(series.seriesId)}`);
    await this.runSql(`
      INSERT INTO history_series (
        series_id,
        dataset_uuid,
        owner_widget_uuid,
        owner_widget_selector,
        path,
        source,
        context,
        time_scale,
        period,
        retention_duration_ms,
        sample_time,
        enabled,
        methods_json,
        reconcile_ts
      ) VALUES (
        ${this.escape(series.seriesId)},
        ${this.escape(series.datasetUuid)},
        ${this.escape(series.ownerWidgetUuid)},
        ${this.nullableString(series.ownerWidgetSelector)},
        ${this.escape(series.path)},
        ${this.nullableString(series.source)},
        ${this.nullableString(series.context)},
        ${this.nullableString(series.timeScale)},
        ${this.nullableNumber(series.period)},
        ${this.nullableNumber(series.retentionDurationMs)},
        ${this.nullableNumber(series.sampleTime)},
        ${series.enabled === false ? '0' : '1'},
        ${this.nullableString(series.methods ? JSON.stringify(series.methods) : null)},
        ${this.nullableNumber(series.reconcileTs)}
      )
    `);
  }

  /**
   * Deletes one persisted series definition in node:sqlite.
   *
   * @param {string} seriesId Series identifier.
   * @returns {Promise<void>}
   *
   * @example
   * await storage.deleteSeriesDefinition('series-1');
   */
  public async deleteSeriesDefinition(seriesId: string): Promise<void> {
    if (!this.isSqliteEnabled() || !this.db) {
      return;
    }
    await this.runSql(`DELETE FROM history_series WHERE series_id = ${this.escape(seriesId)}`);
  }

  /**
   * Replaces persisted series definitions with desired set.
   *
   * @param {ISeriesDefinition[]} series Full desired series set.
   * @returns {Promise<void>}
   *
   * @example
   * await storage.replaceSeriesDefinitions(series);
   */
  public async replaceSeriesDefinitions(series: ISeriesDefinition[]): Promise<void> {
    if (!this.isSqliteEnabled() || !this.db) {
      return;
    }

    await this.runSql('DELETE FROM history_series');
    for (const item of series) {
      await this.upsertSeriesDefinition(item);
    }
  }

  /**
   * Deletes series not reconciled since the given cutoff timestamp.
   *
   * @param {number} cutoffMs Milliseconds since epoch; series with reconcile_ts < cutoffMs will be deleted.
   * @returns {Promise<number>} Number of deleted series.
   *
   * @example
   * const deleted = await storage.deleteStaleSeries(Date.now() - 180 * 24 * 60 * 60 * 1000);
   */
  public async deleteStaleSeries(cutoffMs: number): Promise<number> {
    if (!this.isSqliteEnabled() || !this.db) {
      return 0;
    }

    const rows = await this.querySql<{ series_id: string }>(`
      SELECT series_id FROM history_series
      WHERE reconcile_ts IS NULL OR reconcile_ts < ${Math.trunc(cutoffMs)}
    `);

    const ids = rows.map(row => row.series_id).filter(Boolean);
    for (const id of ids) {
      await this.deleteSeriesDefinition(id);
    }

    return ids.length;
  }

  /**
   * Removes persisted samples that are older than each series retention window.
   *
   * @param {number} [nowMs=Date.now()] Current timestamp in milliseconds used to compute per-series cutoffs.
   * @param {number} [expectedLifecycleToken] Optional lifecycle token guard to skip stale sweeps.
   * @returns {Promise<number>} Number of deleted sample rows.
   *
   * @example
   * const removed = await storage.pruneExpiredSamples();
   */
  public async pruneExpiredSamples(nowMs: number = Date.now(), expectedLifecycleToken?: number): Promise<number> {
    if (expectedLifecycleToken !== undefined && expectedLifecycleToken !== this.lifecycleToken) {
      return 0;
    }

    if (!this.isSqliteEnabled() || !this.db) {
      return 0;
    }

    const anchorMs = Math.trunc(Number.isFinite(nowMs) ? nowMs : Date.now());
    const whereClause = `
      EXISTS (
        SELECT 1
        FROM history_series AS hs
        WHERE hs.series_id = history_samples.series_id
          AND hs.retention_duration_ms IS NOT NULL
          AND hs.retention_duration_ms > 0
          AND history_samples.ts_ms < (${anchorMs} - hs.retention_duration_ms)
      )
    `;

    let removedRows = 0;
    while (true) {
      const batch = await this.querySql<{ rowid: number }>(`
        SELECT rowid
        FROM history_samples
        WHERE ${whereClause}
        LIMIT ${SqliteHistoryStorageService.PRUNE_BATCH_SIZE}
      `);
      if (batch.length === 0) {
        break;
      }

      const rowIds = batch.map(row => Math.trunc(Number(row.rowid))).filter(Number.isFinite);
      if (rowIds.length === 0) {
        break;
      }

      await this.runSql(`
        DELETE FROM history_samples
        WHERE rowid IN (${rowIds.join(', ')})
      `);

      removedRows += rowIds.length;
      if (rowIds.length < SqliteHistoryStorageService.PRUNE_BATCH_SIZE) {
        break;
      }
    }

    return removedRows;
  }

  /**
   * Removes persisted samples that no longer have a matching series definition.
   *
   * @param {number} [expectedLifecycleToken] Optional lifecycle token guard to skip stale sweeps.
   * @returns {Promise<number>} Number of deleted orphan sample rows.
   *
   * @example
   * const removed = await storage.pruneOrphanedSamples();
   */
  public async pruneOrphanedSamples(expectedLifecycleToken?: number): Promise<number> {
    if (expectedLifecycleToken !== undefined && expectedLifecycleToken !== this.lifecycleToken) {
      return 0;
    }

    if (!this.isSqliteEnabled() || !this.db) {
      return 0;
    }

    const whereClause = `
      NOT EXISTS (
        SELECT 1
        FROM history_series AS hs
        WHERE hs.series_id = history_samples.series_id
      )
    `;

    let removedRows = 0;
    while (true) {
      const batch = await this.querySql<{ rowid: number }>(`
        SELECT rowid
        FROM history_samples
        WHERE ${whereClause}
        LIMIT ${SqliteHistoryStorageService.PRUNE_BATCH_SIZE}
      `);
      if (batch.length === 0) {
        break;
      }

      const rowIds = batch.map(row => Math.trunc(Number(row.rowid))).filter(Number.isFinite);
      if (rowIds.length === 0) {
        break;
      }

      await this.runSql(`
        DELETE FROM history_samples
        WHERE rowid IN (${rowIds.join(', ')})
      `);

      removedRows += rowIds.length;
      if (rowIds.length < SqliteHistoryStorageService.PRUNE_BATCH_SIZE) {
        break;
      }
    }

    return removedRows;
  }

  /**
   * Lists known history paths from persisted samples.
   *
   * @param {IHistoryRangeQuery} [query] Optional range filter.
   * @returns {Promise<string[]>} Ordered path names.
   *
   * @example
   * const paths = await storage.getStoredPaths();
   */
  public async getStoredPaths(query?: IHistoryRangeQuery): Promise<string[]> {
    if (!this.isSqliteEnabled() || !this.db) {
      return [];
    }

    const nowMs = Date.now();
    const range = this.resolveRange(nowMs, query?.from, query?.to, query?.duration);

    const rows = await this.querySql<IStringRow>(`
      SELECT DISTINCT path AS value
      FROM history_samples
      WHERE path IS NOT NULL
        AND ts_ms >= ${Math.trunc(range.fromMs)}
        AND ts_ms <= ${Math.trunc(range.toMs)}
      ORDER BY value ASC
    `);
    return rows.map(row => row.value).filter(Boolean);
  }

  /**
   * Lists known history contexts from persisted samples.
   *
   * @param {IHistoryRangeQuery} [query] Optional range filter.
   * @returns {Promise<string[]>} Ordered context names.
   *
   * @example
   * const contexts = await storage.getStoredContexts();
   */
  public async getStoredContexts(query?: IHistoryRangeQuery): Promise<string[]> {
    if (!this.isSqliteEnabled() || !this.db) {
      return [];
    }

    const nowMs = Date.now();
    const range = this.resolveRange(nowMs, query?.from, query?.to, query?.duration);

    const rows = await this.querySql<IStringRow>(`
      SELECT DISTINCT context AS value
      FROM history_samples
      WHERE context IS NOT NULL
        AND ts_ms >= ${Math.trunc(range.fromMs)}
        AND ts_ms <= ${Math.trunc(range.toMs)}
      ORDER BY value ASC
    `);
    return rows.map(row => row.value).filter(Boolean);
  }

  /**
   * Queries history values directly from node:sqlite in History API-compatible shape.
   *
   * @param {IHistoryQueryParams} query Incoming history values query parameters.
   * @returns {Promise<IHistoryValuesResponse | null>} History payload when node:sqlite is ready, otherwise null.
   *
   * @example
   * const result = await storage.getValues({ paths: 'navigation.speedOverGround:avg', duration: 'PT1H' });
   */
  public async getValues(query: IHistoryQueryParams): Promise<IHistoryValuesResponse | null> {
    if (!this.isSqliteEnabled() || !this.db) {
      return null;
    }

    const nowMs = Date.now();
    const requested = this.parseRequestedPaths(query.paths);
    if (requested.length === 0) {
      return null;
    }

    const range = this.resolveRange(nowMs, query.from, query.to, query.duration);
    const context = query.context ?? 'vessels.self';
    const resolutionMs = this.resolveResolutionMs(query.resolution);
    const uniquePaths = Array.from(new Set(requested.map(item => item.path)));
    const rowsByPath = await this.selectRowsForPaths(uniquePaths, context, range.fromMs, range.toMs);

    const timestampRows = new Map<number, (number | null)[]>();
    for (let index = 0; index < requested.length; index += 1) {
      const item = requested[index];
      const rows = rowsByPath.get(item.path) ?? [];
      const transformed = this.applyMethod(item, rows);
      const merged = this.downsampleIfNeeded(transformed, resolutionMs, item.method ?? 'avg');

      merged.forEach(entry => {
        const row = timestampRows.get(entry.timestamp) ?? Array.from({ length: requested.length }, () => null);
        row[index] = entry.value;
        timestampRows.set(entry.timestamp, row);
      });
    }

    const data = Array.from(timestampRows.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([timestamp, values]) => [new Date(timestamp).toISOString(), ...values]);

    return {
      context,
      range: {
        from: new Date(range.fromMs).toISOString(),
        to: new Date(range.toMs).toISOString()
      },
      values: requested.map(item => ({
        path: item.path,
        method: item.method ?? 'avg'
      })),
      data
    };
  }

  /**
   * Closes open storage resources.
   *
   * @param {number} [expectedLifecycleToken] Optional lifecycle token guard to skip stale closes.
   * @returns {Promise<void>}
   *
   * @example
   * await storage.close();
   */
  public async close(expectedLifecycleToken?: number): Promise<void> {
    if (expectedLifecycleToken !== undefined && expectedLifecycleToken !== this.lifecycleToken) {
      return;
    }

    this.initialized = false;
    this.stopVacuumJob();
    this.stopPruneJob();
    this.stopStaleSeriesCleanupJob();

    if (!this.db) {
      return;
    }

    const db = this.db;
    this.db = null;

    try {
      db.close();
    } catch {
      // ignore close failures during shutdown
    }
  }

  private async loadSqliteModule(): Promise<ISqliteModule | null> {
    try {
      return await import('node:sqlite') as ISqliteModule;
    } catch {
      return null;
    }
  }

  private startVacuumJob(): void {
    this.stopVacuumJob();
    if (!this.isSqliteReady()) return;
    this.vacuumJob = setInterval(() => {
      if (this.shouldSkipMaintenance()) {
        return;
      }
      void this.runWithMaintenanceLock('vacuum', async () => {
        this.logger.debug('[SERIES STORAGE] Running scheduled node:sqlite VACUUM');
        await this.runSql('VACUUM;');
        await this.runSql('PRAGMA optimize;');
      }).catch(err => {
        this.logger.error(`[SERIES STORAGE] VACUUM failed: ${err?.message ?? err}`);
      });
    }, SqliteHistoryStorageService.EIGHT_HOURS_INTERVAL);
    this.vacuumJob.unref?.();
  }

  private stopVacuumJob(): void {
    if (this.vacuumJob) {
      clearInterval(this.vacuumJob);
      this.vacuumJob = null;
    }
  }

  private startPruneJob(): void {
    this.stopPruneJob();
    if (!this.isSqliteReady()) return;
    this.pruneJob = setInterval(async () => {
      if (this.shouldSkipMaintenance()) {
        return;
      }
      try {
        await this.runWithMaintenanceLock('prune', async () => {
          this.logger.debug('[SERIES STORAGE] Running scheduled prune of expired and orphaned samples');
          const expired = await this.pruneExpiredSamples(Date.now(), this.lifecycleToken);
          const orphaned = await this.pruneOrphanedSamples(this.lifecycleToken);
          this.logger.debug(`[SERIES STORAGE] Pruned ${expired} expired and ${orphaned} orphaned samples`);
        });
      } catch (err) {
        this.logger.error(`[SERIES STORAGE] Prune failed: ${err?.message ?? err}`);
      }
    }, SqliteHistoryStorageService.FOUR_HOURS_INTERVAL);
    this.pruneJob.unref?.();
  }

  private stopPruneJob(): void {
    if (this.pruneJob) {
      clearInterval(this.pruneJob);
      this.pruneJob = null;
    }
  }

  private startStaleSeriesCleanupJob(): void {
    this.stopStaleSeriesCleanupJob();
    if (!this.isSqliteReady()) return;
    this.staleSeriesCleanupJob = setInterval(async () => {
      if (this.shouldSkipMaintenance()) {
        return;
      }
      try {
        await this.runWithMaintenanceLock('stale-cleanup', async () => {
          const cutoff = Date.now() - SqliteHistoryStorageService.STALE_SERIES_AGE_MS;
          this.logger.debug(`[SERIES STORAGE] Running scheduled stale series cleanup (cutoff: ${new Date(cutoff).toISOString()})`);
          const deleted = await this.deleteStaleSeries(cutoff);
          if (deleted > 0) {
            this.logger.debug(`[SERIES STORAGE] Deleted ${deleted} series not reconciled in the last 6 months`);
          }
        });
      } catch (err) {
        this.logger.error(`[SERIES STORAGE] Stale series cleanup failed: ${err?.message ?? err}`);
      }
    }, SqliteHistoryStorageService.EIGHT_HOURS_INTERVAL);
    this.staleSeriesCleanupJob.unref?.();
  }

  private stopStaleSeriesCleanupJob(): void {
    if (this.staleSeriesCleanupJob) {
      clearInterval(this.staleSeriesCleanupJob);
      this.staleSeriesCleanupJob = null;
    }
  }

  private shouldSkipMaintenance(): boolean {
    if (!this.isSqliteReady() || !this.db) {
      return true;
    }

    if (this.maintenanceInProgress || this.flushInProgress) {
      return true;
    }

    if (this.pendingRows.length > 0) {
      return true;
    }

    return false;
  }

  private async runWithMaintenanceLock(label: string, task: () => Promise<void>): Promise<void> {
    if (this.maintenanceInProgress) {
      this.logger.debug(`[SERIES STORAGE] Skipping ${label} (maintenance already running)`);
      return;
    }

    this.maintenanceInProgress = true;
    const startedAt = Date.now();
    try {
      await task();
      const elapsedMs = Date.now() - startedAt;
      this.logger.debug(`[SERIES STORAGE] ${label} completed in ${elapsedMs}ms`);
    } finally {
      this.maintenanceInProgress = false;
    }
  }

  private async createCoreTables(): Promise<void> {
    await this.runSql(`
      CREATE TABLE IF NOT EXISTS history_samples (
        series_id TEXT,
        dataset_uuid TEXT,
        owner_widget_uuid TEXT,
        path TEXT,
        context TEXT,
        source TEXT,
        ts_ms INTEGER,
        value REAL
      )
    `);
    await this.runSql(`
      CREATE TABLE IF NOT EXISTS history_series (
        series_id TEXT NOT NULL,
        dataset_uuid TEXT NOT NULL,
        owner_widget_uuid TEXT NOT NULL,
        owner_widget_selector TEXT,
        path TEXT NOT NULL,
        source TEXT,
        context TEXT,
        time_scale TEXT,
        period INTEGER,
        retention_duration_ms INTEGER,
        sample_time INTEGER,
        enabled INTEGER,
        methods_json TEXT,
        reconcile_ts INTEGER,
        PRIMARY KEY (series_id)
      )
    `);
  }

  private async insertRows(rows: IRecordedSample[]): Promise<void> {
    if (!this.db || rows.length === 0) {
      return;
    }

    const valuesSql = rows
      .map(sample => `(${this.escape(sample.seriesId)}, ${this.escape(sample.datasetUuid)}, ${this.escape(sample.ownerWidgetUuid)}, ${this.escape(sample.path)}, ${this.escape(sample.context)}, ${this.escape(sample.source)}, ${Math.trunc(sample.timestamp)}, ${Number(sample.value)})`)
      .join(',\n');

    const sql = `
      INSERT INTO history_samples (
        series_id,
        dataset_uuid,
        owner_widget_uuid,
        path,
        context,
        source,
        ts_ms,
        value
      ) VALUES ${valuesSql}
    `;

    this.db.exec('BEGIN');
    try {
      await this.runSql(sql);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private async runSql(sql: string): Promise<void> {
    if (!this.db) {
      throw new Error('node:sqlite database is not initialized');
    }

    this.db.exec(sql);
  }

  private async querySql<T>(sql: string): Promise<T[]> {
    if (!this.db) {
      throw new Error('node:sqlite database is not initialized');
    }

    const statement = this.db.prepare(sql);
    return statement.all() as unknown as T[];
  }

  private async selectRowsForPaths(paths: string[], context: string, fromMs: number, toMs: number): Promise<Map<string, IPathRow[]>> {
    const rowsByPath = new Map<string, IPathRow[]>();
    if (paths.length === 0) {
      return rowsByPath;
    }

    const pathFilter = paths.map(path => this.escape(path)).join(', ');
    const sql = `
      SELECT path, ts_ms, value
      FROM history_samples
      WHERE context = ${this.escape(context)}
        AND path IN (${pathFilter})
        AND ts_ms >= ${Math.trunc(fromMs)}
        AND ts_ms <= ${Math.trunc(toMs)}
      ORDER BY path ASC, ts_ms ASC
    `;

    const rows = await this.querySql<IPathValueRow>(sql);
    rows.forEach(row => {
      const list = rowsByPath.get(row.path) ?? [];
      list.push({ ts_ms: Number(row.ts_ms), value: Number(row.value) });
      rowsByPath.set(row.path, list);
    });

    return rowsByPath;
  }

  private parseRequestedPaths(paths: string): IRequestedPath[] {
    return String(paths)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .map(raw => {
        const [pathToken, maybeMethod, maybePeriod] = raw.split(':');
        const path = this.normalizePathIdentifier(pathToken);
        const method = this.parseMethod(maybeMethod);
        const parsedPeriod = maybePeriod !== undefined ? Number(maybePeriod) : undefined;
        return {
          path,
          method,
          period: Number.isFinite(parsedPeriod as number) ? parsedPeriod : undefined
        };
      });
  }

  private parseMethod(value?: string): THistoryMethod | undefined {
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    if (normalized === 'min' || normalized === 'max' || normalized === 'avg' || normalized === 'sma' || normalized === 'ema') {
      return normalized;
    }
    return undefined;
  }

  private normalizePathIdentifier(path: string): string {
    const trimmed = String(path).trim();
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

  private resolveRange(nowMs: number, from?: string, to?: string, duration?: string | number): { fromMs: number; toMs: number } {
    const toMs = to ? Date.parse(to) : nowMs;
    if (!Number.isFinite(toMs)) {
      throw new Error('Invalid to date-time. Expected an ISO 8601 date-time string.');
    }

    const fromMs = from ? Date.parse(from) : toMs - this.parseDurationMs(duration);
    if (!Number.isFinite(fromMs)) {
      throw new Error('Invalid from date-time. Expected an ISO 8601 date-time string.');
    }

    return { fromMs, toMs };
  }

  private parseDurationMs(duration?: string | number): number {
    if (duration === undefined || duration === null) {
      return 60 * 60_000;
    }

    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      return duration;
    }

    if (typeof duration === 'number') {
      throw new Error('Invalid duration. Expected a positive number of milliseconds or an ISO 8601 duration (e.g. PT10M).');
    }

    const value = String(duration).trim();
    if (/^\d+(\.\d+)?$/.test(value)) {
      const parsedMs = Number(value);
      if (Number.isFinite(parsedMs) && parsedMs > 0) {
        return parsedMs;
      }
      throw new Error('Invalid duration. Expected a positive number of milliseconds or an ISO 8601 duration (e.g. PT10M).');
    }

    const iso = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value);
    if (!iso) {
      throw new Error('Invalid duration. Expected a positive number of milliseconds or an ISO 8601 duration (e.g. PT10M).');
    }

    const hours = Number(iso[1] || 0);
    const minutes = Number(iso[2] || 0);
    const seconds = Number(iso[3] || 0);
    const totalMs = (((hours * 60) + minutes) * 60 + seconds) * 1000;
    if (totalMs <= 0) {
      throw new Error('Invalid duration. Expected a positive number of milliseconds or an ISO 8601 duration (e.g. PT10M).');
    }
    return totalMs;
  }

  private resolveResolutionMs(resolution?: string | number): number {
    if (resolution === undefined || resolution === null) {
      return 0;
    }

    if (typeof resolution === 'number') {
      if (!Number.isFinite(resolution) || resolution <= 0) {
        throw new Error('Invalid resolution. Expected a positive number of seconds or an ISO 8601 duration (e.g. PT10S).');
      }
      return Math.max(1, Math.trunc(resolution * 1000));
    }

    const value = String(resolution).trim();
    if (!value) {
      throw new Error('Invalid resolution. Expected a positive number of seconds or an ISO 8601 duration (e.g. PT10S).');
    }

    if (/^\d+(\.\d+)?$/.test(value)) {
      const parsedSeconds = Number(value);
      if (!Number.isFinite(parsedSeconds) || parsedSeconds <= 0) {
        throw new Error('Invalid resolution. Expected a positive number of seconds or an ISO 8601 duration (e.g. PT10S).');
      }
      return Math.max(1, Math.trunc(parsedSeconds * 1000));
    }

    try {
      return this.parseDurationMs(value);
    } catch {
      throw new Error('Invalid resolution. Expected a positive number of seconds or an ISO 8601 duration (e.g. PT10S).');
    }
  }

  private applyMethod(request: IRequestedPath, rows: IPathRow[]): { timestamp: number; value: number | null }[] {
    if (rows.length === 0) return [];

    const method = request.method ?? 'avg';
    if (method === 'min' || method === 'max' || method === 'avg') {
      return rows.map(entry => ({ timestamp: Number(entry.ts_ms), value: Number(entry.value) }));
    }

    if (method === 'sma') {
      const period = Math.max(1, request.period ?? 5);
      return rows.map((entry, index) => {
        const start = Math.max(0, index - period + 1);
        const window = rows.slice(start, index + 1);
        const sum = window.reduce((acc, item) => acc + Number(item.value), 0);
        return {
          timestamp: Number(entry.ts_ms),
          value: sum / window.length
        };
      });
    }

    const period = Math.max(1, request.period ?? 5);
    const multiplier = 2 / (period + 1);
    let previous: number | null = null;
    return rows.map(entry => {
      const value = Number(entry.value);
      if (previous === null) {
        previous = value;
      } else {
        previous = ((value - previous) * multiplier) + previous;
      }
      return {
        timestamp: Number(entry.ts_ms),
        value: previous
      };
    });
  }

  private downsampleIfNeeded(values: { timestamp: number; value: number | null }[], resolutionMs: number, method: THistoryMethod): { timestamp: number; value: number | null }[] {
    if (resolutionMs <= 0 || values.length === 0) {
      return values;
    }

    const buckets = new Map<number, number[]>();
    values.forEach(entry => {
      if (!Number.isFinite(entry.value as number)) {
        return;
      }
      const bucket = Math.floor(entry.timestamp / resolutionMs) * resolutionMs;
      const list = buckets.get(bucket) ?? [];
      list.push(entry.value as number);
      buckets.set(bucket, list);
    });

    return Array.from(buckets.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([timestamp, list]) => {
        const value = this.aggregateBucket(list, method);
        return {
          timestamp,
          value
        };
      });
  }

  private aggregateBucket(values: number[], method: THistoryMethod): number | null {
    if (values.length === 0) {
      return null;
    }

    if (method === 'min') {
      return Math.min(...values);
    }

    if (method === 'max') {
      return Math.max(...values);
    }

    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
  }

  private escape(value: string): string {
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  private nullableString(value?: string | null): string {
    if (value === undefined || value === null || value === '') {
      return 'NULL';
    }
    return this.escape(value);
  }

  private nullableNumber(value?: number | null): string {
    if (value === undefined || value === null || !Number.isFinite(value)) {
      return 'NULL';
    }
    return String(Math.trunc(value));
  }

  private parseMethods(value: string | null): THistoryMethod[] | undefined {
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return undefined;
      const methods = parsed.filter(entry => entry === 'min' || entry === 'max' || entry === 'avg' || entry === 'sma' || entry === 'ema');
      return methods.length > 0 ? methods as THistoryMethod[] : undefined;
    } catch {
      return undefined;
    }
  }

  private toNumberOrUndefined(value: unknown): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'bigint') {
      return value !== 0n;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === '0') {
        return false;
      }
    }

    return Boolean(value);
  }
}
