import { Injectable } from '@angular/core';
import { Subscription ,  Observable ,  BehaviorSubject, interval } from 'rxjs';
import { AppSettingsService } from './app-settings.service';
import { SignalKService } from './signalk.service';


export interface dataPoint {
  timestamp: number;
  average: number;
  minValue: number;
  maxValue: number;
}

interface dataCache {
  runningTotal: number;
  numberOfPoints: number;
  minValue: number;
  maxValue: number;
}

export interface IDataSet {
  uuid: string;
  path: string;
  signalKSource: string;
  updateTimer: number; //number of seconds between new dataPoints
  dataPoints: number; // how many datapoints do we keep?
  name?:  string; // sometimes used for display purposes
};


interface DataSetSub {
  uuid: string;
  pathSub: Subscription;
  updateTimerSub: Subscription;
  data: dataPoint[];
  dataCache: dataCache // running calculations
};

interface registration {
  uuid: string;
  dataSetUuid: string;
  observable: BehaviorSubject<Array<dataPoint>>;
}

@Injectable()
export class DataSetService {

  dataSets: IDataSet[] = [];
  dataSetSub: DataSetSub[] = [];
  dataSetRegister: registration[] = [];

  constructor(
    private AppSettingsService: AppSettingsService,
    private SignalKService: SignalKService,
  ) {
      this.dataSets = AppSettingsService.getDataSets();
  }

  public startAllDataSets() {
    console.log("Starting " + this.dataSets.length.toString() + " DataSets");
    for (let i = 0; i < this.dataSets.length; i++) {
      this.startDataSet(this.dataSets[i].uuid);
    }
  }

  private newUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }

  public subscribeDataSet(uuid, dataSetUuid) {
    //see if already subscribed, if yes return that...
    let registerIndex = this.dataSetRegister.findIndex(registration => (registration.uuid == uuid) && (registration.dataSetUuid == dataSetUuid));
    if (registerIndex >= 0) { // exists
      return this.dataSetRegister[registerIndex].observable.asObservable();
    }


    //find if we already have a value for this dataSet to return.
    let currentDataSet: dataPoint[];
    let dataIndex = this.dataSetSub.findIndex(dataSet => dataSet.uuid == dataSetUuid);
    if (dataIndex >= 0) { // exists
      currentDataSet = this.dataSetSub[dataIndex].data;
    } else {
      currentDataSet = null;
    }

    //register
    this.dataSetRegister.push({
      uuid: uuid,
      dataSetUuid: dataSetUuid,
      observable: new BehaviorSubject<Array<dataPoint>>(currentDataSet)
    });
    // should be subscribed now, use search now as maybe someone else adds something and it's no longer last in array :P
    registerIndex = this.dataSetRegister.findIndex(registration => (registration.uuid == uuid) && (registration.dataSetUuid == dataSetUuid));
    return this.dataSetRegister[registerIndex].observable.asObservable();
  }

  private stopDataSet(uuid: string) {
    // stop any registrations to this dataset...
    for (let i = this.dataSetRegister.length-1; i >= 0; i--) { //backwards because lengh will change...
      if (this.dataSetRegister[i].uuid == uuid) {
        this.dataSetRegister.splice(i,1);
      }
    }

     //delete current DataSetSub if it exists...
    let dataSubIndex = this.dataSetSub.findIndex(dataSub => dataSub.uuid == uuid);
    if (dataSubIndex >= 0) {
      // stop pathSub
      this.dataSetSub[dataSubIndex].pathSub.unsubscribe();
      //stop TimerSub
      this.dataSetSub[dataSubIndex].updateTimerSub.unsubscribe();
      //delete DataSub
      this.dataSetSub.splice(dataSubIndex,1);
     }
  }

  private startDataSet(uuid: string) {
    let dataIndex = this.dataSets.findIndex(dataSet => dataSet.uuid == uuid);
    if (dataIndex < 0) { return; }//not found...

    //delete current DataSetSub if it exists...
    let dataSubIndex = this.dataSetSub.findIndex(dataSub => dataSub.uuid == uuid);
    if (dataSubIndex >= 0) {
      this.dataSetSub.splice(dataSubIndex,1);
    }

    this.dataSetSub.push({
      uuid: uuid,
      pathSub: null,
      updateTimerSub: null,
      data: null,
      dataCache: null,
    });
    dataSubIndex = this.dataSetSub.findIndex(dataSub => dataSub.uuid == uuid);


    // initialize data
    this.dataSetSub[dataSubIndex].data = [];
    //for (let i=0; i<this.dataSets[dataIndex].dataPoints; i++) {
    //    this.dataSetSub[dataSubIndex].data.push(null);
    //}

    // inistialize dataCache
    this.dataSetSub[dataSubIndex].dataCache = {
        runningTotal: 0,
        numberOfPoints: 0,
        minValue: null,
        maxValue: null
    }

    //Subscribe to path data
    this.dataSetSub[dataSubIndex].pathSub = this.SignalKService.subscribePath(this.dataSets[dataIndex].uuid, this.dataSets[dataIndex].path, this.dataSets[dataIndex].signalKSource).subscribe(
      newValue => {
        this.updateDataCache(uuid, newValue.value);
    });

    // start update timer
    this.dataSetSub[dataSubIndex].updateTimerSub = interval (1000 * this.dataSets[dataIndex].updateTimer).subscribe(x => {
        this.aggregateDataCache(uuid);
    });

  }

  public addDataSet(path: string, source: string, updateTimer: number, dataPoints: number ) {
    let uuid = this.newUuid();

    let newSub: IDataSet = {
      uuid: uuid,
      path: path,
      signalKSource: source,
      updateTimer: updateTimer,
      dataPoints: dataPoints
    };
    this.dataSets.push(newSub);

    this.startDataSet(uuid);
    this.AppSettingsService.saveDataSets(this.dataSets);
  }

  public updateDataset(dataset: IDataSet): void {
    // index of sub and dataset can be different after updating datasets
    // get sub index for this dataset
    let datasetSubIndex = this.dataSetSub.findIndex(sub => sub.uuid === dataset.uuid);
    if (datasetSubIndex >= 0) { // sub exist
      this.stopDataSet(dataset.uuid);
    }

    // get index for this dataset
    let datasetIndex = this.dataSets.findIndex(dset => dset.uuid === dataset.uuid);
    if (datasetIndex >= 0) { // dataset exist
      this.dataSets.splice(datasetIndex, 1, dataset);
      this.startDataSet(dataset.uuid);
    }

    this.AppSettingsService.saveDataSets(this.dataSets);
  }

  public deleteDataSet(uuid: string) {
    // index of sub and dataset can be different after updating datasets
    // get sub index
    let datasetSubIndex = this.dataSetSub.findIndex(sub => sub.uuid === uuid);
    if (datasetSubIndex >= 0) { // sub exist
      this.stopDataSet(uuid);
    }

     // get index for this dataset
    let datasetIndex = this.dataSets.findIndex(dset => dset.uuid === uuid);
    if (datasetIndex >= 0) { // dataset exist
      this.dataSets.splice(datasetIndex,1);
    }

    this.AppSettingsService.saveDataSets(this.dataSets);
  }

  public getDataSets(): IDataSet[] {
    let result: IDataSet[] = [];
    for (let i=0;i<this.dataSets.length; i++) {

      let name = this.dataSets[i].path + ' - Interval:' + this.dataSets[i].updateTimer.toString() + ' - DataPoints:' + this.dataSets[i].dataPoints.toString()
      result.push({
        uuid: this.dataSets[i].uuid,
        path: this.dataSets[i].path,
        signalKSource: this.dataSets[i].signalKSource,
        updateTimer: this.dataSets[i].updateTimer,
        dataPoints: this.dataSets[i].dataPoints,
        name: name
      });
    }
    return result;
  }

  private aggregateDataCache(uuid: string) {
    let avg: number = null;

    //get index
    let dataSetIndex = this.dataSets.findIndex(sub => sub.uuid == uuid);
    let dataSubIndex = this.dataSetSub.findIndex(sub => sub.uuid == uuid);

    // update average
    if (this.dataSetSub[dataSubIndex].dataCache.numberOfPoints > 0) { // if it's still 0, we had no update this timeperiod so leave it as null...
      avg = this.dataSetSub[dataSubIndex].dataCache.runningTotal / this.dataSetSub[dataSubIndex].dataCache.numberOfPoints;
    }

    // remove first item if we have dataPoints points.
    if (this.dataSetSub[dataSubIndex].data.length >= this.dataSets[dataSetIndex].dataPoints) {
      this.dataSetSub[dataSubIndex].data.shift();
    }

    // add our new dataPoint to end of dataset.
    let newDataPoint: dataPoint = {
      timestamp: Date.now(),
      average: avg,
      minValue: this.dataSetSub[dataSubIndex].dataCache.minValue,
      maxValue: this.dataSetSub[dataSubIndex].dataCache.maxValue
    }
    this.dataSetSub[dataSubIndex].data.push(newDataPoint);

    // reset dataCache
    this.dataSetSub[dataSubIndex].dataCache = {
          runningTotal: 0,
          numberOfPoints: 0,
          minValue: null,
          maxValue: null
      }
    // ... push to registered graphs...

    for (let i = 0; i < this.dataSetRegister.length;  i++) {
      if (this.dataSetRegister[i].dataSetUuid == uuid) {
        this.dataSetRegister[i].observable.next(this.dataSetSub[dataSubIndex].data);
      }
    }
  }

  private updateDataCache(uuid: string, newValue: number) {
    //get index
    let dsIndex = this.dataSetSub.findIndex(sub => sub.uuid == uuid);

    this.dataSetSub[dsIndex].dataCache.runningTotal = this.dataSetSub[dsIndex].dataCache.runningTotal + newValue;
    this.dataSetSub[dsIndex].dataCache.numberOfPoints = this.dataSetSub[dsIndex].dataCache.numberOfPoints + 1;

    if ((this.dataSetSub[dsIndex].dataCache.minValue === null) || (this.dataSetSub[dsIndex].dataCache.minValue > newValue)) {
      this.dataSetSub[dsIndex].dataCache.minValue = newValue;
    }
    if ((this.dataSetSub[dsIndex].dataCache.maxValue === null) || (this.dataSetSub[dsIndex].dataCache.maxValue < newValue)) {
      this.dataSetSub[dsIndex].dataCache.maxValue = newValue;
    }
  }

}
