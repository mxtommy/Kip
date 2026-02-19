export type THistoryMethod = 'min' | 'max' | 'avg' | 'sma' | 'ema';

export interface ISeriesDefinition {
  seriesId: string;
  datasetUuid: string;
  ownerWidgetUuid: string;
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

interface ISeriesSample {
  timestamp: number;
  value: number;
  path: string;
  source: string;
  context: string;
}

export interface IRecordedSeriesSample {
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
  private readonly samplesBySeriesId = new Map<string, ISeriesSample[]>();
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
    return Array.from(this.seriesById.values()).sort((left, right) => left.seriesId.localeCompare(right.seriesId));
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
    this.seriesById.set(normalized.seriesId, normalized);
    if (this.retainSamplesInMemory && !this.samplesBySeriesId.has(normalized.seriesId)) {
      this.samplesBySeriesId.set(normalized.seriesId, []);
    }
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
    const deleted = this.seriesById.delete(seriesId);
    if (this.retainSamplesInMemory) {
      this.samplesBySeriesId.delete(seriesId);
    }
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
      desiredById.set(normalized.seriesId, normalized);
    });

    let created = 0;
    let updated = 0;
    let deleted = 0;

    desiredById.forEach((desired, seriesId) => {
      const existing = this.seriesById.get(seriesId);
      if (!existing) {
        this.seriesById.set(seriesId, desired);
        if (this.retainSamplesInMemory) {
          this.samplesBySeriesId.set(seriesId, []);
        }
        created += 1;
        return;
      }

      if (JSON.stringify(existing) !== JSON.stringify(desired)) {
        this.seriesById.set(seriesId, desired);
        updated += 1;
      }
    });

    Array.from(this.seriesById.keys()).forEach(seriesId => {
      if (!desiredById.has(seriesId)) {
        this.seriesById.delete(seriesId);
        if (this.retainSamplesInMemory) {
          this.samplesBySeriesId.delete(seriesId);
        }
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
    const series = this.seriesById.get(seriesId);
    if (!series || series.enabled === false || !Number.isFinite(value) || !Number.isFinite(timestamp)) {
      return false;
    }

    const context = series.context ?? 'vessels.self';
    const source = series.source ?? 'default';
    if (this.retainSamplesInMemory) {
      const list = this.samplesBySeriesId.get(seriesId) ?? [];

      list.push({
        timestamp,
        value,
        path: series.path,
        source,
        context
      });

      if (list.length > 50_000) {
        list.splice(0, list.length - 50_000);
      }

      this.samplesBySeriesId.set(seriesId, list);
    }

    this.sampleSink?.({
      seriesId,
      datasetUuid: series.datasetUuid,
      ownerWidgetUuid: series.ownerWidgetUuid,
      path: series.path,
      context,
      source,
      timestamp,
      value
    });
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

    const value = Number(sample.value);
    if (!Number.isFinite(value)) {
      return 0;
    }

    const ts = this.resolveTimestamp(sample.timestamp);
    const context = typeof sample.context === 'string' && sample.context ? sample.context : 'vessels.self';
    const source = this.resolveSource(sample);

    let recorded = 0;
    this.seriesById.forEach(series => {
      if (series.path !== path || series.enabled === false) {
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

      if (this.recordSample(series.seriesId, value, ts)) {
        recorded += 1;
      }
    });

    return recorded;
  }

  /**
   * Runs retention cleanup across all series and drops expired samples.
   *
   * @param {number} [nowMs] Optional override for current time in milliseconds.
   * @returns {number} Number of sample rows removed.
   *
   * @example
   * const removed = service.runRetentionSweep(Date.now());
   */
  public runRetentionSweep(nowMs = this.nowProvider()): number {
    if (!this.retainSamplesInMemory) {
      return 0;
    }

    let removed = 0;

    this.seriesById.forEach((series, seriesId) => {
      const durationMs = this.resolveRetentionMs(series);
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        return;
      }

      const cutoff = nowMs - durationMs;
      const samples = this.samplesBySeriesId.get(seriesId);
      if (!samples || samples.length === 0) {
        return;
      }

      const originalLength = samples.length;
      const next = samples.filter(sample => sample.timestamp >= cutoff);
      removed += originalLength - next.length;
      this.samplesBySeriesId.set(seriesId, next);
    });

    return removed;
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

  /**
   * Returns a History API-compatible values response for the requested path expressions.
   *
   * @param {IHistoryQueryParams} query Incoming query parameters.
   * @returns {IHistoryValuesResponse} Response payload compatible with KIP history consumer.
   *
   * @example
   * const response = service.getValues({ paths: 'navigation.speedOverGround:avg', duration: 'PT1H' });
   */
  public getValues(query: IHistoryQueryParams): IHistoryValuesResponse {
    if (!this.retainSamplesInMemory) {
      throw new Error('In-memory history query engine is disabled.');
    }

    const nowMs = this.nowProvider();
    const requested = this.parseRequestedPaths(query.paths);
    const range = this.resolveRange(nowMs, query.from, query.to, query.duration);
    const context = query.context ?? 'vessels.self';
    const resolutionMs = this.resolveResolutionMs(query.resolution);

    const timestampRows = new Map<number, (number | null)[]>();
    requested.forEach((request, requestIndex) => {
      const samples = this.collectSamplesForRequest(request, context, range.fromMs, range.toMs);
      const transformed = this.applyMethod(request, samples);
      const merged = this.downsampleIfNeeded(transformed, resolutionMs, request.method ?? 'avg');
      merged.forEach(entry => {
        const row = timestampRows.get(entry.timestamp) ?? Array.from({ length: requested.length }, () => null);
        row[requestIndex] = entry.value;
        timestampRows.set(entry.timestamp, row);
      });
    });

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

    return {
      ...input,
      seriesId,
      datasetUuid,
      ownerWidgetUuid,
      path,
      source: input.source ?? 'default',
      context: input.context ?? 'vessels.self',
      enabled: input.enabled !== false,
      retentionDurationMs: input.retentionDurationMs ?? this.resolveRetentionMs(input)
    };
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

  private parseRequestedPaths(paths: string): IRequestedPath[] {
    return String(paths)
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean)
      .map(raw => {
        const [pathToken, maybeMethod, maybePeriod] = raw.split(':');
        const path = this.normalizePathIdentifier(pathToken);
        const method = this.parseMethod(maybeMethod);
        const period = maybePeriod !== undefined ? Number(maybePeriod) : undefined;
        return {
          path,
          method,
          period: Number.isFinite(period as number) ? period : undefined
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

  private collectSamplesForRequest(request: IRequestedPath, context: string, fromMs: number, toMs: number): ISeriesSample[] {
    const samples: ISeriesSample[] = [];
    this.seriesById.forEach((series, seriesId) => {
      if (series.path !== request.path) return;
      if ((series.context ?? 'vessels.self') !== context) return;

      const list = this.samplesBySeriesId.get(seriesId) ?? [];
      list.forEach(sample => {
        if (sample.timestamp < fromMs || sample.timestamp > toMs) return;
        samples.push(sample);
      });
    });

    return samples.sort((left, right) => left.timestamp - right.timestamp);
  }

  private applyMethod(request: IRequestedPath, samples: ISeriesSample[]): { timestamp: number; value: number | null }[] {
    const method = request.method ?? 'avg';
    if (samples.length === 0) return [];

    if (method === 'min') {
      return samples.map(entry => ({ timestamp: entry.timestamp, value: entry.value }));
    }
    if (method === 'max') {
      return samples.map(entry => ({ timestamp: entry.timestamp, value: entry.value }));
    }
    if (method === 'avg') {
      return samples.map(entry => ({ timestamp: entry.timestamp, value: entry.value }));
    }
    if (method === 'sma') {
      const period = Math.max(1, request.period ?? 5);
      return samples.map((entry, index) => {
        const start = Math.max(0, index - period + 1);
        const window = samples.slice(start, index + 1);
        const sum = window.reduce((acc, item) => acc + item.value, 0);
        return {
          timestamp: entry.timestamp,
          value: sum / window.length
        };
      });
    }

    // EMA
    const period = Math.max(1, request.period ?? 5);
    const multiplier = 2 / (period + 1);
    let previous: number | null = null;
    return samples.map(entry => {
      if (previous === null) {
        previous = entry.value;
      } else {
        previous = ((entry.value - previous) * multiplier) + previous;
      }
      return {
        timestamp: entry.timestamp,
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
}
