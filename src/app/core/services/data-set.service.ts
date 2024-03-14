import { Injectable } from '@angular/core';
import { Subscription, BehaviorSubject, Observable, sampleTime } from 'rxjs';
import { AppSettingsService } from './app-settings.service';
import { SignalKService, pathRegistrationValue } from './signalk.service';
import { UUID } from'../../utils/uuid'
import { cloneDeep } from 'lodash-es';

interface IDatasetServiceDataSource {
  uuid: string;
  pathSub: Subscription;
  dataset: IDatasetServiceDataset[];
};

export interface IDatasetServiceDataset {
  timestamp: number;
  data: {
    value: number;
    sma?: number; // Simple Moving Average
    ema?: number; // Exponential Moving Average - A better Moving Average calculation than Simple Moving Average
    doubleEma?: number; // Double Exponential Moving Average - Moving Average that is even more reactive to data variation then EMA. Suitable for wind and angle average calculations
    lastAngleAverage?: number;
    lastAverage?: number; // Computed from the latest dataset.
    lastMinimum?: number;
    lastMaximum?: number;
  }
}

export interface IDatasetServiceDatasetConfig {
  label:  string; // label of the dataset
  uuid: string;
  path: string;
  signalKSource: string;
  timeScaleFormat: string; /** Dataset time scale measure. Can be: millisecond, second, minute, hour, day... */
  maxDataPoints: number; // how many data points do we keep for that timescale
  sampleTime: number; // number of milliseconds between data capture
  period: number;  // number of previous plus current value to use as the moving average
};

interface IDatasetServiceObserverRegistration {
  datasetUuid: string;
  rxjsSubject: BehaviorSubject<IDatasetServiceDataset>;
}

@Injectable()
export class DatasetService {
  private _svcDatasetConfigs: IDatasetServiceDatasetConfig[] = [];
  private _svcDataSource: IDatasetServiceDataSource[] = [];
  private _svcObserverRegistry: IDatasetServiceObserverRegistration[] = [];

  constructor(
    private appSettings: AppSettingsService,
    private signalk: SignalKService
  ) {
    this._svcDatasetConfigs = appSettings.getDataSets();

    for (let index = 0; index < this._svcDatasetConfigs.length; index++) {
      this.setupServiceRegistry(this._svcDatasetConfigs[index].uuid);
    }

    this.startAll();
  }

  public setupServiceRegistry(uuid: string) {
    this._svcObserverRegistry.push({
      datasetUuid: uuid,
      rxjsSubject: new BehaviorSubject(null)
    });
  }

  /**
   * Start all Dataset service's _svcDatasetConfigs
   *
   * @memberof DataSetService
   */
  public startAll(): void {
    console.log("[DataSet Service] Auto Starting " + this._svcDatasetConfigs.length.toString() + " Datasets");
    for (let i = 0; i < this._svcDatasetConfigs.length; i++) {
      this.start(this._svcDatasetConfigs[i].uuid);
    }
  }

  /**
   * Starts a historical DataSource's dataset value recording process based on the requested
   * DataSource UUID.
   *
   * @private
   * @param {string} uuid The UUID of the DataSource to start
   * @return {*}  {void}
   * @memberof DataSetService
   */
  private start(uuid: string): void {
    const configuration = this._svcDatasetConfigs.find(configuration => configuration.uuid == uuid);
    if (!configuration) {
      console.warn(`[DataSet Service] Dataset UUID not found: ${uuid}`);
      return;
    }

    // Get dataset data setup
    this.setDatasetConfigurationOptions(configuration);

    // Cleanup existing dataset if present.
    const dsIndex = this._svcDataSource. findIndex(dataSub => dataSub.uuid == uuid);
    if (dsIndex >= 0) {
      this.stop(uuid);
    }

    // Add a fresh dataset
    const dataSource: IDatasetServiceDataSource = this._svcDataSource[
      this._svcDataSource.push({
        uuid: uuid,
        pathSub: null,
        dataset: []
      }) - 1
    ];

    console.log(`[DataSet Service] Starting Dataset ${uuid} - Scale: ${configuration.timeScaleFormat}, Datapoints: ${configuration.maxDataPoints}, Period: ${configuration.period}`)

    // Subscribe to path data and update dataset upon reception
    dataSource.pathSub = this.signalk.subscribePath(configuration.uuid, configuration.path, configuration.signalKSource).pipe(sampleTime(configuration.sampleTime)).subscribe(
      (newValue: pathRegistrationValue) => {
        if (newValue.value === null) return; // we don't need null values

        // Keep the array to specified size before adding new value
        if (configuration.maxDataPoints == dataSource.dataset.length) {
          dataSource.dataset.shift();
        }

        // Add new data to dataset
        const newDataPoint: IDatasetServiceDataset = this.updateDataset(configuration, dataSource.dataset, newValue.value as number)
        dataSource.dataset.push(newDataPoint);
        // Push to Observer
        this._svcObserverRegistry.find(registration => registration.datasetUuid === dataSource.uuid).rxjsSubject.next(newDataPoint);
      }
    );
  }

  /**
   * Stops the recording process of a DataSource (unsubscribe to the Subject).
   *
   * @private
   * @param {string} uuid The UUID of the DataSource to stop
   * @memberof DataSetService
   */
  private stop(uuid: string) {
    const dataSource = this._svcDataSource.find(d => d.uuid == uuid);

    dataSource.pathSub.unsubscribe();
  }

  /**
   * Creates a new Dataset and starts the data capture process.
   *
   * @param {string} path Signal K path of the data to record
   * @param {string} source The path's chosen source
   * @param {string} timeScaleFormat The the duration of the dataset: racing, minute, hour, day.
   * @param {string} label Name of the Dataset
   * @memberof DataSetService
   */
  public create(path: string, source: string, timeScaleFormat: string, label: string ) {
    let uuid = UUID.create();

    const newSvcDataset: IDatasetServiceDatasetConfig = {
      label: label,
      uuid: uuid,
      path: path,
      signalKSource: source,
      timeScaleFormat: timeScaleFormat,
      sampleTime: null,
      maxDataPoints: null,
      period: null
    };

    this._svcDatasetConfigs.push(newSvcDataset);
    this.setupServiceRegistry(uuid);

    this.start(uuid);
    this.appSettings.saveDataSets(this._svcDatasetConfigs);
  }

  /**
   * Updates the dataset definition and persists it's configuration to application settings.
   *
   * @param {IDatasetServiceDatasetConfig} dataset Dataset configuration object of type IDatasetServiceDatasetConfig
   * @memberof DataSetService
   */
  public edit(datasetConfig: IDatasetServiceDatasetConfig): void {
    this.stop(datasetConfig.uuid);

    this._svcDatasetConfigs.splice(this._svcDatasetConfigs.findIndex(conf => conf.uuid === datasetConfig.uuid), 1, datasetConfig);

    this.start(datasetConfig.uuid);
    this.appSettings.saveDataSets(this._svcDatasetConfigs);
  }

  /**
  * Stops Signal K path Observer, deletes both dataset definition and service registry entry,
  * completes all Subject Subscribers and saves to storage.
  *
  * @param {string} uuid The dataset's UUID to delete
  * @memberof DataSetService
  */
  public remove(uuid: string): void {
    this.stop(uuid);

    // Clean service data entries
    this._svcDatasetConfigs.splice(this._svcDatasetConfigs.findIndex(c => c.uuid === uuid),1);
    this._svcDataSource.splice(this._svcDataSource.findIndex(s => s.uuid === uuid), 1);
    // stop Subject Observers
    this._svcObserverRegistry.find(r => r.datasetUuid === uuid).rxjsSubject.complete();
    this._svcObserverRegistry.splice(this._svcObserverRegistry.findIndex(r => r.datasetUuid === uuid), 1);

    this.appSettings.saveDataSets(this._svcDatasetConfigs);
  }

  /**
   * Get all of the recorded historical data (dataset arrays) from the service for a given DataSource.
   *
   * @param {string} dataSourceUUID The UUID string of the target DataSource
   * @return {*}  {(IDatasetServiceDataset[] | null)} An of datasets containing all the recorded data, or null if not found.
   * @memberof DatasetService
   */
  public getHistoricalData(dataSourceUUID: string): IDatasetServiceDataset[] | null {
    const index = this._svcDataSource.findIndex(ds => ds.uuid === dataSourceUUID);
    if (index >= 0) {
      return cloneDeep(this._svcDataSource[index].dataset);
    } else {
      return null;
    }
  }

  /**
   * Returns all existing dataset configuration
   *
   * @return {*}  {IDatasetServiceDatasetConfig[]} Arrays of all dataset configurations
   * @memberof DataSetService
   */
  public list(): IDatasetServiceDatasetConfig[] {
    const result: IDatasetServiceDatasetConfig[] = [];
    for (let i = 0; i < this._svcDatasetConfigs.length; i++) {
      result.push({
        uuid: this._svcDatasetConfigs[i].uuid,
        path: this._svcDatasetConfigs[i].path,
        signalKSource: this._svcDatasetConfigs[i].signalKSource,
        timeScaleFormat: this._svcDatasetConfigs[i].timeScaleFormat,
        sampleTime: this._svcDatasetConfigs[i].sampleTime,
        maxDataPoints: this._svcDatasetConfigs[i].maxDataPoints,
        period: this._svcDatasetConfigs[i].period,
        label: this._svcDatasetConfigs[i].label
      });
    }
    return result;
  }

  /**
   * Returns the dataset configuration details for a specific dataset based on it's UUID.
   *
   * @param {string} uuid The UUID of the desired dataset
   * @return {*}  {IDatasetServiceDatasetConfig} A dataset configuration object
   * @memberof DatasetService
   */
  public getDatasetConfig(uuid: string): IDatasetServiceDatasetConfig {
    return this._svcDatasetConfigs.find(config => config.uuid === uuid);
  }

  /**
   * Returns the dataset Subject corresponding to the dataset UUID as an Observable
   * or null if not found.
   *
   * @param {string} dataSetUuid The UUID is the dataset
   * @return {*}  {Observable<IDatasetServiceDataset> | null} Observable of data point array or null if not found
   * @memberof DataSetService
   */
  public getDatasetObservable(dataSetUuid: string): Observable<IDatasetServiceDataset> | null {
    const registration = this._svcObserverRegistry.find(registration => registration.datasetUuid == dataSetUuid);

    if (registration) {
      return registration.rxjsSubject.asObservable();
    }

    return null;
  }

  /**
   * Returns a new dataset object created from the provided value. The returned
   * object will contain all information: timestamp, value, simple moving average
   * and statistics, etc.
   *
   * The returned object can later be push into a data source's dataset array and made
   * part of the dataset.
   *
   * @private
   * @param {number} period The amount of previous dataset rows used to calculate the doubleEma (Simple Moving Average). The doubleEma is the average of (current + (period - 1)) value the average of the value and x number of previous values
   * @param {IDatasetServiceDataset[]} ds The dataset object to update
   * @param {number} value The value to add to the dataset
   * @return {*}  {IDatasetServiceDataset} A new dataset object. Note: push() the object to the dataset to
   * @memberof DatasetService
   */
  private updateDataset(configuration: IDatasetServiceDatasetConfig, ds: IDatasetServiceDataset[], value: number): IDatasetServiceDataset {
    const newDataset: IDatasetServiceDataset = {
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
     * @param {IDatasetServiceDataset[]} ds The current Dataset array
     * @param {number} ema1 The new dataset's calculated ema
     * @param {number} period The dataset configuration period
     * @return {*}  {number} The DEMA value
     */
    function calculateDEMA(ds: IDatasetServiceDataset[], ema1: number, period: number): number {
      //  Check for min available periods
      if (ds.length < period) {
        console.log("[Dataset Service] Insufficient data for the given period to calculate DEMA.");
        return;
      }

      const smoothingFactor = 2 / (1 + period);

      // Calculate the second EMA (EMA2) of the EMA1 values
      let ema2 = (ema1 * smoothingFactor) + (ds[ds.length - 1].data.ema * (1 - smoothingFactor));

      // Calculate and return the DEMA
      return (2 * ema1) - ema2;
    }

    /**
     * Exponential Moving Average (EMA) calculation
     *
     * @param {IDatasetServiceDataset[]} ds The new dataset's calculated ema
     * @param {number} currentValue The new dataset's value
     * @param {number} period The dataset configuration period
     * @return {*}  {number} The EMA value
     */
    function calculateEMA(ds: IDatasetServiceDataset[], currentValue: number, period: number): number {
      if (ds.length < period) {
        console.log("[Dataset Service] Insufficient data for the given period to calculate EMA.");
        return;
      }
      const smoothingFactor = 2 / (1 + period);

      // Calculate and return EMA
      return (currentValue * smoothingFactor) + (ds[ds.length - 1].data.sma * (1 - smoothingFactor));
    }

    function calculateSMA(ds: IDatasetServiceDataset[], currentValue: number, period: number): number {
      let smaPeriodCount = 0;
      let smaSum: number = 0;

      // Load past period values
      for (let index = ds.length - 1; index >= (ds.length - period); index--) {
        smaSum += ds[index].data.value;
        smaPeriodCount++;
      }
      // Add current period value
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
    newDataset.timestamp = Date.now();
    // Set Value
    newDataset.data.value = value;

    // Check if we are doing the first period and use SMA calculations, else do EMA & DEMA
    if (ds.length < configuration.period) {
      if (ds.length === 0) {
        newDataset.data.sma = newDataset.data.doubleEma = newDataset.data.ema = value;
      } else {
        newDataset.data.sma = newDataset.data.doubleEma = newDataset.data.ema = calculateSMA(ds, newDataset.data.value, ds.length);
      }
    } else {
      // We have enough to start doing stats calculations
      newDataset.data.sma = calculateSMA(ds, newDataset.data.value, configuration.period);
      newDataset.data.ema = calculateEMA(ds, newDataset.data.value, configuration.period);
      newDataset.data.doubleEma = calculateDEMA(ds, newDataset.data.ema, configuration.period);
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

    // Set last dataset values
    newDataset.data.lastAverage = (seriesSum + value) / (ds.length + 1);
    newDataset.data.lastMinimum = Math.min(...valArr);
    newDataset.data.lastMaximum = Math.max(...valArr);

    return newDataset;
  }

  private setDatasetConfigurationOptions(ds: IDatasetServiceDatasetConfig ): void {
    const periodFactor: number = 0.3;

    switch (ds.timeScaleFormat) {
      case "day":
        ds.maxDataPoints = 96; // 1d * 24 * 4 (every 15 min)
        ds.sampleTime = 900000; // 15 min
        ds.period = Math.floor(ds.maxDataPoints * periodFactor); // moving average points to use
        break;

      case "hour":
        ds.maxDataPoints = 240; // 1h = 60 min * 4 (every 15 sec)
        ds.sampleTime = 15000; // 15 sec
        ds.period = Math.floor(ds.maxDataPoints * periodFactor); // moving average points to use
        break;

      case "minute":
        ds.maxDataPoints = 60; // 1m = 60 sec
        ds.sampleTime = 1000; // 15 sec
        ds.period = Math.floor(ds.maxDataPoints * periodFactor); // moving average points to use
        break;

      default: // 15 second period for quick gauges like wind speed and angle, heading and course in racing
        ds.maxDataPoints = 40; // 1m * 60 sec * 2 (every 0.5 sec)
        ds.sampleTime = 250; // go as fast as the sensor
        ds.period = 10; // moving average points to use
        break;
    }
  }
}
