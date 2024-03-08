import { element } from 'protractor';
import { Injectable } from '@angular/core';
import { Subscription, BehaviorSubject, pipe, UnaryFunction, filter, OperatorFunction, Observable, sampleTime } from 'rxjs';
import { AppSettingsService } from './app-settings.service';
import { SignalKService, pathRegistrationValue } from './signalk.service';
import { UUID } from'../../utils/uuid'
import { cloneDeep } from 'lodash-es';

interface IDatasetServiceDataSource {
  uuid: string;
  pathSub: Subscription;
  updateTimerSub: Subscription;
  dataset: IDatasetServiceDataset[];
};

export interface IDatasetServiceDataset {
  timestamp: number;
  data: {
    value: number;
    ema?: number; // Exponential Moving Average - A better Moving Average calculation than Simple Moving Average
    doubleEma?: number; // Double Exponential Moving Average - Moving Average that is even more reactive to data variation then EMA. Suitable for wind and angle average calculations
    lastAngleAverage?: number;  // ** Last mean from the last data received. Not the whole dataset.
    lastAverage?: number;
    lastMinimum?: number;
    lastMaximum?: number;
  }
}

export interface IDatasetServiceDatasetConfig {
  label?:  string; // label of the dataset
  uuid: string;
  path: string;
  signalKSource: string;
  sampleTime: number; // number of milliseconds between data capture
  maxDataPoints: number; // how many data points do we keep
  periodFactor: number; // factor of maxDataPoints to automatically determine period
  period?: number;  // number of previous plus current value to use as the moving average
};

interface IDatasetServiceObserverRegistration {
  uuid: string;
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
    const dsDef: IDatasetServiceDatasetConfig = this._svcDatasetConfigs[this._svcDatasetConfigs.findIndex(dsDef => dsDef.uuid == uuid)];
    if (!dsDef) {
      console.warn(`[DataSet Service] Dataset UUID not found: ${uuid}`);
      return;
    }

    // Cleanup existing dataset if present.
    const dsIndex = this._svcDataSource.findIndex(dataSub => dataSub.uuid == uuid);
    if (dsIndex >= 0) {
      // this._svcDataSource.splice(dsIndex,1);
      this.stop(uuid);
    }

    // Add a fresh dataset
    const dataSource: IDatasetServiceDataSource = this._svcDataSource[
      this._svcDataSource.push({
        uuid: uuid,
        pathSub: null,
        updateTimerSub: null,
        dataset: []
      }) - 1
    ];

    // Set EMA and DEMA period
    dsDef.period = Math.floor(dsDef.maxDataPoints * dsDef.periodFactor);

    console.log(`[DataSet Service] Staring Dataset ${uuid}, Datapoints: ${dsDef.maxDataPoints}, AvgPeriod: ${dsDef.period}`)

    // Subscribe to path data and update dataset upon reception
    dataSource.pathSub = this.signalk.subscribePath(dsDef.uuid, dsDef.path, dsDef.signalKSource).pipe(sampleTime(dsDef.sampleTime)).subscribe(
      (newValue: pathRegistrationValue) => {
        if (newValue.value === null) return; // we don't need null values

        // Keep the array to specified size before adding new value
        if (dsDef.maxDataPoints == dataSource.dataset.length) {
          dataSource.dataset.shift();
        }

        // Add new data to dataset
        const newDataPoint: IDatasetServiceDataset = this.updateDataset(dsDef, dataSource.dataset, newValue.value as number)
        dataSource.dataset.push(newDataPoint);

        // Update Subject. All Subscribers are notified
        this._svcObserverRegistry.forEach(
          (registration :IDatasetServiceObserverRegistration) => {
            if (registration.datasetUuid === dataSource.uuid) {
              registration.rxjsSubject.next(newDataPoint);
            }
          }
        );
      }
    );
  }

  /**
   * Used to stops the recording process of DataSource, including all its
   * related Observers.
   *
   * @private
   * @param {string} uuid The UUID of the DataSource to stop
   * @memberof DataSetService
   */
  private stop(uuid: string) {
    // Remove any registrations to this DataSource...
    for (let i = this._svcObserverRegistry.length - 1; i >= 0; i--) { //backwards because length will change...
      if (this._svcObserverRegistry[i].uuid == uuid) {
        this._svcObserverRegistry.splice(i, 1);
      }
    }

    // Stop subscription and delete current DataSource if it exists...
    const dataSubIndex = this._svcDataSource.findIndex(dataSub => dataSub.uuid == uuid);
    if (dataSubIndex >= 0) {
      // stop pathSub
      this._svcDataSource[dataSubIndex].pathSub.unsubscribe();
      //delete DataSub
      this._svcDataSource.splice(dataSubIndex, 1);
      console.log(`[DataSet Service] Stopping Dataset ${uuid}`);
      }
  }

  /**
   * Subscribes to a dataset and returns the Observable. If an Observable
   * already exist, it will be returned, else a new Observable is created.
   *
   * @param {string} uuid The UUID is the subscriber/listener. Usually cal calling Widget's UUID
   * @param {string} dataSetUuid The UUID is the dataset
   * @return {*}  {Observable<dataset[]>} Observable of data point array
   * @memberof DataSetService
   */
  public getDatasetObservable(uuid: string, dataSetUuid: string): Observable<IDatasetServiceDataset> {
    // If already subscribed to, return it
    let registerIndex = this._svcObserverRegistry.findIndex(registration => (registration.uuid == uuid) && (registration.datasetUuid == dataSetUuid));
    if (registerIndex >= 0) { // exists
      return this._svcObserverRegistry[registerIndex].rxjsSubject.asObservable();
    }

    // Create new empty Subject and return Observable
    return this._svcObserverRegistry[
      this._svcObserverRegistry.push({
        uuid: uuid,
        datasetUuid: dataSetUuid,
        rxjsSubject: new BehaviorSubject<IDatasetServiceDataset>(null)
      }) - 1].rxjsSubject.asObservable();
  }

  /**
   * Creates a new Dataset and starts the data capture process.
   *
   * @param {string} path Signal K path of the data to record
   * @param {string} source The path's chosen source
   * @param {number} sampleTime Data sample time in secondes
   * @param {number} dataPoints The number of data points entries to be kept. New data will push older data out of the data array
   * @param {number} periodFactor The multiplying factor to use in determining the EMA & DEMA period length - should be between 0.1 and 0.3 for short term data used in KIP
   * @param {string} label Name of the Dataset
   * @memberof DataSetService
   */
  public create(path: string, source: string, sampleTime: number, dataPoints: number, periodFactor: number, label: string ) {
    let uuid = UUID.create();

    let newSvcDataset: IDatasetServiceDatasetConfig = {
      uuid: uuid,
      path: path,
      signalKSource: source,
      sampleTime: sampleTime,
      maxDataPoints: dataPoints,
      periodFactor: periodFactor,
      label: label
    };
    this._svcDatasetConfigs.push(newSvcDataset);

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
    // index of sub and dataset can be different after updating _svcDatasetConfigs
    // get sub index for this dataset
    const dsConfigIndex = this._svcDataSource.findIndex(sub => sub.uuid === datasetConfig.uuid);
    if (dsConfigIndex >= 0) { // sub exist
      this.stop(datasetConfig.uuid);
    }

    // get index for this dataset
    const datasetIndex = this._svcDatasetConfigs.findIndex(dset => dset.uuid === datasetConfig.uuid);
    if (datasetIndex >= 0) { // dataset exist
      this._svcDatasetConfigs.splice(datasetIndex, 1, datasetConfig);
      this.start(datasetConfig.uuid);
    }

    this.appSettings.saveDataSets(this._svcDatasetConfigs);
  }

  /**
  * Stops and deletes both dataset definition and process.
  *
  * @param {string} uuid The dataset's UUID to delete
  * @memberof DataSetService
  */
  public remove(uuid: string): void {
    // index of sub and dataset can be different after updating _svcDatasetConfigs
    // get sub index
    let dsConfigIndex = this._svcDataSource.findIndex(sub => sub.uuid === uuid);
    if (dsConfigIndex >= 0) { // sub exist
      this.stop(uuid);
    }

    // get index for this dataset
    let datasetIndex = this._svcDatasetConfigs.findIndex(dset => dset.uuid === uuid);
    if (datasetIndex >= 0) { // dataset exist
      this._svcDatasetConfigs.splice(datasetIndex,1);
    }

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
        sampleTime: this._svcDatasetConfigs[i].sampleTime,
        maxDataPoints: this._svcDatasetConfigs[i].maxDataPoints,
        periodFactor: this._svcDatasetConfigs[i].periodFactor,
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
  private updateDataset(dsDef: IDatasetServiceDatasetConfig, ds: IDatasetServiceDataset[], value: number): IDatasetServiceDataset {
    const newDataset: IDatasetServiceDataset = {
      timestamp: null,
      data: {
        value: null,
        ema: null,
        doubleEma: null,
        lastAngleAverage: null,
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
      let ema2 = (ema1 * smoothingFactor) + (ds[ds.length - 2].data.doubleEma * (1 - smoothingFactor));

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
      return (currentValue * smoothingFactor) + (ds[ds.length - 2].data.ema * (1 - smoothingFactor));
    }

    // Set Timestamp
    newDataset.timestamp = Date.now();
    // Set Value
    newDataset.data.value = value;

    // Check if we are doing the first period and use SMA calculations, else do EMA & DEMA
    if (ds.length < dsDef.period) {
      let smaPeriodCount = 0;
      let smaSum: number = 0;

      for (let index = ds.length - 1; index >= 0; index--) {
        smaSum += ds[index].data.value;
        smaPeriodCount++;
      }

      let sma = smaSum / smaPeriodCount;

      // Prevent NaN with values of 0
      if (!sma) {
        newDataset.data.doubleEma = newDataset.data.ema = value;
      } else {
        newDataset.data.doubleEma = newDataset.data.ema = smaSum / smaPeriodCount;
      }
    }
    else {
      // We have enough to start doing EMA & DEMA calculations
      newDataset.data.ema = calculateEMA(ds, newDataset.data.value, dsDef.period);
      newDataset.data.doubleEma = calculateDEMA(ds, newDataset.data.ema, dsDef.period);
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
}
