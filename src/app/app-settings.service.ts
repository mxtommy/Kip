import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Router } from '@angular/router';


import { IDataSet } from './data-set.service';
import { ISplitSet } from './layout-splits.service';
import { IWidget } from './widget-manager.service';
import { IDerivation } from './derived.service';

import { BlankConfig } from './blank-config.const';
import { DemoConfig } from './demo-config.const';

const defaultSignalKUrl = 'http://demo.signalk.org/signalk';
const defaultUnlockStatus = false;
const defaultTheme = 'default-light';

interface appSettings {
  signalKUrl: string;
  themeName: string;
  widgets: Array<IWidget>; 
  unlockStatus: boolean;
  dataSets: IDataSet[];
  splitSets: ISplitSet[];
  rootSplits: string[];
  derivations: IDerivation[];
}


@Injectable()
export class AppSettingsService {



  signalKUrl: BehaviorSubject<string> = new BehaviorSubject<string>(defaultSignalKUrl); // this should be overwritten right away when loading settings, but you need to give something...
  unlockStatus: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  widgets: Array<IWidget>;

  splitSets: ISplitSet[] = [];
  rootSplits: string[] = [];
  derivations: IDerivation[] = [];

  themeName: BehaviorSubject<string> = new BehaviorSubject<string>(defaultTheme);
  dataSets: IDataSet[] = [];
  root

  constructor(
    private router: Router) {
    if (localStorage.getItem('signalKData') == null) {
      localStorage.setItem('signalKData', JSON.stringify(BlankConfig));
    }

    let storageObject: appSettings = JSON.parse(localStorage.getItem('signalKData'));
    this.signalKUrl.next(storageObject['signalKUrl']);
    this.themeName.next(storageObject['themeName']);
    this.widgets = storageObject.widgets;
    this.unlockStatus.next(storageObject['unlockStatus']);
    this.dataSets = storageObject.dataSets;
    this.splitSets = storageObject.splitSets;
    this.rootSplits = storageObject.rootSplits;
    this.derivations = storageObject.derivations;
      
  }





  // SignalKURL
  getSignalKURLAsO() {
    return this.signalKUrl.asObservable();
  }
  getSignalKURL() {
    return this.signalKUrl.getValue();
  }
  setSignalKURL(value) {
    this.signalKUrl.next(value);
    this.saveToLocalStorage();
  }

  // UnlockStatus
  getUnlockStatusAsO() {
    return this.unlockStatus.asObservable();
  }
  setUnlockStatus(value) {
    this.unlockStatus.next(value);
    this.saveToLocalStorage();
  }

  // Themes
  getThemeNameAsO() {
    return this.themeName.asObservable();
  }
  setThemName(newName: string) {
    this.themeName.next(newName);
    this.saveToLocalStorage();
  }

  // Widgets
  getWidgets() {
    return this.widgets;
  }
  saveWidgets(widgets: Array<IWidget>) {
    this.widgets = widgets;
    this.saveToLocalStorage();
  }


   // Layout SplitSets
  getSplitSets() {
    return this.splitSets;
  }
  getRootSplits() {
    return this.rootSplits;
  }
  saveSplitSets(splitSets) {
    this.splitSets = splitSets;
    this.saveToLocalStorage();
  }

  // DataSets
  saveDataSets(dataSets) {
    this.dataSets = dataSets;
    this.saveToLocalStorage();
  }
  getDataSets() {
    return this.dataSets;
  }

  // derivations
  getDerivations() {
    return this.derivations;
  }
  saveDerivations(derivations: IDerivation[]) {
    this.derivations = derivations;
    this.saveToLocalStorage();
  }

  // saving. 


  buildStorageObject() {
    let storageObject: appSettings = {
      signalKUrl: this.signalKUrl.getValue(),
      themeName: this.themeName.getValue(),
      widgets: this.widgets,
      unlockStatus: this.unlockStatus.getValue(),
      dataSets: this.dataSets,
      splitSets: this.splitSets,
      rootSplits: this.rootSplits,
      derivations: this.derivations
    }
    return storageObject;
  }

  getConfigJson() {
    return JSON.stringify(this.buildStorageObject(), null, 2);
  }

  replaceConfig(jsonConfig:string) {
    localStorage.setItem('signalKData', jsonConfig);
    this.router.navigate(['/']);
    location.reload();
  }

  saveToLocalStorage() {
    localStorage.setItem('signalKData', JSON.stringify(this.buildStorageObject()));
  }

  resetSettings() {
    this.replaceConfig(JSON.stringify(BlankConfig));
  }

  loadDemoConfig() {
    this.replaceConfig(JSON.stringify(DemoConfig));    
  }

}
