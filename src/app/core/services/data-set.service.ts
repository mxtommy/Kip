import { Injectable, inject } from '@angular/core';
import { Subscription, Observable, ReplaySubject, MonoTypeOperatorFunction, interval, withLatestFrom } from 'rxjs';
import { AppSettingsService } from './app-settings.service';
import { DataService, IPathUpdate } from './data.service';
import { UUID } from'../utils/uuid'
import { cloneDeep } from 'lodash-es';


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
export interface IDatasetServiceDatasetConfig {
  uuid: string;
  path: string;
  pathSource: string;
  baseUnit: string;         // The path's Signal K base unit type
  timeScaleFormat: string;  // Dataset time scale measure. Can be: millisecond, second, minute, hour
  period: number;           // Number of datapoints to capture.
  label:  string;           // label of the historicalData
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

@Injectable()
export class DatasetService {
  private appSettings = inject(AppSettingsService);
  private data = inject(DataService);

  private _svcDatasetConfigs: IDatasetServiceDatasetConfig[] = [];
  private _svcDataSource: IDatasetServiceDataSource[] = [];
  private _svcSubjectObserverRegistry: IDatasetServiceObserverRegistration[] = [];

  constructor() {
    const appSettings = this.appSettings;

    this._svcDatasetConfigs = appSettings.getDataSets();
    this.startAll();
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
    let entryIndex = this._svcSubjectObserverRegistry.findIndex(entry => entry.datasetUuid == uuid);

    if (entryIndex >= 0) {
      this._svcSubjectObserverRegistry[entryIndex].rxjsSubject.complete();
      this._svcSubjectObserverRegistry.splice(entryIndex, 1);
    }

    this._svcSubjectObserverRegistry.push({
      datasetUuid: uuid,
      rxjsSubject: new ReplaySubject(replayDatapoints)
    });
  }

  private createDataSourceConfiguration(dsConf: IDatasetServiceDatasetConfig ): IDatasetServiceDataSource {
    const smoothingPeriodFactor: number = 0.25;
    const newDataSourceConfiguration: IDatasetServiceDataSource = {
      uuid: dsConf.uuid,
      pathObserverSubscription: null,
      sampleTime: null,
      maxDataPoints: null,
      smoothingPeriod: null,
      historicalData: []
    }

    switch (dsConf.timeScaleFormat) {
      case "hour":
        newDataSourceConfiguration.maxDataPoints = dsConf.period * 60; // hours * 60 min
        newDataSourceConfiguration.sampleTime = 60000; // 1 minute
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

    return newDataSourceConfiguration;
  }

  /**
   * Start all Dataset Service's _svcDatasetConfigs
   *
   * @memberof DataSetService
   */
  private startAll(): void {
    console.log("[Dataset Service] Auto Starting " + this._svcDatasetConfigs.length.toString() + " Datasets");
    for (let i = 0; i < this._svcDatasetConfigs.length; i++) {
      this.start(this._svcDatasetConfigs[i].uuid);
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

    console.log(`[Dataset Service] Starting Dataset recording process: ${newDataSourceConfig.uuid}`);
    console.log(`[Dataset Service] Path: ${configuration.path}, Scale: ${configuration.timeScaleFormat}, Period: ${configuration.period}, Datapoints: ${newDataSourceConfig.maxDataPoints}`);

    // Emit at a regular interval using the last value. We use this and not sampleTime() to make sure that if there is no new data, we still send the last know value. This is to prevent dataset blanks that look ugly on the chart
    function sampleInterval<IPathData>(period: number): MonoTypeOperatorFunction<IPathData> {
      return (source) => interval(period).pipe(withLatestFrom(source, (_, value) => value));
    };

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
        const datapoint: IDatasetServiceDatapoint = this.updateDataset(dataSource, configuration.baseUnit);
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
   * @param {string} timeScaleFormat The the duration of the historicalData: racing, minute, hour, day.
   * @param {string} label Name of the historicalData
   * @memberof DataSetService
   */
  public create(path: string, source: string, timeScaleFormat: string, period: number, label: string ) {
    let uuid = UUID.create();

    const newSvcDataset: IDatasetServiceDatasetConfig = {
      uuid: uuid,
      path: path,
      pathSource: source,
      baseUnit: this.data.getPathUnitType(path),
      timeScaleFormat: timeScaleFormat,
      period: period,
      label: label,
    };

    console.log(`[Dataset Service] Creating new Dataset: ${newSvcDataset.uuid}, Path: ${newSvcDataset.path}, Source: ${newSvcDataset.pathSource} Scale: ${newSvcDataset.timeScaleFormat}, Period: ${newSvcDataset.period}`);

    this._svcDatasetConfigs.push(newSvcDataset);

    this.start(uuid);
    this.appSettings.saveDataSets(this._svcDatasetConfigs);
  }

  /**
   * Updates the historicalData definition and persists it's configuration to application settings.
   *
   * @param {IDatasetServiceDatasetConfig} historicalData historicalData configuration object of type IDatasetServiceDatasetConfig
   * @memberof DataSetService
   */
  public edit(datasetConfig: IDatasetServiceDatasetConfig): void {
    const existingConfig = this._svcDatasetConfigs.find(conf => conf.uuid === datasetConfig.uuid);
    if (JSON.stringify(existingConfig) === JSON.stringify(datasetConfig)) {
      console.log(`[Dataset Service] No changes detected for Dataset ${datasetConfig.uuid}.`);
      return; // Avoid unnecessary stop/start
    }

    this.stop(datasetConfig.uuid);
    console.log(`[Dataset Service] Updating Dataset: ${datasetConfig.uuid}`);
    datasetConfig.baseUnit = this.data.getPathUnitType(datasetConfig.path);
    this._svcDatasetConfigs.splice(this._svcDatasetConfigs.findIndex(conf => conf.uuid === datasetConfig.uuid), 1, datasetConfig);

    this.start(datasetConfig.uuid);
    this.appSettings.saveDataSets(this._svcDatasetConfigs);
  }

  /**
  * Stops DataSource recording process, deletes historicalData configuration, service registry entry, and
  * completes the Subject so that Observers (widgets) terminates their subscriptions and
  * updates Dataset Service config to storage.
  *
  * @param {string} uuid The historicalData's UUID to remote
  * @memberof DataSetService
  */
  public remove(uuid: string): void {
    this.stop(uuid);
    console.log(`[Dataset Service] Removing Dataset: ${uuid}`);
    // Clean service data entries
    this._svcDatasetConfigs.splice(this._svcDatasetConfigs.findIndex(c => c.uuid === uuid),1);
    // stop Subject Observers
    this._svcSubjectObserverRegistry.find(r => r.datasetUuid === uuid).rxjsSubject.complete();
    this._svcSubjectObserverRegistry.splice(this._svcSubjectObserverRegistry.findIndex(r => r.datasetUuid === uuid), 1);

    this.appSettings.saveDataSets(this._svcDatasetConfigs);
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
  private updateDataset(ds: IDatasetServiceDataSource, unit: string): IDatasetServiceDatapoint {
    let avgCalc: number = null;
    let smaCalc: number = null;

    switch (unit) {
      case "rad":
        avgCalc = calculateDirectionalAverage(ds.historicalData);
        smaCalc = calculateDirectionalSMA(ds.historicalData, ds.smoothingPeriod)
        break;

      default:
        avgCalc = calculateAverage(ds.historicalData);
        smaCalc = calculateSMA(ds.historicalData, ds.smoothingPeriod);
        break;
    }

    const newDatapoint: IDatasetServiceDatapoint = {
      timestamp: Date.now(),
      data: {
        value: ds.historicalData[ds.historicalData.length - 1],
        sma: smaCalc,
        ema: null,
        doubleEma: null,
        lastAverage: avgCalc,
        lastMinimum: Math.min(...ds.historicalData),
        lastMaximum: Math.max(...ds.historicalData)
      }
    };

    return newDatapoint;

    function calculateAverage(arr: number[]): number | null {
      if (arr.length === 0) {
          return null; // Handle empty array case
      }

      const sum = arr.reduce((acc, val) => acc + val, 0);
      return sum / arr.length;
    }

    function calculateDirectionalAverage(radianValues: number[]): number {
      // Convert radians to unit vectors
      const unitVectors = radianValues.map(rad => [Math.cos(rad), Math.sin(rad)]);

      // Calculate weighted sum of unit vectors
      const sumVector = unitVectors.reduce(
          (acc, vec) => [acc[0] + vec[0], acc[1] + vec[1]],
          [0, 0]
      );

      // Normalize the sum vector
      const magnitude = Math.sqrt(sumVector[0] * sumVector[0] + sumVector[1] * sumVector[1]);
      const normalizedVector = [sumVector[0] / magnitude, sumVector[1] / magnitude];

      // Calculate average direction in radians
      let averageRad = Math.atan2(normalizedVector[1], normalizedVector[0]);

      // Handle wrap-around issues
      // averageRad = (averageRad + 2 * Math.PI) % (2 * Math.PI); // Adjust to [0, 2π)
      averageRad = (averageRad + Math.PI) % (2 * Math.PI) - Math.PI;

      return averageRad;
    }

    function calculateSMA(values: number[], windowSize: number): number {
      // Check if the array size is smaller than the window size
      if (values.length < windowSize) {
          windowSize = values.length;
      }

      // Calculate the SMA
      let sum = 0;
      for (let i = values.length - windowSize; i < values.length; i++) {
          sum += values[i];
      }
      return sum / windowSize;
    }

    function calculateDirectionalSMA(radianValues: number[], windowSize: number): number {
      if (radianValues.length === 0) {
        return 0; // Handle empty array case
      }

      // Adjust window size if array length is smaller
      const actualWindowSize = Math.min(windowSize, radianValues.length);

      // Calculate the sum of radian values within the window
      let sum = 0;
      for (let i = radianValues.length - actualWindowSize; i < radianValues.length; i++) {
        sum += radianValues[i];
      }

      // Calculate the simple moving average
      const sma = sum / actualWindowSize;

      // Handle wrap-around for wind direction averages
      const adjustedSMA = (sma + Math.PI) % (2 * Math.PI) - Math.PI;

      return adjustedSMA;
    }

    /**
     * Double Exponential Moving Average (DEMA) calculation
     *
     * @param {IDatasetServiceDatapoint[]} ds The current historicalData array
     * @param {number} ema1 The new historicalData's calculated ema
     * @param {number} smoothingPeriod The historicalData configuration smoothingPeriod
     * @return {*}  {number} The DEMA value
     */
    // function calculateDEMA(ds: IDatasetServiceDatapoint[], ema1: number, smoothingPeriod: number): number {
    //   //  Check for min available periods
    //   if (ds.length < smoothingPeriod) {
    //     console.log("[Dataset Service] Insufficient data for the given smoothingPeriod to calculate DEMA.");
    //     return;
    //   }

    //   const smoothingFactor = 2 / (1 + smoothingPeriod);

    //   // Calculate the second EMA (EMA2) of the EMA1 values
    //   let ema2 = (ema1 * smoothingFactor) + (ds[ds.length - 1].data.ema * (1 - smoothingFactor));

    //   // Calculate and return the DEMA
    //   return (2 * ema1) - ema2;
    // }

    /**
     * Exponential Moving Average (EMA) calculation
     *
     * @param {IDatasetServiceDatapoint[]} ds The new historicalData's calculated ema
     * @param {number} currentValue The new historicalData's value
     * @param {number} smoothingPeriod The historicalData configuration smoothingPeriod
     * @return {*}  {number} The EMA value
     */
    // function calculateEMA(ds: IDatasetServiceDatapoint[], currentValue: number, smoothingPeriod: number): number {
    //   if (ds.length < smoothingPeriod) {
    //     console.log("[Dataset Service] Insufficient data for the given smoothingPeriod to calculate EMA.");
    //     return;
    //   }
    //   const smoothingFactor = 2 / (1 + smoothingPeriod);

    //   // Calculate and return EMA
    //   return (currentValue * smoothingFactor) + (ds[ds.length - 1].data.sma * (1 - smoothingFactor));
    // }
  }
}
