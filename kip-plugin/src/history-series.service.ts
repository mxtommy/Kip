import {
  IKipConcreteSeriesDefinition,
  IKipSeriesDefinition,
  isKipConcreteSeriesDefinition,
  isKipSeriesEnabled,
  isKipTemplateSeriesDefinition,
  THistoryMethod
} from '../../src/app/core/contracts/kip-series-contract';

export type ISeriesDefinition = IKipSeriesDefinition;
export type { THistoryMethod };
export { isKipConcreteSeriesDefinition, isKipSeriesEnabled, isKipTemplateSeriesDefinition };

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
  private readonly enabledSeriesKeysByPath = new Map<string, string[]>();
  private readonly lastAcceptedTimestampBySeriesKey = new Map<string, number>();
  private sampleSink: ((sample: IRecordedSeriesSample) => void) | null = null;

  constructor(
    private readonly nowProvider: () => number = () => Date.now(),
    private readonly selfContext: string | null = null
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
      return left.seriesId.localeCompare(right.seriesId);
    });
  }

  /**
  * Finds a series by identifier.
  *
  * @param {string} seriesId Series identifier.
  * @returns {ISeriesDefinition | null} Matching series or null.
  *
  * @example
  * const row = service.findSeriesById('series-1');
   */
  public findSeriesById(seriesId: string): ISeriesDefinition | null {
    return this.seriesById.get(seriesId) ?? null;
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
    const key = normalized.seriesId;
    this.seriesById.set(key, normalized);
    this.rebuildEnabledPathIndex();
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

    this.rebuildEnabledPathIndex();

    return true;
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
    const now = this.nowProvider();
    const desiredById = new Map<string, ISeriesDefinition>();
    desiredSeries.forEach(entry => {
      const normalized = this.normalizeSeries(entry);
      const key = normalized.seriesId;
      desiredById.set(key, normalized);
    });

    let created = 0;
    let updated = 0;
    let deleted = 0;

    desiredById.forEach((desired, seriesKey) => {
      const existing = this.seriesById.get(seriesKey);
      // Always update reconcile_ts on reconcile
      const desiredWithReconcile = { ...desired, reconcileTs: now };
      if (!existing) {
        this.seriesById.set(seriesKey, desiredWithReconcile);
        created += 1;
        return;
      }

      if (!this.areSeriesEquivalent(existing, desired)) {
        this.seriesById.set(seriesKey, desiredWithReconcile);
        updated += 1;
      } else {
        // Even if not updated, update reconcileTs
        this.seriesById.set(seriesKey, { ...existing, reconcileTs: now });
      }
    });

    Array.from(this.seriesById.keys()).forEach(seriesKey => {
      if (!desiredById.has(seriesKey)) {
        this.seriesById.delete(seriesKey);
        this.lastAcceptedTimestampBySeriesKey.delete(seriesKey);
        deleted += 1;
      }
    });

    this.rebuildEnabledPathIndex();

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
    if (!this.seriesById.has(seriesId)) {
      return false;
    }

    return this.recordSampleByKey(seriesId, value, timestamp);
  }

  private recordSampleByKey(seriesKey: string, value: number, timestamp: number): boolean {
    const series = this.seriesById.get(seriesKey);
    if (!series || series.enabled === false || !Number.isFinite(value) || !Number.isFinite(timestamp)) {
      return false;
    }

    const previousTimestamp = this.lastAcceptedTimestampBySeriesKey.get(seriesKey);
    // Enforces a minimum of 1 second to prevent excessive sampling on short retention durations
    const minSampleTime = Math.max(Number(series.sampleTime) || 0, 1000);
    if (previousTimestamp !== undefined && (timestamp - previousTimestamp) < minSampleTime) {
      return false;
    }

    const context = series.context ?? 'vessels.self';
    const source = series.source ?? 'default';

    this.sampleSink?.({
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
      const seriesKeys = this.enabledSeriesKeysByPath.get(leaf.path);
      if (!seriesKeys || seriesKeys.length === 0) {
        return;
      }

      seriesKeys.forEach(seriesKey => {
        const series = this.seriesById.get(seriesKey);
        if (!series) {
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

  private rebuildEnabledPathIndex(): void {
    this.enabledSeriesKeysByPath.clear();

    this.seriesById.forEach((series, seriesKey) => {
      if (series.enabled === false) {
        return;
      }

      const keys = this.enabledSeriesKeysByPath.get(series.path) ?? [];
      keys.push(seriesKey);
      this.enabledSeriesKeysByPath.set(series.path, keys);
    });
  }

  private areSeriesEquivalent(left: ISeriesDefinition, right: ISeriesDefinition): boolean {
    const leftComparable = this.toComparableSeries(left);
    const rightComparable = this.toComparableSeries(right);

    return leftComparable.seriesId === rightComparable.seriesId
      && leftComparable.datasetUuid === rightComparable.datasetUuid
      && leftComparable.ownerWidgetUuid === rightComparable.ownerWidgetUuid
      && leftComparable.ownerWidgetSelector === rightComparable.ownerWidgetSelector
      && leftComparable.path === rightComparable.path
      && leftComparable.expansionMode === rightComparable.expansionMode
      && this.areStringArraysEquivalent(leftComparable.allowedBatteryIds, rightComparable.allowedBatteryIds)
      && leftComparable.source === rightComparable.source
      && leftComparable.context === rightComparable.context
      && leftComparable.timeScale === rightComparable.timeScale
      && leftComparable.period === rightComparable.period
      && leftComparable.retentionDurationMs === rightComparable.retentionDurationMs
      && leftComparable.sampleTime === rightComparable.sampleTime
      && leftComparable.enabled === rightComparable.enabled
      && this.areStringArraysEquivalent(leftComparable.methods, rightComparable.methods);
  }

  private toComparableSeries(series: ISeriesDefinition): Omit<ISeriesDefinition, 'reconcileTs'> {
    const { reconcileTs, ...comparable } = series;
    void reconcileTs;
    return {
      ...comparable,
      allowedBatteryIds: this.normalizeComparableStringArray(comparable.allowedBatteryIds),
      methods: this.normalizeComparableStringArray(comparable.methods)
    };
  }

  private areStringArraysEquivalent<T extends string>(left?: ReadonlyArray<T> | null, right?: ReadonlyArray<T> | null): boolean {
    const normalizedLeft = this.normalizeComparableStringArray(left) ?? [];
    const normalizedRight = this.normalizeComparableStringArray(right) ?? [];

    if (normalizedLeft.length !== normalizedRight.length) {
      return false;
    }

    return normalizedLeft.every((value, index) => value === normalizedRight[index]);
  }

  private normalizeComparableStringArray<T extends string>(values?: ReadonlyArray<T> | null): T[] | undefined {
    if (!Array.isArray(values) || values.length === 0) {
      return undefined;
    }

    return [...values]
      .filter((value): value is T => typeof value === 'string')
      .sort((left, right) => left.localeCompare(right));
  }

  private isChartWidget(ownerWidgetSelector: string | null, ownerWidgetUuid?: string): boolean {
    if (ownerWidgetSelector === 'widget-data-chart' || ownerWidgetSelector === 'widget-windtrends-chart') {
      return true;
    }

    return ownerWidgetUuid?.startsWith('widget-windtrends-chart') === true
      || ownerWidgetUuid?.startsWith('widget-data-chart') === true;
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

    const ownerWidgetSelector = typeof input.ownerWidgetSelector === 'string' ? input.ownerWidgetSelector.trim() : null;
    const expansionMode = input.expansionMode ?? null;
    if (expansionMode === 'bms-battery-tree' && ownerWidgetSelector !== 'widget-bms') {
      throw new Error('BMS template series must use ownerWidgetSelector "widget-bms"');
    }

    const normalizedMethods = this.normalizeComparableStringArray(input.methods);
    const normalizedAllowedBatteryIds = expansionMode === 'bms-battery-tree'
      ? this.normalizeComparableStringArray(input.allowedBatteryIds)
      : undefined;

    const isDataWidget = this.isChartWidget(ownerWidgetSelector, ownerWidgetUuid);
    const retentionMs = this.resolveRetentionMs(input);
    let sampleTime: number;

    if (isDataWidget) {
      // For chart type widgets we use retention duration to dynamically calculate sampleTime to
      // aims for around 120 samples.
      sampleTime = retentionMs ? Math.max(1000, Math.round(retentionMs / 120)) : 1000;
    } else {
      // Non chart type widgets, ie historical Time-Series, have a fixed sampleTime of 15 sec that is
      // a good median amount of samples for the dynamically queryable chart display range (15 min up to 24h).
      sampleTime = 15000; // ms
    }

    const normalizedBase = {
      seriesId,
      datasetUuid,
      ownerWidgetUuid,
      ownerWidgetSelector,
      path,
      source: input.source ?? 'default',
      context: input.context ?? 'vessels.self',
      timeScale: input.timeScale ?? null,
      period: Number.isFinite(input.period as number) ? input.period ?? null : null,
      enabled: input.enabled !== false,
      retentionDurationMs: retentionMs,
      sampleTime,
      methods: normalizedMethods,
      reconcileTs: input.reconcileTs
    };

    if (expansionMode === 'bms-battery-tree') {
      return {
        ...normalizedBase,
        ownerWidgetSelector: 'widget-bms',
        expansionMode,
        allowedBatteryIds: normalizedAllowedBatteryIds ?? null
      };
    }

    const concreteSeries: IKipConcreteSeriesDefinition = {
      ...normalizedBase,
      expansionMode: null,
      allowedBatteryIds: null
    };

    return concreteSeries;
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

    if (this.isSelfContext(seriesContext) && this.isSelfContext(sampleContext)) {
      return true;
    }

    return false;
  }

  private isSelfContext(context: string): boolean {
    if (context === 'vessels.self') {
      return true;
    }

    return !!this.selfContext && context === this.selfContext;
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
