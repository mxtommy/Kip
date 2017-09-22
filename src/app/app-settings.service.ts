import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { TreeNode, TreeLink } from './tree-manager.service';
import { DataSet } from './data-set.service';
import { ISplitSet } from './layout-splits.service';

const defaultSignalKUrl = 'http://demo.signalk.org/signalk';
const defaultUnlockStatus = false;

const defaultSplitSet: ISplitSet[] = [ { uuid: 'isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx', direction: 'horizontal', splitAreas: [ { uuid: 'widgetno-1xxx-4xxx-yxxx-xxxxxxxxxxxx', type: 'widget', size: 40 }, { uuid: 'widgetno-2xxx-4xxx-yxxx-xxxxxxxxxxxx', type: 'widget', size: 60 } ]} ];
const defaultRootSplits: string[] = ['isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'];
const defaultTreeNodes: TreeNode[] = [ { uuid: 'widgetno-1xxx-4xxx-yxxx-xxxxxxxxxxxx', name: "Home Page", nodeType: "WidgetBlank", nodeData: null }, { uuid: 'widgetno-2xxx-4xxx-yxxx-xxxxxxxxxxxx', name: "Home Page2", nodeType: "WidgetBlank", nodeData: null } ];
const defaultTreeLinks: TreeLink[] = [ { parent: 'ROOT', child: 'widgetno-xxxx-4xxx-yxxx-xxxxxxxxxxxx' }];
const defaultDataSets: DataSet[] = [];

interface appSettings {
  signalKUrl: string;
  treeNodes: TreeNode[];
  treeLinks: TreeLink[];
  unlockStatus: boolean;
  dataSets: DataSet[];
  splitSets: ISplitSet[];
  rootSplits: string[];
}


@Injectable()
export class AppSettingsService {



  signalKUrl: BehaviorSubject<string> = new BehaviorSubject<string>('http://demo.signalk.org/signalk'); // this should be overwritten right away when loading settings, but you need to give something...
  unlockStatus: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  treeNodes: TreeNode[] = [];
  treeLinks: TreeLink[] = [];
  splitSets: ISplitSet[] = [];
  rootSplits: string[] = [];

  dataSets: DataSet[] = [];
  root

  constructor() {
    if (localStorage.getItem('signalKData') == null) {

      this.signalKUrl.next(defaultSignalKUrl);
      this.unlockStatus.next(defaultUnlockStatus);
      this.treeNodes = defaultTreeNodes;
      this.treeLinks = defaultTreeLinks;
      this.dataSets = defaultDataSets;
      this.splitSets = defaultSplitSet;
      this.rootSplits = defaultRootSplits
    } else {
      let storageObject: appSettings = JSON.parse(localStorage.getItem('signalKData'));
      this.signalKUrl.next(storageObject['signalKUrl']);
      this.unlockStatus.next(storageObject['unlockStatus']);
      this.treeNodes = storageObject.treeNodes;
      this.treeLinks = storageObject.treeLinks;
      this.dataSets = storageObject.dataSets;
      this.splitSets = storageObject.splitSets;
      this.rootSplits = storageObject.rootSplits;
    }   
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

  // Trees
  saveTree(treeNodes: TreeNode[], treeLinks: TreeLink[]) {
    this.treeNodes = treeNodes; 
    this.treeLinks = treeLinks;
    this.saveToLocalStorage();
  }
  loadTreeNodes() {
    return this.treeNodes;
  }
  loadTreeLinks() {
    return this.treeLinks;
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

  // saving. 

  saveToLocalStorage() {

    let storageObject: appSettings = {
      signalKUrl: this.signalKUrl.getValue(),
      treeNodes: this.treeNodes,
      treeLinks: this.treeLinks,
      unlockStatus: this.unlockStatus.getValue(),
      dataSets: this.dataSets,
      splitSets: this.splitSets,
      rootSplits: this.rootSplits
    }

    localStorage.setItem('signalKData', JSON.stringify(storageObject));
  }

  deleteSettings() {
    localStorage.removeItem('signalKData');
    location.reload();
  }
}
