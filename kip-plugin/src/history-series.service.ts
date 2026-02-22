export type THistoryMethod = 'min' | 'max' | 'avg' | 'sma' | 'ema';

export interface ISeriesDefinition {
  seriesId: string;
  datasetUuid: string;
  ownerWidgetUuid: string;
  userScope?: string | null;
  ownerWidgetSelector?: string;
  path: string;
  source?: string | null;
  context?: string | null;
  timeScale?: string | null;
  period?: number | null;
  retentionDurationMs?: number | null;
  sampleTime?: number | null;
  enabled?: boolean;
  methods?: THistoryMethod[];
}

export interface IRecordedSeriesSample {
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

export interface IHistoryValuesResponse {
  context: string;
  range: {
    from: string;
    to: string;
  };
  values: {
    path: string;
    method?: THistoryMethod | 'avg';
  }[];
  data: (string | number | null)[][];
}

export interface IHistoryQueryParams {
  userScope?: string;
  paths: string;
  context?: string;
  from?: string;
  to?: string;
  duration?: string | number;
  resolution?: string | number;
}

/**
 * Manages history capture series definitions and serves History API-compatible query results.
 */
export class HistorySeriesService {
  private readonly seriesById = new Map<string, ISeriesDefinition>();
  private readonly lastAcceptedTimestampBySeriesKey = new Map<string, number>();
  private sampleSink: ((sample: IRecordedSeriesSample) => void) | null = null;

  constructor(
    private readonly nowProvider: () => number = () => Date.now(),
    private readonly retainSamplesInMemory = true
  ) {}

  /**
   * Returns all configured series sorted by `seriesId`.
   *
   * @returns Ordered list of series definitions.
   *
   * @example
   * const list = service.listSeries();
   * console.log(list.length);
   */
  public listSeries(): ISeriesDefinition[] {
    return Array.from(this.seriesById.values()).sort((left, right) => {
      const leftScope = this.normalizeUserScope(left.userScope);
      const rightScope = this.normalizeUserScope(right.userScope);
      const scopeCompare = leftScope.localeCompare(rightScope);
      if (scopeCompare !== 0) {
        return scopeCompare;
      }
      return left.seriesId.localeCompare(right.seriesId);
    });
  }

  /**
   * Returns all configured series for a given user scope sorted by `seriesId`.
   *
   * @param {string} userScope Scope key resolved by the plugin auth layer.
   * @returns {ISeriesDefinition[]} Ordered list for the scope.
   *
   * @example
   * const scoped = service.listSeriesForScope('demo-user');
   */
  public listSeriesForScope(userScope: string): ISeriesDefinition[] {
    const normalizedScope = this.normalizeUserScope(userScope);
    return this.listSeries().filter(series => this.normalizeUserScope(series.userScope) === normalizedScope);
  }

  /**
   * Finds a series by identifier within a specific user scope.
   *
   * @param {string} seriesId Series identifier.
   * @param {string} userScope Scope key resolved by the plugin auth layer.
   * @returns {ISeriesDefinition | null} Matching series or null.
   *
   * @example
   * const row = service.findSeriesByIdForScope('series-1', 'demo-user');
   */
  public findSeriesByIdForScope(seriesId: string, userScope: string): ISeriesDefinition | null {
    const key = this.buildSeriesMapKey(seriesId, userScope);
    return this.seriesById.get(key) ?? null;
  }

  /**
   * Creates or updates a series definition.
   *
   * @param {ISeriesDefinition} input The incoming series definition payload.
   * @returns {ISeriesDefinition} The normalized and stored series definition.
   *
   * @example
   * service.upsertSeries({
   *   seriesId: 'abc',
   *   datasetUuid: 'abc',
   *   ownerWidgetUuid: 'widget-1',
   *   path: 'navigation.speedOverGround'
   * });
   */
  public upsertSeries(input: ISeriesDefinition): ISeriesDefinition {
    const normalized = this.normalizeSeries(input);
    const key = this.buildSeriesMapKey(normalized.seriesId, normalized.userScope);
    this.seriesById.set(key, normalized);
    return normalized;
  }

  /**
   * Registers a callback invoked for every accepted sample.
   *
   * @param {(sample: IRecordedSeriesSample) => void | null} sink Callback used to forward samples to persistent storage.
   * @returns {void}
   *
   * @example
   * service.setSampleSink(sample => console.log(sample.seriesId));
   */
  public setSampleSink(sink: ((sample: IRecordedSeriesSample) => void) | null): void {
    this.sampleSink = sink;
  }

  /**
   * Deletes an existing series definition and all captured samples for the series.
   *
   * @param {string} seriesId Unique series identifier.
   * @returns {boolean} True when a series existed and was deleted.
   *
   * @example
   * const deleted = service.deleteSeries('abc');
   */
  public deleteSeries(seriesId: string): boolean {
    const keysToDelete = Array.from(this.seriesById.entries())
      .filter(([, series]) => series.seriesId === seriesId)
      .map(([key]) => key);

    if (keysToDelete.length === 0) {
      return false;
    }

    keysToDelete.forEach(key => {
      this.seriesById.delete(key);
      this.lastAcceptedTimestampBySeriesKey.delete(key);
    });

    return true;
  }

  /**
   * Deletes an existing series definition for a specific user scope.
   *
   * @param {string} seriesId Unique series identifier.
   * @param {string} userScope Scope key resolved by the plugin auth layer.
   * @returns {boolean} True when a scoped series existed and was deleted.
   *
   * @example
   * const deleted = service.deleteSeriesForScope('abc', 'demo-user');
   */
  public deleteSeriesForScope(seriesId: string, userScope: string): boolean {
    const key = this.buildSeriesMapKey(seriesId, userScope);
    const deleted = this.seriesById.delete(key);
    this.lastAcceptedTimestampBySeriesKey.delete(key);
    return deleted;
  }

  /**
   * Reconciles the entire desired series set against the current state.
   *
   * @param {ISeriesDefinition[]} desiredSeries Full desired series payload list.
   * @returns {{ created: number; updated: number; deleted: number; total: number }} Reconciliation summary.
   *
   * @example
   * const result = service.reconcileSeries([{ seriesId: 's1', datasetUuid: 's1', ownerWidgetUuid: 'w1', path: 'p' }]);
   * console.log(result.created, result.deleted);
   */
  public reconcileSeries(desiredSeries: ISeriesDefinition[]): { created: number; updated: number; deleted: number; total: number } {
    const desiredById = new Map<string, ISeriesDefinition>();
    desiredSeries.forEach(entry => {
      const normalized = this.normalizeSeries(entry);
      const key = this.buildSeriesMapKey(normalized.seriesId, normalized.userScope);
      desiredById.set(key, normalized);
    });

    let created = 0;
    let updated = 0;
    let deleted = 0;

    desiredById.forEach((desired, seriesKey) => {
      const existing = this.seriesById.get(seriesKey);
      if (!existing) {
        this.seriesById.set(seriesKey, desired);
        created += 1;
        return;
      }

      if (JSON.stringify(existing) !== JSON.stringify(desired)) {
        this.seriesById.set(seriesKey, desired);
        updated += 1;
      }
    });

    Array.from(this.seriesById.keys()).forEach(seriesKey => {
      if (!desiredById.has(seriesKey)) {
        this.seriesById.delete(seriesKey);
        this.lastAcceptedTimestampBySeriesKey.delete(seriesKey);
        deleted += 1;
      }
    });

    return {
      created,
      updated,
      deleted,
      total: this.seriesById.size
    };
  }

  /**
   * Records a single numeric sample for a configured series.
   *
   * @param {string} seriesId Unique series identifier.
   * @param {number} value Numeric sample value.
   * @param {number} timestamp Sample timestamp in milliseconds.
   * @returns {boolean} True when sample was accepted.
   *
   * @example
   * service.recordSample('abc', 12.4, Date.now());
   */
  public recordSample(seriesId: string, value: number, timestamp: number): boolean {
    const seriesEntry = Array.from(this.seriesById.entries())
      .find(([, series]) => series.seriesId === seriesId);
    if (!seriesEntry) {
      return false;
    }

    return this.recordSampleByKey(seriesEntry[0], value, timestamp);
  }

  private recordSampleByKey(seriesKey: string, value: number, timestamp: number): boolean {
    const series = this.seriesById.get(seriesKey);
    if (!series || series.enabled === false || !Number.isFinite(value) || !Number.isFinite(timestamp)) {
      return false;
    }

    const samplingIntervalMs = this.resolveSampleTimeMs(series.sampleTime);
    const previousTimestamp = this.lastAcceptedTimestampBySeriesKey.get(seriesKey);
    if (previousTimestamp !== undefined && (timestamp - previousTimestamp) < samplingIntervalMs) {
      return false;
    }

    const context = series.context ?? 'vessels.self';
    const source = series.source ?? 'default';

    this.sampleSink?.({
      userScope: this.normalizeUserScope(series.userScope),
      seriesId: series.seriesId,
      datasetUuid: series.datasetUuid,
      ownerWidgetUuid: series.ownerWidgetUuid,
      path: series.path,
      context,
      source,
      timestamp,
      value
    });
    this.lastAcceptedTimestampBySeriesKey.set(seriesKey, timestamp);
    return true;
  }

  /**
   * Records a sample based on a Signal K stream value by matching path/context/source against configured series.
   *
   * @param {{ path?: unknown; value?: unknown; timestamp?: unknown; context?: unknown; source?: unknown; $source?: unknown }} sample Signal K normalized value entry.
   * @returns {number} Number of configured series that accepted the sample.
   *
   * @example
   * const count = service.recordFromSignalKSample({ path: 'navigation.speedOverGround', value: 6.2, timestamp: new Date().toISOString() });
   */
  public recordFromSignalKSample(sample: { path?: unknown; value?: unknown; timestamp?: unknown; context?: unknown; source?: unknown; $source?: unknown }): number {
    const path = this.normalizePathIdentifier(typeof sample.path === 'string' ? sample.path : '');
    if (!path) {
      return 0;
    }

    const ts = this.resolveTimestamp(sample.timestamp);
    const context = typeof sample.context === 'string' && sample.context ? sample.context : 'vessels.self';
    const source = this.resolveSource(sample);
    const leafSamples = this.extractNumericLeafSamples(path, sample.value);

    if (leafSamples.length === 0) {
      return 0;
    }

    let recorded = 0;
    leafSamples.forEach(leaf => {
      this.seriesById.forEach((series, seriesKey) => {
        if (series.path !== leaf.path || series.enabled === false) {
          return;
        }

        const seriesContext = series.context ?? 'vessels.self';
        if (!this.isContextMatch(seriesContext, context)) {
          return;
        }

        const seriesSource = series.source ?? 'default';
        if (!this.isSourceMatch(seriesSource, source)) {
          return;
        }

        if (this.recordSampleByKey(seriesKey, leaf.value, ts)) {
          recorded += 1;
        }
      });
    });

    return recorded;
  }

  private extractNumericLeafSamples(basePath: string, value: unknown): { path: string; value: number }[] {
    const samples: { path: string; value: number }[] = [];

    const addNumeric = (samplePath: string, sampleValue: unknown): void => {
      const normalizedPath = this.normalizePathIdentifier(samplePath);
      if (!normalizedPath) {
        return;
      }

      const numericValue = Number(sampleValue);
      if (!Number.isFinite(numericValue)) {
        return;
      }

      samples.push({ path: normalizedPath, value: numericValue });
    };

    const walk = (currentPath: string, currentValue: unknown): void => {
      if (currentValue && typeof currentValue === 'object') {
        if (Array.isArray(currentValue)) {
          currentValue.forEach((entry, index) => {
            walk(`${currentPath}.${index}`, entry);
          });
          return;
        }

        Object.entries(currentValue as Record<string, unknown>).forEach(([key, child]) => {
          walk(`${currentPath}.${key}`, child);
        });
        return;
      }

      addNumeric(currentPath, currentValue);
    };

    walk(basePath, value);
    return samples;
  }



  /**
   * Returns all known history paths.
   *
   * @returns {string[]} Ordered unique path list.
   *
   * @example
   * const paths = service.getPaths();
   */
  public getPaths(): string[] {
    const paths = new Set<string>();
    this.seriesById.forEach(series => {
      paths.add(series.path);
    });
    return Array.from(paths).sort();
  }

  /**
   * Returns all known history contexts.
   *
   * @returns {string[]} Ordered unique context list.
   *
   * @example
   * const contexts = service.getContexts();
   */
  public getContexts(): string[] {
    const contexts = new Set<string>();
    this.seriesById.forEach(series => {
      contexts.add(series.context ?? 'vessels.self');
    });
    return Array.from(contexts).sort();
  }

  private normalizeSeries(input: ISeriesDefinition): ISeriesDefinition {
    const seriesId = (input.seriesId || input.datasetUuid || '').trim();
    if (!seriesId) {
      throw new Error('seriesId is required');
    }

    const datasetUuid = (input.datasetUuid || seriesId).trim();
    if (!datasetUuid) {
      throw new Error('datasetUuid is required');
    }

    const ownerWidgetUuid = (input.ownerWidgetUuid || '').trim();
    if (!ownerWidgetUuid) {
      throw new Error('ownerWidgetUuid is required');
    }

    const path = this.normalizePathIdentifier(input.path || '');
    if (!path) {
      throw new Error('path is required');
    }

    // Determine if this is a data chart based widget
    const dsSampleTime =
      ownerWidgetUuid?.startsWith('widget-windtrends-chart') ||
      ownerWidgetUuid?.startsWith('widget-data-chart');

    let sampleTime: number;
    const retentionMs = input.retentionDurationMs ?? this.resolveRetentionMs(input);
    if (dsSampleTime && Number.isFinite(retentionMs) && retentionMs > 0) {
      // regular widget sampleTime: 15 sec
      sampleTime = Math.max(1, Math.trunc(15000));
    } else {
      sampleTime = this.resolveSampleTimeMs(input.sampleTime);
    }

    return {
      ...input,
      seriesId,
      datasetUuid,
      ownerWidgetUuid,
      userScope: this.normalizeUserScope(input.userScope),
      path,
      source: input.source ?? 'default',
      context: input.context ?? 'vessels.self',
      enabled: input.enabled !== false,
      retentionDurationMs: retentionMs,
      sampleTime
    };
  }

  private resolveSampleTimeMs(sampleTime: unknown): number {
    const parsed = Number(sampleTime);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.trunc(parsed));
    }

    return 1000;
  }

  private normalizeUserScope(value: unknown): string {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized.length > 0 ? normalized : 'anonymous';
  }

  private buildSeriesMapKey(seriesId: string, userScope: unknown): string {
    return `${this.normalizeUserScope(userScope)}::${String(seriesId).trim()}`;
  }

  private resolveRetentionMs(series: ISeriesDefinition): number {
    if (Number.isFinite(series.retentionDurationMs as number) && (series.retentionDurationMs as number) > 0) {
      return series.retentionDurationMs as number;
    }

    const period = Number(series.period ?? 0);
    const scale = String(series.timeScale ?? '').toLowerCase();

    if (scale === 'last minute') return 60_000;
    if (scale === 'last 5 minutes') return 5 * 60_000;
    if (scale === 'last 30 minutes') return 30 * 60_000;
    if (scale === 'second') return Math.max(0, period) * 1_000;
    if (scale === 'minute') return Math.max(0, period) * 60_000;
    if (scale === 'hour') return Math.max(0, period) * 60 * 60_000;
    if (scale === 'day') return Math.max(0, period) * 24 * 60 * 60_000;

    return 24 * 60 * 60_000;
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

  private resolveTimestamp(timestamp: unknown): number {
    if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
      return timestamp;
    }

    if (typeof timestamp === 'string') {
      const parsed = Date.parse(timestamp);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return this.nowProvider();
  }

  private resolveSource(sample: { source?: unknown; $source?: unknown }): string {
    if (typeof sample.$source === 'string' && sample.$source.trim().length > 0) {
      return sample.$source;
    }

    if (typeof sample.source === 'string' && sample.source.trim().length > 0) {
      return sample.source;
    }

    if (sample.source && typeof sample.source === 'object') {
      const source = sample.source as Record<string, unknown>;
      const label = typeof source.label === 'string' ? source.label : '';
      const src = typeof source.src === 'string' || typeof source.src === 'number' ? String(source.src) : '';
      if (label && src) {
        return `${label}.${src}`;
      }
      if (label) {
        return label;
      }
    }

    return 'default';
  }

  private isContextMatch(seriesContext: string, sampleContext: string): boolean {
    if (seriesContext === sampleContext) {
      return true;
    }

    if (seriesContext === 'vessels.self') {
      return sampleContext === 'vessels.self' || sampleContext.startsWith('vessels.');
    }

    return false;
  }

  private isSourceMatch(seriesSource: string, sampleSource: string): boolean {
    if (seriesSource === '*' || seriesSource === 'any') {
      return true;
    }

    if (seriesSource === 'default') {
      return true;
    }

    if (!sampleSource) {
      return false;
    }

    return seriesSource === sampleSource;
  }
}
