import { mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import * as duckdb from 'duckdb';
import { IHistoryQueryParams, IHistoryValuesResponse, ISeriesDefinition, THistoryMethod } from './history-series.service';

export interface IDuckDbParquetStorageConfig {
  engine: 'memory' | 'duckdb-parquet';
  databaseFile: string;
  parquetDirectory: string;
  flushIntervalMs: number;
}

export interface IRecordedSample {
  userScope: string;
  seriesId: string;
  datasetUuid: string;
  ownerWidgetUuid: string;
  path: string;
  context: string;
  source: string;
  timestamp: number;
  value: number;
}

interface ISeriesRange {
  userScope: string;
  seriesId: string;
  minTs: number;
  maxTs: number;
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
  user_scope: string | null;
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
}

interface IStringRow {
  value: string;
}

interface ICountRow {
  removed_rows: unknown;
}

interface ITableInfoRow {
  name?: unknown;
  pk?: unknown;
}

interface IHistoryRangeQuery {
  userScope?: string;
  from?: string;
  to?: string;
  duration?: string | number;
}

interface TLogger {
  debug: (msg: string) => void;
  error: (msg: string) => void;
}

interface TDuckDbConnectionLike {
  run?: (sql: string, callback: (err?: Error | null) => void) => void;
  all?: (sql: string, callback: (err: Error | null, rows?: unknown[]) => void) => void;
  close?: (callback: (err?: Error | null) => void) => void;
}

interface TDuckDbDatabaseLike extends TDuckDbConnectionLike {
  connect?: () => TDuckDbConnectionLike;
}

/**
 * Provides DuckDB storage and Parquet flush support for captured history samples.
 */
export class DuckDbParquetStorageService {
  private config: IDuckDbParquetStorageConfig = {
    engine: 'duckdb-parquet',
    databaseFile: 'plugin-config-data/kip/historicalData/kip-history.duckdb',
    parquetDirectory: 'plugin-config-data/kip/historicalData/parquet',
    flushIntervalMs: 30_000
  };

  // Weekly VACUUM job interval (in ms)
  private static readonly VACUUM_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
  private vacuumJob: NodeJS.Timeout | null = null;

  private logger: TLogger = {
    debug: () => undefined,
    error: () => undefined
  };

  private db: TDuckDbDatabaseLike | null = null;
  private connection: Required<TDuckDbConnectionLike> | null = null;
  private pendingRows: IRecordedSample[] = [];
  private pendingRangesBySeriesId = new Map<string, ISeriesRange>();
  private lastInitError: string | null = null;
  private lifecycleToken = 0;
  private initialized = false;

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
   * Applies plugin settings into the storage backend configuration.
   *
   * @param {unknown} settings Plugin settings payload from Signal K (ignored for fixed storage defaults).
   * @returns {IDuckDbParquetStorageConfig} Fixed storage configuration.
   *
   * @example
   * const cfg = storage.configure({});
   * console.log(cfg.engine);
   */
  public configure(settings: unknown): IDuckDbParquetStorageConfig {
    void settings;
    this.initialized = false;

    this.config = {
      engine: 'duckdb-parquet',
      databaseFile: 'plugin-config-data/kip/historicalData/kip-history.duckdb',
      parquetDirectory: 'plugin-config-data/kip/historicalData/parquet',
      flushIntervalMs: 30_000
    };

    return this.config;
  }

  /**
   * Initializes DuckDB storage if DuckDB engine is selected.
   *
   * @returns {Promise<boolean>} True when DuckDB is initialized and ready.
   *
   * @example
   * const ready = await storage.initialize();
   */
  public async initialize(): Promise<boolean> {
    if (!this.isDuckDbParquetEnabled()) {
      return false;
    }

    this.initialized = false;
    this.lifecycleToken += 1;

    try {
      const duckdbModule = duckdb;
      const dbPath = resolve(this.config.databaseFile);
      mkdirSync(dirname(dbPath), { recursive: true });
      mkdirSync(resolve(this.config.parquetDirectory), { recursive: true });

      this.db = new duckdbModule.Database(dbPath) as TDuckDbDatabaseLike;

      const maybeConnection = typeof this.db.connect === 'function'
        ? this.db.connect()
        : this.db;

      if (
        !maybeConnection
        || typeof maybeConnection.run !== 'function'
        || typeof maybeConnection.all !== 'function'
        || typeof maybeConnection.close !== 'function'
      ) {
        throw new Error('DuckDB connection API is unavailable in this runtime');
      }

      this.connection = maybeConnection as Required<TDuckDbConnectionLike>;
      await this.createCoreTables();
      const schemaCompatible = await this.isCompositeKeySchemaCompatible();
      if (!schemaCompatible) {
        const legacySeriesRows = await this.countRows('history_series');
        const legacySampleRows = await this.countRows('history_samples');
        await this.runSql('DROP TABLE IF EXISTS history_samples');
        await this.runSql('DROP TABLE IF EXISTS history_series');
        await this.createCoreTables();
        this.logger.debug(`[SERIES STORAGE] legacy schema reset: droppedAndRecreated=history_series,history_samples legacySeriesRows=${legacySeriesRows} legacySampleRows=${legacySampleRows}`);
      }
      await this.runSql('CREATE INDEX IF NOT EXISTS idx_history_series_scope_ts ON history_samples(user_scope, series_id, ts_ms)');
      await this.runSql('CREATE INDEX IF NOT EXISTS idx_history_series_scope_id ON history_series(user_scope, series_id)');
      await this.runSql('CREATE INDEX IF NOT EXISTS idx_history_samples_scope_context_path_ts ON history_samples(user_scope, context, path, ts_ms)');
      await this.runSql('CREATE INDEX IF NOT EXISTS idx_history_samples_scope_ts_path ON history_samples(user_scope, ts_ms, path)');
      await this.runSql('CREATE INDEX IF NOT EXISTS idx_history_samples_scope_ts_context ON history_samples(user_scope, ts_ms, context)');

      this.logger.debug(`[SERIES STORAGE] DuckDB initialized at ${dbPath}`);
      this.lastInitError = null;
      this.initialized = true;

      // Start weekly VACUUM job
      this.startVacuumJob();

      return true;
    } catch (error) {
      const message = (error as Error)?.message ?? String(error);
      this.lastInitError = message;
      this.logger.error(`[SERIES STORAGE] DuckDB initialization failed: ${message}`);
      this.logger.error('[SERIES STORAGE] DuckDB is required. Install runtime dependency with: npm i duckdb in the installed plugin directory, then restart Signal K.');
      this.connection = null;
      this.db = null;
      this.pendingRows = [];
      this.pendingRangesBySeriesId.clear();
      this.initialized = false;
      this.stopVacuumJob();
      return false;
    }
  }

  /**
   * Starts the weekly VACUUM job for DuckDB.
   */
  private startVacuumJob(): void {
    this.stopVacuumJob();
    if (!this.isDuckDbParquetReady() || !this.connection) return;
    this.vacuumJob = setInterval(() => {
      this.logger.debug('[SERIES STORAGE] Running scheduled DuckDB VACUUM');
      this.runSql('VACUUM;').catch(err => {
        this.logger.error(`[SERIES STORAGE] VACUUM failed: ${err?.message ?? err}`);
      });
    }, DuckDbParquetStorageService.VACUUM_INTERVAL_MS);
  }

  /**
   * Stops the scheduled VACUUM job if running.
   */
  private stopVacuumJob(): void {
    if (this.vacuumJob) {
      clearInterval(this.vacuumJob);
      this.vacuumJob = null;
    }
  }

  /**
   * Returns the active storage configuration.
   *
   * @returns {IDuckDbParquetStorageConfig} Current storage configuration.
   *
   * @example
   * const cfg = storage.getConfig();
   */
  public getConfig(): IDuckDbParquetStorageConfig {
    return this.config;
  }

  /**
   * Returns last DuckDB initialization error when initialization failed.
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
   * Indicates whether DuckDB/Parquet mode is selected.
   *
   * @returns {boolean} True when the selected engine is `duckdb-parquet`.
   *
   * @example
   * if (storage.isDuckDbParquetEnabled()) {
   *   console.log('DuckDB mode enabled');
   * }
   */
  public isDuckDbParquetEnabled(): boolean {
    return this.config.engine === 'duckdb-parquet';
  }

  /**
   * Indicates whether DuckDB/Parquet mode is initialized and ready.
   *
   * @returns {boolean} True when DuckDB mode is selected and an active connection exists.
   *
   * @example
   * if (storage.isDuckDbParquetReady()) {
   *   console.log('DuckDB ready');
   * }
   */
  public isDuckDbParquetReady(): boolean {
    return this.isDuckDbParquetEnabled() && this.initialized && this.connection !== null;
  }

  /**
   * Returns the current storage lifecycle token.
   *
   * The token changes whenever a new initialization attempt starts and can be
   * used by callers to scope async stop operations (flush/close) so stale work
   * does not affect a newer startup session.
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
    if (!this.isDuckDbParquetReady()) {
      return;
    }

    this.pendingRows.push(sample);
    const rangeKey = this.buildScopedSeriesKey(sample.userScope, sample.seriesId);
    const existing = this.pendingRangesBySeriesId.get(rangeKey);
    if (!existing) {
      this.pendingRangesBySeriesId.set(rangeKey, {
        userScope: this.normalizeUserScope(sample.userScope),
        seriesId: sample.seriesId,
        minTs: sample.timestamp,
        maxTs: sample.timestamp
      });
      return;
    }

    this.pendingRangesBySeriesId.set(rangeKey, {
      userScope: existing.userScope,
      seriesId: existing.seriesId,
      minTs: Math.min(existing.minTs, sample.timestamp),
      maxTs: Math.max(existing.maxTs, sample.timestamp)
    });
  }

  /**
   * Flushes queued samples into DuckDB and exports changed ranges to Parquet chunks.
   *
   * @returns {Promise<{inserted: number; exported: number}>} Number of inserted rows and exported parquet files.
   *
   * @example
   * const result = await storage.flush();
   */
  public async flush(expectedLifecycleToken?: number): Promise<{ inserted: number; exported: number }> {
    if (expectedLifecycleToken !== undefined && expectedLifecycleToken !== this.lifecycleToken) {
      return { inserted: 0, exported: 0 };
    }

    if (!this.isDuckDbParquetEnabled() || !this.connection || this.pendingRows.length === 0) {
      return { inserted: 0, exported: 0 };
    }

    const rows = this.pendingRows;
    const ranges = new Map(this.pendingRangesBySeriesId);
    this.pendingRows = [];
    this.pendingRangesBySeriesId.clear();

    try {
      await this.insertRows(rows);
      let exported = 0;
      for (const range of ranges.values()) {
        await this.exportSeriesRange(range.userScope, range.seriesId, range.minTs, range.maxTs);
        exported += 1;
      }
      return { inserted: rows.length, exported };
    } catch (error) {
      this.pendingRows = [...rows, ...this.pendingRows];
      ranges.forEach((range, rangeKey) => {
        const current = this.pendingRangesBySeriesId.get(rangeKey);
        if (!current) {
          this.pendingRangesBySeriesId.set(rangeKey, range);
          return;
        }
        this.pendingRangesBySeriesId.set(rangeKey, {
          userScope: current.userScope,
          seriesId: current.seriesId,
          minTs: Math.min(current.minTs, range.minTs),
          maxTs: Math.max(current.maxTs, range.maxTs)
        });
      });
      throw error;
    }
  }

  /**
   * Returns persisted series definitions from DuckDB.
   *
   * @returns {Promise<ISeriesDefinition[]>} Stored series definitions.
   *
   * @example
   * const series = await storage.getSeriesDefinitions();
   */
  public async getSeriesDefinitions(): Promise<ISeriesDefinition[]> {
    if (!this.isDuckDbParquetEnabled() || !this.connection) {
      return [];
    }

    const rows = await this.querySql<ISeriesRow>(`
      SELECT
        series_id,
        user_scope,
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
        methods_json
      FROM history_series
      ORDER BY user_scope ASC, series_id ASC
    `);

    return rows.map(row => ({
      seriesId: row.series_id,
      userScope: this.normalizeUserScope(row.user_scope),
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
      methods: this.parseMethods(row.methods_json)
    }));
  }

  /**
   * Persists one series definition in DuckDB.
   *
   * @param {ISeriesDefinition} series Series definition to persist.
   * @returns {Promise<void>}
   *
   * @example
   * await storage.upsertSeriesDefinition(series);
   */
  public async upsertSeriesDefinition(series: ISeriesDefinition): Promise<void> {
    if (!this.isDuckDbParquetEnabled() || !this.connection) {
      return;
    }

    const userScope = this.normalizeUserScope(series.userScope);
    await this.runSql(`DELETE FROM history_series WHERE user_scope = ${this.escape(userScope)} AND series_id = ${this.escape(series.seriesId)}`);
    await this.runSql(`
      INSERT INTO history_series (
        series_id,
        user_scope,
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
        methods_json
      ) VALUES (
        ${this.escape(series.seriesId)},
        ${this.escape(userScope)},
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
        ${series.enabled === false ? 'FALSE' : 'TRUE'},
        ${this.nullableString(series.methods ? JSON.stringify(series.methods) : null)}
      )
    `);
  }

  /**
   * Deletes one persisted series definition in DuckDB.
   *
   * @param {string} seriesId Series identifier.
   * @returns {Promise<void>}
   *
   * @example
   * await storage.deleteSeriesDefinition('series-1');
   */
  public async deleteSeriesDefinition(seriesId: string): Promise<void> {
    if (!this.isDuckDbParquetEnabled() || !this.connection) {
      return;
    }
    await this.runSql(`DELETE FROM history_series WHERE series_id = ${this.escape(seriesId)}`);
  }

  /**
   * Deletes one persisted series definition in DuckDB for a specific user scope.
   *
   * @param {string} seriesId Series identifier.
   * @param {string} userScope User scope key resolved by plugin auth.
   * @returns {Promise<void>}
   *
   * @example
   * await storage.deleteSeriesDefinitionForScope('series-1', 'demo-user');
   */
  public async deleteSeriesDefinitionForScope(seriesId: string, userScope: string): Promise<void> {
    if (!this.isDuckDbParquetEnabled() || !this.connection) {
      return;
    }
    await this.runSql(`
      DELETE FROM history_series
      WHERE user_scope = ${this.escape(this.normalizeUserScope(userScope))}
        AND series_id = ${this.escape(seriesId)}
    `);
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
    if (!this.isDuckDbParquetEnabled() || !this.connection) {
      return;
    }

    await this.runSql('DELETE FROM history_series');
    for (const item of series) {
      await this.upsertSeriesDefinition(item);
    }
  }

  /**
   * Replaces persisted series definitions for a specific user scope.
   *
   * @param {string} userScope User scope key resolved by plugin auth.
   * @param {ISeriesDefinition[]} series Full desired series set for the scope.
   * @returns {Promise<void>}
   *
   * @example
   * await storage.replaceSeriesDefinitionsForScope('demo-user', series);
   */
  public async replaceSeriesDefinitionsForScope(userScope: string, series: ISeriesDefinition[]): Promise<void> {
    if (!this.isDuckDbParquetEnabled() || !this.connection) {
      return;
    }

    const normalizedScope = this.normalizeUserScope(userScope);
    await this.runSql(`DELETE FROM history_series WHERE user_scope = ${this.escape(normalizedScope)}`);
    for (const item of series) {
      await this.upsertSeriesDefinition({
        ...item,
        userScope: normalizedScope
      });
    }
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
  public async pruneExpiredSamples(nowMs = Date.now(), expectedLifecycleToken?: number): Promise<number> {
    if (expectedLifecycleToken !== undefined && expectedLifecycleToken !== this.lifecycleToken) {
      return 0;
    }

    if (!this.isDuckDbParquetEnabled() || !this.connection) {
      return 0;
    }

    const anchorMs = Math.trunc(Number.isFinite(nowMs) ? nowMs : Date.now());
    const whereClause = `
      EXISTS (
        SELECT 1
        FROM history_series AS hs
        WHERE hs.user_scope = history_samples.user_scope
          AND hs.series_id = history_samples.series_id
          AND hs.retention_duration_ms IS NOT NULL
          AND hs.retention_duration_ms > 0
          AND history_samples.ts_ms < (${anchorMs} - hs.retention_duration_ms)
      )
    `;

    const countRows = await this.querySql<ICountRow>(`
      SELECT COUNT(*) AS removed_rows
      FROM history_samples
      WHERE ${whereClause}
    `);

    const removedRows = this.toNumberOrUndefined(countRows[0]?.removed_rows) ?? 0;
    if (removedRows <= 0) {
      return 0;
    }

    await this.runSql(`
      DELETE FROM history_samples
      WHERE ${whereClause}
    `);

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

    if (!this.isDuckDbParquetEnabled() || !this.connection) {
      return 0;
    }

    const whereClause = `
      NOT EXISTS (
        SELECT 1
        FROM history_series AS hs
        WHERE hs.user_scope = history_samples.user_scope
          AND hs.series_id = history_samples.series_id
      )
    `;

    const countRows = await this.querySql<ICountRow>(`
      SELECT COUNT(*) AS removed_rows
      FROM history_samples
      WHERE ${whereClause}
    `);

    const removedRows = this.toNumberOrUndefined(countRows[0]?.removed_rows) ?? 0;
    if (removedRows <= 0) {
      return 0;
    }

    await this.runSql(`
      DELETE FROM history_samples
      WHERE ${whereClause}
    `);

    return removedRows;
  }

  /**
   * Lists known history paths from persisted samples.
   *
   * @returns {Promise<string[]>} Ordered path names.
   *
   * @example
   * const paths = await storage.getStoredPaths();
   */
  public async getStoredPaths(query?: IHistoryRangeQuery): Promise<string[]> {
    if (!this.isDuckDbParquetEnabled() || !this.connection) {
      return [];
    }

    const userScope = this.normalizeUserScope(query?.userScope);
    const nowMs = Date.now();
    const range = this.resolveRange(nowMs, query?.from, query?.to, query?.duration);

    const rows = await this.querySql<IStringRow>(`
      SELECT DISTINCT path AS value
      FROM history_samples
      WHERE path IS NOT NULL
        AND user_scope = ${this.escape(userScope)}
        AND ts_ms >= ${Math.trunc(range.fromMs)}
        AND ts_ms <= ${Math.trunc(range.toMs)}
      ORDER BY value ASC
    `);
    return rows.map(row => row.value).filter(Boolean);
  }

  /**
   * Lists known history contexts from persisted samples.
   *
   * @returns {Promise<string[]>} Ordered context names.
   *
   * @example
   * const contexts = await storage.getStoredContexts();
   */
  public async getStoredContexts(query?: IHistoryRangeQuery): Promise<string[]> {
    if (!this.isDuckDbParquetEnabled() || !this.connection) {
      return [];
    }

    const userScope = this.normalizeUserScope(query?.userScope);
    const nowMs = Date.now();
    const range = this.resolveRange(nowMs, query?.from, query?.to, query?.duration);

    const rows = await this.querySql<IStringRow>(`
      SELECT DISTINCT context AS value
      FROM history_samples
      WHERE context IS NOT NULL
        AND user_scope = ${this.escape(userScope)}
        AND ts_ms >= ${Math.trunc(range.fromMs)}
        AND ts_ms <= ${Math.trunc(range.toMs)}
      ORDER BY value ASC
    `);
    return rows.map(row => row.value).filter(Boolean);
  }

  /**
   * Queries history values directly from DuckDB in History API-compatible shape.
   *
   * @param {IHistoryQueryParams} query Incoming history values query parameters.
   * @returns {Promise<IHistoryValuesResponse | null>} History payload when DuckDB is ready, otherwise null.
   *
   * @example
   * const result = await storage.getValues({ paths: 'navigation.speedOverGround:avg', duration: 'PT1H' });
   */
  public async getValues(query: IHistoryQueryParams): Promise<IHistoryValuesResponse | null> {
    if (!this.isDuckDbParquetEnabled() || !this.connection) {
      return null;
    }

    const userScope = this.normalizeUserScope(query.userScope);
    const nowMs = Date.now();
    const requested = this.parseRequestedPaths(query.paths);
    if (requested.length === 0) {
      return null;
    }

    const range = this.resolveRange(nowMs, query.from, query.to, query.duration);
    const context = query.context ?? 'vessels.self';
    const resolutionMs = this.resolveResolutionMs(query.resolution);
    const uniquePaths = Array.from(new Set(requested.map(item => item.path)));
    const rowsByPath = await this.selectRowsForPaths(uniquePaths, context, range.fromMs, range.toMs, userScope);

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
    if (!this.connection) {
      this.db = null;
      return;
    }

    const connection = this.connection;
    this.connection = null;

    await new Promise<void>((resolvePromise) => {
      connection.close(() => resolvePromise());
    });
    this.db = null;
  }

  private async createCoreTables(): Promise<void> {
    await this.runSql(`
      CREATE TABLE IF NOT EXISTS history_samples (
        user_scope VARCHAR NOT NULL,
        series_id VARCHAR,
        dataset_uuid VARCHAR,
        owner_widget_uuid VARCHAR,
        path VARCHAR,
        context VARCHAR,
        source VARCHAR,
        ts_ms BIGINT,
        value DOUBLE
      )
    `);
    await this.runSql(`
      CREATE TABLE IF NOT EXISTS history_series (
        user_scope VARCHAR NOT NULL,
        series_id VARCHAR NOT NULL,
        dataset_uuid VARCHAR NOT NULL,
        owner_widget_uuid VARCHAR NOT NULL,
        owner_widget_selector VARCHAR,
        path VARCHAR NOT NULL,
        source VARCHAR,
        context VARCHAR,
        time_scale VARCHAR,
        period INTEGER,
        retention_duration_ms BIGINT,
        sample_time INTEGER,
        enabled BOOLEAN,
        methods_json VARCHAR,
        PRIMARY KEY (user_scope, series_id)
      )
    `);
  }

  private async countRows(tableName: 'history_series' | 'history_samples'): Promise<number> {
    const rows = await this.querySql<ICountRow>(`SELECT COUNT(*) AS removed_rows FROM ${tableName}`);
    return this.toNumberOrUndefined(rows[0]?.removed_rows) ?? 0;
  }

  private async isCompositeKeySchemaCompatible(): Promise<boolean> {
    const seriesColumns = await this.querySql<ITableInfoRow>(`
      PRAGMA table_info('history_series')
    `);
    const samplesColumns = await this.querySql<ITableInfoRow>(`
      PRAGMA table_info('history_samples')
    `);

    const normalizedSeries = seriesColumns.map(column => ({
      name: String(column.name ?? '').trim().toLowerCase(),
      pk: Number(column.pk ?? 0)
    }));
    const normalizedSamples = samplesColumns.map(column => String(column.name ?? '').trim().toLowerCase());

    const seriesUserScopePk = normalizedSeries.some(column => column.name === 'user_scope' && column.pk > 0);
    const seriesIdPk = normalizedSeries.some(column => column.name === 'series_id' && column.pk > 0);
    const samplesHasUserScope = normalizedSamples.includes('user_scope');

    return seriesUserScopePk && seriesIdPk && samplesHasUserScope;
  }

  private async insertRows(rows: IRecordedSample[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const valuesSql = rows
      .map(sample => `(${this.escape(this.normalizeUserScope(sample.userScope))}, ${this.escape(sample.seriesId)}, ${this.escape(sample.datasetUuid)}, ${this.escape(sample.ownerWidgetUuid)}, ${this.escape(sample.path)}, ${this.escape(sample.context)}, ${this.escape(sample.source)}, ${Math.trunc(sample.timestamp)}, ${Number(sample.value)})`)
      .join(',\n');

    const sql = `
      INSERT INTO history_samples (
        user_scope,
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

    await this.runSql(sql);
  }

  private async exportSeriesRange(userScope: string, seriesId: string, fromMs: number, toMs: number): Promise<void> {
    const baseDir = resolve(this.config.parquetDirectory);
    const seriesDir = join(baseDir, this.safePath(this.normalizeUserScope(userScope)), this.safePath(seriesId));
    mkdirSync(seriesDir, { recursive: true });

    const filePath = join(seriesDir, `${fromMs}-${toMs}.parquet`);
    const escapedScope = this.escape(this.normalizeUserScope(userScope));
    const escapedSeries = this.escape(seriesId);
    const escapedFile = this.escapePath(filePath);

    const sql = `
      COPY (
        SELECT
          user_scope,
          series_id,
          dataset_uuid,
          owner_widget_uuid,
          path,
          context,
          source,
          ts_ms,
          to_timestamp(ts_ms / 1000.0) AS ts,
          value
        FROM history_samples
        WHERE user_scope = ${escapedScope}
          AND series_id = ${escapedSeries}
          AND ts_ms >= ${Math.trunc(fromMs)}
          AND ts_ms <= ${Math.trunc(toMs)}
        ORDER BY ts_ms
      ) TO '${escapedFile}' (FORMAT PARQUET)
    `;

    await this.runSql(sql);
  }

  private async runSql(sql: string): Promise<void> {
    if (!this.connection) {
      throw new Error('DuckDB connection is not initialized');
    }

    await new Promise<void>((resolvePromise, rejectPromise) => {
      this.connection?.run(sql, (error?: Error | null) => {
        if (error) {
          rejectPromise(error);
          return;
        }
        resolvePromise();
      });
    });
  }

  private async querySql<T>(sql: string): Promise<T[]> {
    if (!this.connection) {
      throw new Error('DuckDB connection is not initialized');
    }

    return new Promise<T[]>((resolvePromise, rejectPromise) => {
      this.connection?.all(sql, (error, rows) => {
        if (error) {
          rejectPromise(error);
          return;
        }
        resolvePromise((rows ?? []) as T[]);
      });
    });
  }

  private async selectRowsForPaths(paths: string[], context: string, fromMs: number, toMs: number, userScope: string): Promise<Map<string, IPathRow[]>> {
    const rowsByPath = new Map<string, IPathRow[]>();
    if (paths.length === 0) {
      return rowsByPath;
    }

    const pathFilter = paths.map(path => this.escape(path)).join(', ');
    const sql = `
      SELECT path, ts_ms, value
      FROM history_samples
      WHERE user_scope = ${this.escape(this.normalizeUserScope(userScope))}
        AND context = ${this.escape(context)}
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

  private safePath(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private buildScopedSeriesKey(userScope: string, seriesId: string): string {
    return `${this.normalizeUserScope(userScope)}::${seriesId}`;
  }

  private escape(value: string): string {
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  private escapePath(value: string): string {
    return String(value).replace(/'/g, "''");
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

  private normalizeUserScope(value: unknown): string {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized.length > 0 ? normalized : 'anonymous';
  }
}
