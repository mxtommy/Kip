import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { TreeNode, TreeLink } from './tree-manager.service';


const defaultSignalKUrl = 'http://demo.signalk.org/signalk';
const defaultUnlockStatus = false;

interface appSettings {
  signalKUrl: string;
  treeNodes: TreeNode[];
  treeLinks: TreeLink[];
  unlockStatus: boolean;
}


@Injectable()
export class AppSettingsService {



  signalKUrl: BehaviorSubject<string> = new BehaviorSubject<string>('http://localhost:3000/signalk');
  unlockStatus: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  treeNodes: TreeNode[];
  treeLinks: TreeLink[];

  constructor() {
    this.loadFromLocalStorage();
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

  loadFromLocalStorage() {
    if (localStorage.getItem('signalKData') == null) {

      this.signalKUrl.next(defaultSignalKUrl);
      this.unlockStatus.next(defaultUnlockStatus);

    } else {
      let storageObject: appSettings = JSON.parse(localStorage.getItem('signalKData'));

      console.log(this.signalKUrl.getValue());
      console.log(storageObject);
      this.signalKUrl.next(storageObject['signalKUrl']);
      this.unlockStatus.next(storageObject['unlockStatus']);
    }
    
  }

}
