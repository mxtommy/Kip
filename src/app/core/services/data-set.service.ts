import { Injectable } from '@angular/core';
import { Subscription, Observable, sampleTime,ReplaySubject } from 'rxjs';
import { AppSettingsService } from './app-settings.service';
import { SignalKService, pathRegistrationValue } from './signalk.service';
import { UUID } from'../../utils/uuid'
import { cloneDeep } from 'lodash-es';


export interface IDatasetServiceDatapoint {
  timestamp: number;
  data: {
    value: number;
    sma?: number; // Simple Moving Average
    ema?: number; // Exponential Moving Average - A better Moving Average calculation than Simple Moving Average
    doubleEma?: number; // Double Exponential Moving Average - Moving Average that is even more reactive to data variation then EMA. Suitable for wind and angle average calculations
    lastAngleAverage?: number;
    lastAverage?: number; // Computed from the latest _historicalDataset.
    lastMinimum?: number;
    lastMaximum?: number;
  }
}
export interface IDatasetServiceDatasetConfig {
  label:  string;           // label of the _historicalDataset
  uuid: string;
  path: string;
  pathSource: string;
  timeScaleFormat: string;  // Dataset time scale measure. Can be: millisecond, second, minute, hour
  period: number;           // Number of datapoints to capture.
  sampleTime: number;       // DataSource Observer's path value sampling rate in milliseconds. ie. How often we get data from Signal K.
  maxDataPoints: number;    // How many data points do we keep for that timescale
  smoothingPeriod: number;  // Number of previous plus current value to use as the moving average
};
interface IDatasetServiceDataSource {
  uuid: string;
  _pathObserverSubscription: Subscription;
  _historicalDataset: IDatasetServiceDatapoint[];
};
interface IDatasetServiceObserverRegistration {
  datasetUuid: string;
  rxjsSubject: ReplaySubject<IDatasetServiceDatapoint>;
}

@Injectable()
export class DatasetService {
  private _svcDatasetConfigs: IDatasetServiceDatasetConfig[] = [];
  private _svcDataSource: IDatasetServiceDataSource[] = [];
  private _svcSubjectObserverRegistry: IDatasetServiceObserverRegistration[] = [];

  constructor(private appSettings: AppSettingsService, private signalk: SignalKService) {
    this._svcDatasetConfigs = appSettings.getDataSets();

    for (let index = 0; index < this._svcDatasetConfigs.length; index++) {
      this.setupServiceRegistry(this._svcDatasetConfigs[index].uuid);
    }

    this.startAll();
  }

  /**
   * Registers the _historicalDataset Subject. To enable _historicalDataset subscribers to automatically receive all of the
   * _historicalDataset's past recorded data, a ReplaySubject is used and configured to emit the latest
   * _historicalDataset values.
   *
   * @private
   * @param {string} uuid
   * @memberof DatasetService
   */
private setupServiceRegistry(uuid: string): void {
    this._svcSubjectObserverRegistry.push({
      datasetUuid: uuid,
      rxjsSubject: new ReplaySubject(this._svcDatasetConfigs.find(c => c.uuid === uuid).maxDataPoints)
    });
  }

  private setDatasetConfigurationOptions(ds: IDatasetServiceDatasetConfig ): void {
    const smoothingPeriodFactor: number = 0.25;

    switch (ds.timeScaleFormat) {
      case "hour":
        ds.maxDataPoints = ds.period * 6; // hours * 60 min
        ds.sampleTime = 60000; // 10 minute
        ds.smoothingPeriod = Math.floor(ds.maxDataPoints * smoothingPeriodFactor); // moving average points to use
        break;

      case "minute":
        ds.maxDataPoints = ds.period * 60; // minutes * 60 sec
        ds.sampleTime = 1000;
        ds.smoothingPeriod = Math.floor(ds.maxDataPoints * smoothingPeriodFactor); // moving average points to use
        break;

      default:
        ds.maxDataPoints = ds.period * 5; // 5 times per second
        ds.sampleTime = 200;
        ds.smoothingPeriod = Math.floor(ds.maxDataPoints * smoothingPeriodFactor); // moving average points to use
        break;
    }
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
   * Starts the recording process of a Data Source. It firsts reads the _historicalDataset configuration,
   * then starts building the _historicalDataset values, and pushes them to the Subject.
   *
   * This method handles the process that takes SK data and feed the Subject. _historicalDataset "clients",
   * ie. widgets, will use the getDatasetObservable() method to receive data from the Subject.
   *
   * Concept: SK_path_values -> datasource -> (ReplaySubject) <- Widget observers
   *
   * Once a datasource is started, ReplaySubject subscribers
   * (widgets) will receive _historicalDataset data updates.
   * .
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

    // Get _historicalDataset data setup
    this.setDatasetConfigurationOptions(configuration);

    // Cleanup existing _historicalDataset if present.
    const dsIndex = this._svcDataSource. findIndex(dataSub => dataSub.uuid == uuid);
    if (dsIndex >= 0) {
      this.stop(uuid);
    }

    // Add a fresh _historicalDataset
    const dataSource: IDatasetServiceDataSource = this._svcDataSource[
      this._svcDataSource.push({
        uuid: uuid,
        _pathObserverSubscription: null,
        _historicalDataset: []
      }) - 1
    ];

    console.log(`[Dataset Service] Starting Dataset recording process: ${configuration.uuid}`);
    console.log(`[Dataset Service] Path: ${configuration.path}, Scale: ${configuration.timeScaleFormat}, Datapoints: ${configuration.maxDataPoints}, Period: ${configuration.smoothingPeriod}`);

    // Subscribe to path data and update _historicalDataset upon reception
    dataSource._pathObserverSubscription = this.signalk.subscribePath(configuration.uuid, configuration.path, configuration.pathSource).pipe(sampleTime(configuration.sampleTime)).subscribe(
      (newValue: pathRegistrationValue) => {
        if (newValue.value === null) return; // we don't need null values

        // Keep the array to specified size before adding new value
        if (configuration.maxDataPoints == dataSource._historicalDataset.length) {
          dataSource._historicalDataset.shift();
        }

        // Add new datapoint to _historicalDataset
        const newDataPoint: IDatasetServiceDatapoint = this.updateDataset(configuration, dataSource._historicalDataset, newValue.value as number)
        dataSource._historicalDataset.push(newDataPoint);
        // Copy object so it's not send by reference, then push to Subject so that Observers can receive
        this._svcSubjectObserverRegistry.find(registration => registration.datasetUuid === dataSource.uuid).rxjsSubject.next(cloneDeep(newDataPoint));
      }
    );
  }

  /**
   * Stops the recording process of a DataSource (unsubscribes from the Subject). This will stop
   * the processing of SK path data into the _historicalDataset. Stop will not complete the Subject so that
   * if the process is restarted, observers (widgets) will automatically start to receive data.
   *
   * @private
   * @param {string} uuid The UUID of the DataSource to stop
   * @memberof DataSetService
   */
  private stop(uuid: string) {
    const dataSource = this._svcDataSource.find(d => d.uuid == uuid);
    console.log(`[Dataset Service] Stopping Dataset ${uuid} data capture`);
    dataSource._pathObserverSubscription.unsubscribe();
  }

  /**
   * Returns a copy of all existing _historicalDataset configuration
   *
   * @return {*}  {IDatasetServiceDatasetConfig[]} Arrays of all _historicalDataset configurations
   * @memberof DataSetService
   */
  public list(): IDatasetServiceDatasetConfig[] {
    return cloneDeep(this._svcDatasetConfigs);
  }

  /**
   * Returns a copy of a _historicalDataset configuration details for a specific _historicalDataset based on it's UUID.
   *
   * @param {string} uuid The UUID of the desired _historicalDataset
   * @return {*}  {IDatasetServiceDatasetConfig} A _historicalDataset configuration object copy
   * @memberof DatasetService
   */
  public get(uuid: string): IDatasetServiceDatasetConfig {
    return cloneDeep(this._svcDatasetConfigs.find(config => config.uuid === uuid));
  }

  /**
   * Creates a new _historicalDataset and starts the data capture process.
   *
   * @param {string} path Signal K path of the data to record
   * @param {string} source The path's chosen source
   * @param {string} timeScaleFormat The the duration of the _historicalDataset: racing, minute, hour, day.
   * @param {string} label Name of the _historicalDataset
   * @memberof DataSetService
   */
  public create(path: string, source: string, timeScaleFormat: string, period: number, label: string ) {
    let uuid = UUID.create();

    const newSvcDataset: IDatasetServiceDatasetConfig = {
      label: label,
      uuid: uuid,
      path: path,
      pathSource: source,
      timeScaleFormat: timeScaleFormat,
      period: period,
      sampleTime: null,
      maxDataPoints: null,
      smoothingPeriod: null
    };

    console.log(`[Dataset Service] Creating new Dataset: ${newSvcDataset.uuid}, Path: ${newSvcDataset.path}, Source: ${newSvcDataset.pathSource} Scale: ${newSvcDataset.timeScaleFormat}, Period: ${newSvcDataset.period}`);

    this._svcDatasetConfigs.push(newSvcDataset);
    this.setupServiceRegistry(uuid);

    this.start(uuid);
    this.appSettings.saveDataSets(this._svcDatasetConfigs);
  }

  /**
   * Updates the _historicalDataset definition and persists it's configuration to application settings.
   *
   * @param {IDatasetServiceDatasetConfig} _historicalDataset _historicalDataset configuration object of type IDatasetServiceDatasetConfig
   * @memberof DataSetService
   */
  public edit(datasetConfig: IDatasetServiceDatasetConfig): void {
    this.stop(datasetConfig.uuid);
    console.log(`[Dataset Service] Updating Dataset: ${datasetConfig.uuid}`);
    this._svcDatasetConfigs.splice(this._svcDatasetConfigs.findIndex(conf => conf.uuid === datasetConfig.uuid), 1, datasetConfig);

    this.start(datasetConfig.uuid);
    this.appSettings.saveDataSets(this._svcDatasetConfigs);
  }

  /**
  * Stops DataSource recording process, deletes _historicalDataset configuration, service registry entry, and
  * completes the Subject so that Observers (widgets) terminates their subscriptions and
  * updates Dataset Service config to storage.
  *
  * @param {string} uuid The _historicalDataset's UUID to remote
  * @memberof DataSetService
  */
  public remove(uuid: string): void {
    this.stop(uuid);
    console.log(`[Dataset Service] Removing Dataset: ${uuid}`);
    // Clean service data entries
    this._svcDatasetConfigs.splice(this._svcDatasetConfigs.findIndex(c => c.uuid === uuid),1);
    this._svcDataSource.splice(this._svcDataSource.findIndex(s => s.uuid === uuid), 1);
    // stop Subject Observers
    this._svcSubjectObserverRegistry.find(r => r.datasetUuid === uuid).rxjsSubject.complete();
    this._svcSubjectObserverRegistry.splice(this._svcSubjectObserverRegistry.findIndex(r => r.datasetUuid === uuid), 1);

    this.appSettings.saveDataSets(this._svcDatasetConfigs);
  }

  /**
   * Returns an Observable for the _historicalDataset UUID or null if not found. Clients (widget) can use
   * subscribe() to start receiving _historicalDataset data.
   *
   * @param {string} dataSetUuid The UUID is the _historicalDataset
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
   * Returns a new _historicalDataset object created from the provided value. The returned
   * object will contain all information: timestamp, value, simple moving average
   * and statistics, etc.
   *
   * The returned object can later be push into a data source's _historicalDataset array and made
   * part of the _historicalDataset.
   *
   * @private
   * @param {number} smoothingPeriod The amount of previous _historicalDataset rows used to calculate the doubleEma (Simple Moving Average). The doubleEma is the average of (current + (smoothingPeriod - 1)) value the average of the value and x number of previous values
   * @param {IDatasetServiceDatapoint[]} ds The _historicalDataset object to update
   * @param {number} value The value to add to the _historicalDataset
   * @return {*}  {IDatasetServiceDatapoint} A new _historicalDataset object. Note: push() the object to the _historicalDataset to
   * @memberof DatasetService
   */
  private updateDataset(configuration: IDatasetServiceDatasetConfig, ds: IDatasetServiceDatapoint[], value: number): IDatasetServiceDatapoint {
    const newDatapoint: IDatasetServiceDatapoint = {
      timestamp: null,
      data: {
        value: null,
        sma: null,
        ema: null,
        doubleEma: null,
        lastAverage: null,
        lastMinimum: null,
        lastMaximum: null
      }
    };

    /**
     * Double Exponential Moving Average (DEMA) calculation
     *
     * @param {IDatasetServiceDatapoint[]} ds The current _historicalDataset array
     * @param {number} ema1 The new _historicalDataset's calculated ema
     * @param {number} smoothingPeriod The _historicalDataset configuration smoothingPeriod
     * @return {*}  {number} The DEMA value
     */
    function calculateDEMA(ds: IDatasetServiceDatapoint[], ema1: number, smoothingPeriod: number): number {
      //  Check for min available periods
      if (ds.length < smoothingPeriod) {
        console.log("[Dataset Service] Insufficient data for the given smoothingPeriod to calculate DEMA.");
        return;
      }

      const smoothingFactor = 2 / (1 + smoothingPeriod);

      // Calculate the second EMA (EMA2) of the EMA1 values
      let ema2 = (ema1 * smoothingFactor) + (ds[ds.length - 1].data.ema * (1 - smoothingFactor));

      // Calculate and return the DEMA
      return (2 * ema1) - ema2;
    }

    /**
     * Exponential Moving Average (EMA) calculation
     *
     * @param {IDatasetServiceDatapoint[]} ds The new _historicalDataset's calculated ema
     * @param {number} currentValue The new _historicalDataset's value
     * @param {number} smoothingPeriod The _historicalDataset configuration smoothingPeriod
     * @return {*}  {number} The EMA value
     */
    function calculateEMA(ds: IDatasetServiceDatapoint[], currentValue: number, smoothingPeriod: number): number {
      if (ds.length < smoothingPeriod) {
        console.log("[Dataset Service] Insufficient data for the given smoothingPeriod to calculate EMA.");
        return;
      }
      const smoothingFactor = 2 / (1 + smoothingPeriod);

      // Calculate and return EMA
      return (currentValue * smoothingFactor) + (ds[ds.length - 1].data.sma * (1 - smoothingFactor));
    }

    function calculateSMA(ds: IDatasetServiceDatapoint[], currentValue: number, smoothingPeriod: number): number {
      let smaPeriodCount = 0;
      let smaSum: number = 0;

      // Load past smoothingPeriod values
      for (let index = ds.length - 1; index >= (ds.length - smoothingPeriod); index--) {
        smaSum += ds[index].data.value;
        smaPeriodCount++;
      }
      // Add current smoothingPeriod value
      smaSum += currentValue;
      smaPeriodCount++;

      let sma = smaSum / smaPeriodCount;

      // Prevent NaN with values of 0
      if (!sma) {
        sma = currentValue;
      }

      return sma;
    }

    // Set Timestamp
    newDatapoint.timestamp = Date.now();
    // Set Value
    newDatapoint.data.value = value;

    // Check if we are doing the first smoothingPeriod and use SMA calculations, else do EMA & DEMA
    if (ds.length < configuration.smoothingPeriod) {
      if (ds.length === 0) {
        newDatapoint.data.sma = newDatapoint.data.doubleEma = newDatapoint.data.ema = value;
      } else {
        newDatapoint.data.sma = newDatapoint.data.doubleEma = newDatapoint.data.ema = calculateSMA(ds, newDatapoint.data.value, ds.length);
      }
    } else {
      // We have enough to start doing stats calculations
      newDatapoint.data.sma = calculateSMA(ds, newDatapoint.data.value, configuration.smoothingPeriod);
      newDatapoint.data.ema = calculateEMA(ds, newDatapoint.data.value, configuration.smoothingPeriod);
      newDatapoint.data.doubleEma = calculateDEMA(ds, newDatapoint.data.ema, configuration.smoothingPeriod);
    }

    // Calculate sum
    let seriesSum: number = 0;
    let valArr: Array<number> = [];

    for (let index = 0; index < ds.length; index++) {
      seriesSum += ds[index].data.value;
      valArr.push(ds[index].data.value);
    }
    // Add new value to stats
    valArr.push(value);

    // Set last _historicalDataset values
    newDatapoint.data.lastAverage = (seriesSum + value) / (ds.length + 1);
    newDatapoint.data.lastMinimum = Math.min(...valArr);
    newDatapoint.data.lastMaximum = Math.max(...valArr);

    return newDatapoint;
  }
}
