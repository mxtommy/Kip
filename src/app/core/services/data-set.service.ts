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
    sma: number;
    seriesAverage: number;
    seriesMinimum: number;
    seriesMaximum: number;
  }
}

export interface IDatasetServiceDatasetConfig {
  uuid: string;
  path: string;
  signalKSource: string;
  sampleTime: number; // number of milliseconds between data capture
  maxDataPoints: number; // how many data points do we keep
  smaPeriod: number;  // number of previous plus current value to use as the moving average
  label?:  string; // label of the dataset
};

interface IDatasetServiceObserverRegistration {
  uuid: string;
  datasetUuid: string;
  rxjsSubject: BehaviorSubject<IDatasetServiceDataset>;
}

function filterNullish<T>(): UnaryFunction<Observable<T | null | undefined>, Observable<T>> {
  return pipe(
    filter(x => x != null) as OperatorFunction<T | null |  undefined, T>
  );
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
    console.log("[DataSet Service] Starting " + this._svcDatasetConfigs.length.toString() + " Dataset");
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
      console.warn(`[DataSet Service] Requested dataset UUID not found: ${uuid}`);
      return;
    }

    // Cleanup existing dataset if present.
    const dsIndex = this._svcDataSource.findIndex(dataSub => dataSub.uuid == uuid);
    if (dsIndex >= 0) {
      this._svcDataSource.splice(dsIndex,1);
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

    // Subscribe to path data and update dataset upon reception
    dataSource.pathSub = this.signalk.subscribePath(dsDef.uuid, dsDef.path, dsDef.signalKSource).pipe(sampleTime(dsDef.sampleTime)).subscribe(
      (newValue: pathRegistrationValue) => {
        if (newValue.value === null) return; // we don't need null values

        // Keep the array to specified size before adding new value
        if (dsDef.maxDataPoints == dataSource.dataset.length) {
          dataSource.dataset.shift();
        }

        // Add new data to dataset
        const newDataPoint: IDatasetServiceDataset = this.updateDataset(dsDef.smaPeriod, dataSource.dataset, newValue.value as number)
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
    // stop any registrations to this DataSource...
    for (let i = this._svcObserverRegistry.length - 1; i >= 0; i--) { //backwards because length will change...
      if (this._svcObserverRegistry[i].uuid == uuid) {
        this._svcObserverRegistry.splice(i, 1);
      }
    }

      //delete current DataSource if it exists...
    let dataSubIndex = this._svcDataSource.findIndex(dataSub => dataSub.uuid == uuid);
    if (dataSubIndex >= 0) {
      // stop pathSub
      this._svcDataSource[dataSubIndex].pathSub.unsubscribe();
      //delete DataSub
      this._svcDataSource.splice(dataSubIndex,1);
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
   * @param {string} dataPoints Optional name of the Dataset
   * @memberof DataSetService
   */
  public create(path: string, source: string, sampleTime: number, dataPoints: number, smaPeriod: number, label?: string ) {
    let uuid = UUID.create();

    let newSvcDataset: IDatasetServiceDatasetConfig = {
      uuid: uuid,
      path: path,
      signalKSource: source,
      sampleTime: sampleTime,
      maxDataPoints: dataPoints,
      smaPeriod: smaPeriod,
      label: path + ', Interval: ' + sampleTime.toString() + ', DataPoints: ' + dataPoints?.toString()
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
  public edit(dataset: IDatasetServiceDatasetConfig): void {
    // index of sub and dataset can be different after updating _svcDatasetConfigs
    // get sub index for this dataset
    let dsConfigIndex = this._svcDataSource.findIndex(sub => sub.uuid === dataset.uuid);
    if (dsConfigIndex >= 0) { // sub exist
      this.stop(dataset.uuid);
    }

    // get index for this dataset
    let datasetIndex = this._svcDatasetConfigs.findIndex(dset => dset.uuid === dataset.uuid);
    if (datasetIndex >= 0) { // dataset exist
      this._svcDatasetConfigs.splice(datasetIndex, 1, dataset);
      this.start(dataset.uuid);
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
    let result: IDatasetServiceDatasetConfig[] = [];
    for (let i = 0; i < this._svcDatasetConfigs.length; i++) {

      if (this._svcDatasetConfigs[i].label == "") {
        this._svcDatasetConfigs[i].label = this._svcDatasetConfigs[i].path + ' - Interval:' + this._svcDatasetConfigs[i].sampleTime.toString() + ' - DataPoints:' + this._svcDatasetConfigs[i].maxDataPoints?.toString()
      }

      result.push({
        uuid: this._svcDatasetConfigs[i].uuid,
        path: this._svcDatasetConfigs[i].path,
        signalKSource: this._svcDatasetConfigs[i].signalKSource,
        sampleTime: this._svcDatasetConfigs[i].sampleTime,
        maxDataPoints: this._svcDatasetConfigs[i].maxDataPoints,
        smaPeriod: this._svcDatasetConfigs[i].smaPeriod,
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
   * @param {number} smaPeriod The amount of previous dataset rows used to calculate the SMA (Simple Moving Average). The SMA is the average of (current + (smaPeriod - 1)) value the average of the value and x number of previous values
   * @param {IDatasetServiceDataset[]} ds The dataset object to update
   * @param {number} value The value to add to the dataset
   * @return {*}  {IDatasetServiceDataset} A new dataset object. Note: push() the object to the dataset to
   * @memberof DatasetService
   */
  private updateDataset(smaPeriod: number, ds: IDatasetServiceDataset[], value: number): IDatasetServiceDataset {
    const newDataset: IDatasetServiceDataset = {
      timestamp: null,
      data: {
        value: null,
        sma: null,
        seriesAverage: null,
        seriesMinimum: null,
        seriesMaximum: null
      }
    };

    // Since new value should be counter in the SMA calculation, we only take the last 2 rows.
    smaPeriod = smaPeriod - 1;

    // Timestamp
    newDataset.timestamp = Date.now();
    // Value
    newDataset.data.value = value;

    // TODO: Make derived calculations optional based on config setting
    // SMA
    if (ds.length >= smaPeriod) {
      let smaSum: number = value;
      for (let index = ds.length - 1; index >= (ds.length - smaPeriod); index--) {
        smaSum += ds[index].data.value;
      }
      // Add new value to sum
      newDataset.data.sma = smaSum / (smaPeriod + 1);
    }
    else {
      // If not enough datapoints
      newDataset.data.sma = null;
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

    // Update seriesAverage
    newDataset.data.seriesAverage = (seriesSum + value) / (ds.length + 1);
    // Update min/max

    newDataset.data.seriesMinimum = Math.min(...valArr);
    newDataset.data.seriesMaximum = Math.max(...valArr);

    return newDataset;
  }
}
