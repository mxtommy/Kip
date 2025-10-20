import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subscription, Observable, ReplaySubject, MonoTypeOperatorFunction, interval, withLatestFrom, concat, skip, from } from 'rxjs';
import { AppSettingsService } from './app-settings.service';
import { DataService, IPathUpdate } from './data.service';
import { UUID } from '../utils/uuid.util'
import { cloneDeep } from 'lodash-es';
import { NgGridStackWidget } from 'gridstack/dist/angular';


export interface IDatasetServiceDatapoint {
  timestamp: number;
  data: {
    value: number;
    sma?: number; // Simple Moving Average
    ema?: number; // Exponential Moving Average - A better Moving Average calculation than Simple Moving Average
    doubleEma?: number; // Double Exponential Moving Average - Moving Average that is even more reactive to data variation then EMA. Suitable for wind and angle average calculations
    lastAngleAverage?: number;
    lastAverage?: number; // Computed from the latest historicalData.
    lastMinimum?: number;
    lastMaximum?: number;
  }
}

export type TimeScaleFormat = "hour" | "minute" | "second" | "Last Minute" | "Last 5 Minutes" | "Last 30 Minutes";

export interface IDatasetServiceDatasetConfig {
  uuid: string;
  path: string;
  pathSource: string;
  baseUnit: string;         // The path's Signal K base unit type
  timeScaleFormat: TimeScaleFormat;  // Dataset time scale measure.
  period: number;           // Number of datapoints to capture.
  label: string;           // label of the historicalData
  editable?: boolean;       // Whether the dataset is editable, or created with Widgets and not editable by user
};

export interface IDatasetServiceDataSourceInfo {
  sampleTime: number;       // DataSource Observer's path value sampling rate in milliseconds. ie. How often we get data from Signal K.
  maxDataPoints: number;    // How many data points do we keep for that timescale
  smoothingPeriod: number;  // Number of previous plus current value to use as the moving average
};

interface IDatasetServiceDataSource extends IDatasetServiceDataSourceInfo {
  uuid: string;
  pathObserverSubscription: Subscription;
  historicalData: number[];
};
interface IDatasetServiceObserverRegistration {
  datasetUuid: string;
  rxjsSubject: ReplaySubject<IDatasetServiceDatapoint>;
}

// How to interpret angular (radian) data
type AngleDomain = 'scalar' | 'direction' | 'signed';

@Injectable({
  providedIn: 'root'
})
export class DatasetService implements OnDestroy {
  private appSettings = inject(AppSettingsService);
  private data = inject(DataService);

  private _svcDatasetConfigs: IDatasetServiceDatasetConfig[] = [];
  private _svcDataSource: IDatasetServiceDataSource[] = [];
  private _svcSubjectObserverRegistry: IDatasetServiceObserverRegistration[] = [];

  // List of Signal K paths that should be interpreted as signed angles (-π, π].
  // Add your specific paths here. All other radian paths will default to direction domain [0, 2π).
  private readonly signedAnglePaths = new Set<string>([
    "self.navigation.attitude.roll",
    "self.navigation.attitude.pitch",
    "self.navigation.attitude.yaw",
    "self.environment.wind.angleApparent",
    "self.environment.wind.angleTrueGround",
    "self.environment.wind.angleTrueWater",
    "self.steering.rudderAngle"
  ]);

  constructor() {
    this._svcDatasetConfigs = this.appSettings.getDataSets();
    this.cleanupDatasets();
    this.startAll();
  }

  private cleanupDatasets(): void {
    if (this.appSettings.configUpgrade()) return; // Cleanup not needed if configUpgrade is enabled/required
    const cfgVersion = this.appSettings.getAppConfig().configVersion;
    if (cfgVersion < 12) return; // Cleanup only needed for versions 12 or greater

    const dashboards = this.appSettings.getDashboardConfig();

    // Collect all widget IDs from all dashboards
    const widgetIds = new Set<string>();

    dashboards.forEach(dash => {
      if (dash.configuration?.length) {
        dash.configuration?.forEach((widget: NgGridStackWidget) => {
          if (widget?.id) widgetIds.add(widget.id);
        });
      }
    });

    // Helper to extract windtrends/speedtrends uuid from label
    function extractTrendsUuid(label: string): string | null {
      const match = label.match(/^(windtrends|speedtrends)-(.+)$/);
      return match ? match[2] : null;
    }

    // Track removed datasets for logging
    const removed: IDatasetServiceDatasetConfig[] = [];

    // Filter datasets, collecting those removed
    const filtered = [];
    for (const ds of this._svcDatasetConfigs) {
      const label = ds.label || "";
      let keep = false;

      if (label.startsWith("windtrends-") || label.startsWith("speedtrends-")) {
        const trendsUuid = extractTrendsUuid(label);
        keep = !!(trendsUuid && widgetIds.has(trendsUuid));
      } else if (label.startsWith("simple-chart-")) {
        keep = widgetIds.has(ds.uuid);
      } else if ((label.match(/\|/g) || []).length === 4) {
        keep = widgetIds.has(ds.uuid);
      }

      if (keep) {
        filtered.push(ds);
      } else {
        removed.push(ds);
      }
    }

    if (removed.length) {
      removed.forEach(ds => {
        console.warn(`[DatasetService] Cleaned dataset: uuid=${ds.uuid}, label="${ds.label}"`);
      });
      this._svcDatasetConfigs = filtered;
      this.appSettings.saveDataSets(this._svcDatasetConfigs);
    }
  }

  /**
   * Registers the historicalData Subject. To enable historicalData subscribers to automatically receive all of the
   * historicalData's past recorded data, a ReplaySubject is used and configured to emit the latest
   * historicalData values.
   *
   * @private
   * @param {string} uuid
   * @memberof DatasetService
   */
  private setupServiceSubjectRegistry(uuid: string, replayDatapoints: number): void {
    const entryIndex = this._svcSubjectObserverRegistry.findIndex(entry => entry.datasetUuid == uuid);

    if (entryIndex >= 0) {
      this._svcSubjectObserverRegistry[entryIndex].rxjsSubject.complete();
      this._svcSubjectObserverRegistry.splice(entryIndex, 1);
    }

    this._svcSubjectObserverRegistry.push({
      datasetUuid: uuid,
      rxjsSubject: new ReplaySubject(replayDatapoints)
    });
  }

  private createDataSourceConfiguration(dsConf: IDatasetServiceDatasetConfig): IDatasetServiceDataSource {
    const smoothingPeriodFactor = 0.25;
    const newDataSourceConfiguration: IDatasetServiceDataSource = {
      uuid: dsConf.uuid,
      pathObserverSubscription: null,
      sampleTime: null,
      maxDataPoints: null,
      smoothingPeriod: null,
      historicalData: []
    }

    switch (dsConf.timeScaleFormat) {
      case "Last 30 Minutes":
        newDataSourceConfiguration.maxDataPoints = 120; // 30 min * sampleTime
        newDataSourceConfiguration.sampleTime = 15000; // 15 seconds
        newDataSourceConfiguration.smoothingPeriod = 50; // moving average points to use
        break;

      case "Last 5 Minutes":
        newDataSourceConfiguration.maxDataPoints = 60; // 5 min * sampleTime
        newDataSourceConfiguration.sampleTime = 5000; // 5 seconds
        newDataSourceConfiguration.smoothingPeriod = 25; // moving average points to use
        break;

      case "Last Minute":
        newDataSourceConfiguration.maxDataPoints = 60; // 1 min * sampleTime
        newDataSourceConfiguration.sampleTime = 1000; // 1 second
        newDataSourceConfiguration.smoothingPeriod = 25; // moving average points to use
        break;

      case "hour":
        newDataSourceConfiguration.maxDataPoints = dsConf.period * 120; // hours * 60 min
        newDataSourceConfiguration.sampleTime = 30000; // 30 seconds
        newDataSourceConfiguration.smoothingPeriod = Math.floor(newDataSourceConfiguration.maxDataPoints * smoothingPeriodFactor); // moving average points to use
        break;

      case "minute":
        newDataSourceConfiguration.maxDataPoints = dsConf.period * 60; // minutes * 60 sec
        newDataSourceConfiguration.sampleTime = 1000; // 1 second
        newDataSourceConfiguration.smoothingPeriod = Math.floor(newDataSourceConfiguration.maxDataPoints * smoothingPeriodFactor); // moving average points to use
        break;

      default:
        newDataSourceConfiguration.maxDataPoints = dsConf.period * 5; // 5 times per second
        newDataSourceConfiguration.sampleTime = 200;
        newDataSourceConfiguration.smoothingPeriod = Math.floor(newDataSourceConfiguration.maxDataPoints * smoothingPeriodFactor); // moving average points to use
        break;
    }

    // Enforce minimum of 1 for maxDataPoints to prevent infinite size array
    if (!newDataSourceConfiguration.maxDataPoints || newDataSourceConfiguration.maxDataPoints < 1) {
      newDataSourceConfiguration.maxDataPoints = 1;
    }

    return newDataSourceConfiguration;
  }

  /**
   * Start all Dataset Service's _svcDatasetConfigs
   *
   * @memberof DataSetService
   */
  private startAll(): void {
    console.log("[Dataset Service] Auto Starting " + this._svcDatasetConfigs.length.toString() + " Datasets");
    for (const config of this._svcDatasetConfigs) {
      this.start(config.uuid);
    }
  }

  /**
   * Starts the recording process of a Data Source. It firsts reads the historicalData configuration,
   * then starts building the historicalData values, and pushes them to the Subject.
   *
   * This method handles the process that takes SK data and feeds the Subject. Clients/Observers,
   * (widgets mostly), will use the getDatasetObservable() method to receive data from the Subject.
   *
   * Concept: SK_path_values -> datasource -> (ReplaySubject) <- Widget observers
   *
   * Once a datasource is started, subscribers will receive historical data (equal to the
   * length of the dataset)pushed to the Subject, as as future data.
   *
   * @private
   * @param {string} uuid The UUID of the DataSource to start
   * @return {*}  {void}
   * @memberof DataSetService
   */
  private start(uuid: string): void {
    const configuration = this._svcDatasetConfigs.find(configuration => configuration.uuid == uuid);
    if (!configuration) {
      console.warn(`[Dataset Service] Dataset UUID:${uuid} not found`);
      return;
    }

    const newDataSourceConfig: IDatasetServiceDataSource = this.createDataSourceConfiguration(configuration);
    this.setupServiceSubjectRegistry(newDataSourceConfig.uuid, newDataSourceConfig.maxDataPoints);
    const dataSource = this._svcDataSource[this._svcDataSource.push(newDataSourceConfig) - 1];

    console.log(`[Dataset Service] Starting recording process: ${configuration.path}, Scale: ${configuration.timeScaleFormat}, Period: ${configuration.period}, Datapoints: ${newDataSourceConfig.maxDataPoints}`);

    // Emit at a regular interval using the last value. We use this and not sampleTime() to make sure that if there is no new data, we still send the last know value. This is to prevent dataset blanks that look ugly on the chart
    function sampleInterval<IPathData>(period: number): MonoTypeOperatorFunction<IPathData> {
      return (source) => interval(period).pipe(withLatestFrom(source, (_, value) => value));
    };

    // Decide how to interpret the dataset values (scalar vs radian domains)
    const angleDomain = this.resolveAngleDomain(configuration.path, configuration.baseUnit);

    // Subscribe to path data, update historicalData/stats and sends new values to Observers
    dataSource.pathObserverSubscription = this.data.subscribePath(configuration.path, configuration.pathSource).pipe(sampleInterval(newDataSourceConfig.sampleTime)).subscribe(
      (newValue: IPathUpdate) => {
        if (newValue.data.value === null) return; // we don't need null values

        // Keep the array to specified size before adding new value
        if (dataSource.maxDataPoints > 0 && dataSource.historicalData.length >= dataSource.maxDataPoints) {
          dataSource.historicalData.shift();
        }
        dataSource.historicalData.push(newValue.data.value);

        // Add new datapoint to historicalData
        const datapoint: IDatasetServiceDatapoint = this.updateDataset(dataSource, configuration.baseUnit, angleDomain);
        // Copy object new datapoint so it's not send by reference, then push to Subject so that Observers can receive
        this._svcSubjectObserverRegistry.find(registration => registration.datasetUuid === dataSource.uuid).rxjsSubject.next(datapoint);
      }
    );
  }

  /**
   * Stops the recording process of a DataSource (unsubscribes from the Subject). This will stop
   * the processing of SK path data into the historicalData. Stop will not complete the Subject so that
   * if the process is restarted, observers (widgets) will automatically start to receive data.
   *
   * @private
   * @param {string} uuid The UUID of the DataSource to stop
   * @memberof DataSetService
   */
  private stop(uuid: string) {
    const dsIndex = this._svcDataSource.findIndex(d => d.uuid == uuid);
    console.log(`[Dataset Service] Stopping Dataset ${uuid} data capture`);
    this._svcDataSource[dsIndex].pathObserverSubscription.unsubscribe();
    this._svcDataSource.splice(dsIndex, 1);
  }

  /**
   * Returns a copy of all existing dataset configurations
   *
   * @return {*}  {IDatasetServiceDatasetConfig[]} Arrays of all historicalData configurations
   * @memberof DataSetService
   */
  public list(): IDatasetServiceDatasetConfig[] {
    return cloneDeep(this._svcDatasetConfigs);
  }

  /**
   * Returns a copy of a dataset configuration.
   *
   * @param {string} uuid The UUID of the desired historicalData
   * @return {*}  {IDatasetServiceDatasetConfig} A Dataset configuration object
   * @memberof DatasetService
   */
  public getDatasetConfig(uuid: string): IDatasetServiceDatasetConfig {
    return this._svcDatasetConfigs.find(config => config.uuid === uuid);
  }

  /**
   * Returns information on the Data Source configuration.
   *
   * @param {string} uuid The UUID of the desired Data Source
   * @return {*}  {IDatasetServiceDatasetConfig} A data Source configuration object
   * @memberof DatasetService
   */
  public getDataSourceInfo(uuid: string): IDatasetServiceDataSourceInfo {
    return this._svcDataSource.find(config => config.uuid === uuid);
  }

  /**
   * Creates a new historicalData and starts the data capture process.
   *
   * @param {string} path Signal K path of the data to record
   * @param {string} source The path's chosen source
   * @param {TimeScaleFormat} timeScaleFormat The duration of the historicalData: "hour", "minute", "second". See {@link TimeScaleFormat}
   * @param {number} period The number of data points to capture. For example, if the timeScaleFormat is "hour" and period is 60, then 60 data points will be captured for the hour.
   * @param {string} label Name of the historicalData
   * @param {boolean} [serialize] If true, the dataset configuration will be persisted to application settings. If set to false, dataset will not be present in the configuration on app restart. Defaults to true.
   * @param {boolean} [editable]  DEPRECATED -If true, the dataset configuration can be edited by the user. Defaults to true. // TODO: remove this param once Dataset management component is not required anymore
   * @param {string} [forced_id] If provided, this ID will be used instead of generating a new UUID. Useful for testing or when you want to ensure a specific ID is used.
   * @returns {string} The ID of the newly created dataset configuration
   * @memberof DataSetService
   */
  public create(path: string, source: string, timeScaleFormat: TimeScaleFormat, period: number, label: string, serialize = true, editable = true, forced_id?: string): string | null {
    if (!path || !source || !timeScaleFormat || !period || !label) return null;
    const uuid = forced_id || UUID.create();

    const newSvcDataset: IDatasetServiceDatasetConfig = {
      uuid: uuid,
      path: path,
      pathSource: source,
      baseUnit: this.data.getPathUnitType(path),
      timeScaleFormat: timeScaleFormat,
      period: period,
      label: label,
      editable: editable
    };

    console.log(`[Dataset Service] Creating ${serialize ? '' : 'non-'}persistent ${editable ? '' : 'hidden '}dataset: ${newSvcDataset.uuid}, Path: ${newSvcDataset.path}, Source: ${newSvcDataset.pathSource} Scale: ${newSvcDataset.timeScaleFormat}, Period: ${newSvcDataset.period}`);

    this._svcDatasetConfigs.push(newSvcDataset);

    this.start(uuid);
    if (serialize === true) this.appSettings.saveDataSets(this._svcDatasetConfigs);
    return uuid;
  }

  /**
   * Updates an existing dataset configuration and persists the changes to application settings.
   *
   * - If the dataset with the given UUID does not exist, returns false.
   * - If the configuration has not changed, returns false and avoids unnecessary restart.
   * - Otherwise, stops the current dataset, updates its configuration, restarts it, and saves all configs.
   *
   * @param {IDatasetServiceDatasetConfig} datasetConfig The updated dataset configuration object.
   * @returns {boolean} True if the dataset was updated and restarted, false if not found or unchanged.
   * @memberof DatasetService
   */
  public edit(datasetConfig: IDatasetServiceDatasetConfig, serialize = true): boolean {
    const existingConfig = this._svcDatasetConfigs.find(conf => conf.uuid === datasetConfig.uuid);
    if (!existingConfig) {
      return false; // Dataset not found
    }
    if (JSON.stringify(existingConfig) === JSON.stringify(datasetConfig)) {
      console.log(`[Dataset Service] No changes detected for Dataset ${datasetConfig.uuid}.`);
      return false; // Avoid unnecessary stop/start
    }

    this.stop(datasetConfig.uuid);
    console.log(`[Dataset Service] Updating Dataset: ${datasetConfig.uuid}`);
    datasetConfig.baseUnit = this.data.getPathUnitType(datasetConfig.path);
    this._svcDatasetConfigs.splice(this._svcDatasetConfigs.findIndex(conf => conf.uuid === datasetConfig.uuid), 1, datasetConfig);

    this.start(datasetConfig.uuid);
    if (serialize === true) this.appSettings.saveDataSets(this._svcDatasetConfigs);
    return true;
  }

  /**
   * Removes a dataset and all associated resources from the DatasetService.
   *
   * - Stops the data source recording process for the given UUID.
   * - Deletes the dataset configuration and removes it from the service registry.
   * - Completes the Subject so that all observers (widgets) terminate their subscriptions.
   * - Optionally persists the removal to application settings (default: true).
   *
   * @param {string} uuid The UUID of the dataset to remove.
   * @param {boolean} [serialize=true] If true, the removal is persisted to application settings. If false, the dataset will reappear on app restart.
   * @returns {boolean} True if the dataset was found and removed, false otherwise.
   * @memberof DatasetService
   */
  public remove(uuid: string, serialize = true): boolean {
    if (!uuid || uuid === "" || this._svcDatasetConfigs.findIndex(c => c.uuid === uuid) === -1) return false;

    this.stop(uuid);
    console.log(`[Dataset Service] Removing ${serialize ? '' : 'non-'}persistent Dataset: ${uuid}`);
    // Clean service data entries
    this._svcDatasetConfigs.splice(this._svcDatasetConfigs.findIndex(c => c.uuid === uuid), 1);
    // stop Subject Observers
    this._svcSubjectObserverRegistry.find(r => r.datasetUuid === uuid).rxjsSubject.complete();
    this._svcSubjectObserverRegistry.splice(this._svcSubjectObserverRegistry.findIndex(r => r.datasetUuid === uuid), 1);

    if (serialize === true) this.appSettings.saveDataSets(this._svcDatasetConfigs);
    return true;
  }

  /**
   * Returns an Observable for the historicalData UUID or null if not found. Clients (widget) can use
   * subscribe() to start receiving historicalData data.
   *
   * @param {string} dataSetUuid The UUID is the historicalData
   * @return {*}  {Observable<IDatasetServiceDatapoint> | null} Observable of data point array or null if not found
   * @memberof DataSetService
   */
  public getDatasetObservable(dataSetUuid: string): Observable<IDatasetServiceDatapoint> | null {
    const registration = this._svcSubjectObserverRegistry.find(registration => registration.datasetUuid == dataSetUuid);

    if (registration) {
      return registration.rxjsSubject.asObservable();
    }

    return null;
  }

  /**
   * Returns an observable that emits a batch of the last N datapoints as an array,
   * then continues emitting live datapoints one by one.
   *
   * @param {string} dataSetUuid The UUID of the dataset
   * @param {number} batchSize The number of datapoints to batch for new subscribers
   * @returns {Observable<IDatasetServiceDatapoint[] | IDatasetServiceDatapoint>}
   */
  public getDatasetBatchThenLiveObservable(
    dataSetUuid: string
  ): Observable<IDatasetServiceDatapoint[] | IDatasetServiceDatapoint> {
    const registration = this._svcSubjectObserverRegistry.find(
      registration => registration.datasetUuid == dataSetUuid
    );
    if (!registration) return null;

    const subject = registration.rxjsSubject;

    // Access the current buffer (not public API, but widely used)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = (subject as any)._buffer ? (subject as any)._buffer.slice() : [];

    // 1. Emit the batch (all buffered items) immediately
    const batch$ = from([buffer]);

    // 2. Live: skip the buffered items and emit new ones as they arrive
    const live$ = subject.pipe(skip(buffer.length));

    // 3. Concatenate: batch first, then live
    return concat(batch$, live$);
  }

  /**
   * Returns a new historicalData object created from the provided value. The returned
   * object will contain all information: timestamp, value, simple moving average
   * and statistics, etc.
   *
   * The returned object can later be push into a data source's historicalData array and made
   * part of the historicalData.
   *
   * @private
   * @param {number} smoothingPeriod The amount of previous historicalData rows used to calculate the doubleEma (Simple Moving Average). The doubleEma is the average of (current + (smoothingPeriod - 1)) value the average of the value and x number of previous values
   * @param {IDatasetServiceDatapoint[]} ds The historicalData object to update
   * @param {number} value The value to add to the historicalData
   * @return {*}  {IDatasetServiceDatapoint} A new historicalData object. Note: push() the object to the historicalData to
   * @memberof DatasetService
   */
  private updateDataset(ds: IDatasetServiceDataSource, unit: string, domain: AngleDomain = 'scalar'): IDatasetServiceDatapoint {
    let avgCalc: number = null;
    let smaCalc: number = null;
    let minCalc: number = null;
    let maxCalc: number = null;

    if (unit === "rad") {
      // Circular statistics for angles
      avgCalc = this.circularMeanRad(ds.historicalData);
      const window = ds.historicalData.slice(-ds.smoothingPeriod);
      smaCalc = this.circularMeanRad(window);
      const { min, max } = this.circularMinMaxRad(ds.historicalData);

      // Normalize outputs to requested domain
      if (domain === 'direction') {
        avgCalc = this.normalizeToDirection(avgCalc);
        smaCalc = this.normalizeToDirection(smaCalc);
        minCalc = this.normalizeToDirection(min);
        maxCalc = this.normalizeToDirection(max);
      } else if (domain === 'signed') {
        avgCalc = this.normalizeToSigned(avgCalc);
        smaCalc = this.normalizeToSigned(smaCalc);
        minCalc = this.normalizeToSigned(min);
        maxCalc = this.normalizeToSigned(max);
      } else {
        // Fallback: treat as scalar (shouldn't happen for unit==='rad')
        minCalc = min;
        maxCalc = max;
      }
    } else {
      // Arithmetic statistics for scalars
      avgCalc = calculateAverage(ds.historicalData);
      smaCalc = calculateSMA(ds.historicalData, ds.smoothingPeriod);
      minCalc = Math.min(...ds.historicalData);
      maxCalc = Math.max(...ds.historicalData);
    }

    const newDatapoint: IDatasetServiceDatapoint = {
      timestamp: Date.now(),
      data: {
        value: unit === 'rad'
          ? (domain === 'signed'
            ? this.normalizeToSigned(ds.historicalData[ds.historicalData.length - 1])
            : this.normalizeToDirection(ds.historicalData[ds.historicalData.length - 1]))
          : ds.historicalData[ds.historicalData.length - 1],
        sma: smaCalc,
        ema: null,
        doubleEma: null,
        lastAverage: avgCalc,
        lastMinimum: minCalc,
        lastMaximum: maxCalc
      }
    };

    return newDatapoint;

    function calculateAverage(arr: number[]): number | null {
      if (arr.length === 0) return null;
      const sum = arr.reduce((acc, val) => acc + val, 0);
      return sum / arr.length;
    }

    function calculateSMA(values: number[], windowSize: number): number {
      if (values.length < windowSize) windowSize = values.length;
      let sum = 0;
      for (let i = values.length - windowSize; i < values.length; i++) {
        sum += values[i];
      }
      return sum / windowSize;
    }
  }

  // Windowed circular mean (for SMA)
  private circularMeanRad(anglesRad: number[]): number {
    if (anglesRad.length === 0) return 0;
    const sumSin = anglesRad.reduce((sum, a) => sum + Math.sin(a), 0);
    const sumCos = anglesRad.reduce((sum, a) => sum + Math.cos(a), 0);
    return Math.atan2(sumSin / anglesRad.length, sumCos / anglesRad.length);
  }

  // Circular min/max: returns the smallest arc containing all points
  private circularMinMaxRad(anglesRad: number[]): { min: number, max: number } {
    if (anglesRad.length === 0) return { min: 0, max: 0 };
    const degAngles = anglesRad.map(a => ((a * 180 / Math.PI) + 360) % 360).sort((a, b) => a - b);
    let maxGap = 0;
    let minIdx = 0;
    for (let i = 0; i < degAngles.length; i++) {
      const next = (i + 1) % degAngles.length;
      const gap = (degAngles[next] - degAngles[i] + 360) % 360;
      if (gap > maxGap) {
        maxGap = gap;
        minIdx = next;
      }
    }
    // Convert back to radians
    const min = degAngles[minIdx] * Math.PI / 180;
    const max = degAngles[(minIdx - 1 + degAngles.length) % degAngles.length] * Math.PI / 180;
    return { min, max };
  }

  // Domain resolution helpers
  private resolveAngleDomain(path: string, unit: string): AngleDomain {
    if (unit !== 'rad') return 'scalar';
    const incoming = this.normalizePathKey(path);
    for (const candidate of this.signedAnglePaths) {
      if (incoming === this.normalizePathKey(candidate)) {
        return 'signed';
      }
    }
    return 'direction';
  }

  // Angle normalization helpers
  private normalizePathKey(path: string): string {
    return path.replace(/^vessels\.self\./, '').replace(/^self\./, '');
  }
  private mod(a: number, n: number): number { return ((a % n) + n) % n; }
  private normalizeToDirection(rad: number): number {
    const twoPi = 2 * Math.PI;
    return this.mod(rad, twoPi); // [0, 2π)
  }
  private normalizeToSigned(rad: number): number {
    const twoPi = 2 * Math.PI;
    return this.mod(rad + Math.PI, twoPi) - Math.PI; // (-π, π]
  }

  /**
   * Convenience: remove only if dataset exists (silently no-op otherwise).
   */
  public removeIfExists(uuid: string, serialize = true): boolean {
    if (!uuid) return false;
    if (this._svcDatasetConfigs.findIndex(c => c.uuid === uuid) === -1) return false;
    return this.remove(uuid, serialize);
  }

  /**
   * On app/service teardown, stop all active data sources to release subscriptions.
   * We purposefully do not persist changes; this is runtime-only cleanup.
   */
  ngOnDestroy(): void {
    // Copy array as stop() mutates _svcDataSource
    [...this._svcDataSource].forEach(ds => {
      try { this.stop(ds.uuid); } catch { /* ignore */ }
    });
    // Complete and clear subjects/registrations without altering persisted configs
    this._svcSubjectObserverRegistry.forEach(reg => reg.rxjsSubject.complete());
    this._svcSubjectObserverRegistry = [];
  }
}
