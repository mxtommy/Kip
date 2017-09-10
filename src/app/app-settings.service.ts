import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { TreeNode, TreeLink } from './tree-manager.service';


const defaultSignalKUrl = 'http://demo.signalk.org/signalk';
const defaultUnlockStatus = false;


const defaultTreeNodes: TreeNode[] = [ { uuid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx', name: "Home Page", nodeType: "WidgetTextGeneric", nodeData: null } ];
const defaultTreeLinks: TreeLink[] = [ { parent: 'ROOT', child: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' }];

interface appSettings {
  signalKUrl: string;
  treeNodes: TreeNode[];
  treeLinks: TreeLink[];
  unlockStatus: boolean;
}


@Injectable()
export class AppSettingsService {



  signalKUrl: BehaviorSubject<string> = new BehaviorSubject<string>('http://demo.signalk.org/signalk'); // this should be overwritten right away when loading settings, but you need to give something...
  unlockStatus: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  treeNodes: TreeNode[] = [];
  treeLinks: TreeLink[] = [];

  constructor() {
    if (localStorage.getItem('signalKData') == null) {

      this.signalKUrl.next(defaultSignalKUrl);
      this.unlockStatus.next(defaultUnlockStatus);
      this.treeNodes = defaultTreeNodes;
      this.treeLinks = defaultTreeLinks;
    } else {
      let storageObject: appSettings = JSON.parse(localStorage.getItem('signalKData'));

      console.log(this.signalKUrl.getValue());
      console.log(storageObject);
      this.signalKUrl.next(storageObject['signalKUrl']);
      this.unlockStatus.next(storageObject['unlockStatus']);
      this.treeNodes = storageObject.treeNodes;
      this.treeLinks = storageObject.treeLinks;

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


  saveTree(treeNodes: TreeNode[], treeLinks: TreeLink[]) {
    this.treeNodes = treeNodes; 
    this.treeLinks = treeLinks;
    this.saveToLocalStorage();
  }
  loadTreeNodes() {
    console.log(this.treeNodes);
    return this.treeNodes;
  }
  loadTreeLinks() {
    return this.treeLinks;
  }
  // saveing. 

  saveToLocalStorage() {

    let storageObject: appSettings = {
      signalKUrl: this.signalKUrl.getValue(),
      treeNodes: this.treeNodes,
      treeLinks: this.treeLinks,
      unlockStatus: this.unlockStatus.getValue()
    }

    localStorage.setItem('signalKData', JSON.stringify(storageObject));
  }

  deleteSettings() {
    localStorage.removeItem('signalKData');
    location.reload();
  }
}
