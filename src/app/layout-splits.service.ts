import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';


import { AppSettingsService } from './app-settings.service';


interface ISplitArea {
  uuid: string; // uuid of widget of splitset, depending on type.
  type: string; //(widget|splitSet)
  size: number;
}

export interface ISplitSet {
  uuid: string;
  direction: string;
  splitAreas: Array<ISplitArea>;
}

@Injectable()
export class LayoutSplitsService {

  splitSets: Array<ISplitSet> = [];
  rootUUIDs: Array<string> = [];
  activeRoot: BehaviorSubject<string> = new BehaviorSubject<string>(null);
  
  constructor(
    private AppSettingsService: AppSettingsService) {
      
      this.splitSets = this.AppSettingsService.getSplitSets(); 
      this.rootUUIDs = this.AppSettingsService.getRootSplits();
      this.activeRoot.next(this.rootUUIDs[0]);
    }

  getActiveRootSub() {
    return this.activeRoot.asObservable();
  }
  
  getSplit(uuid:string) {
    let splitIndex = this.splitSets.findIndex(sSet => sSet.uuid == uuid);
    if (splitIndex < 0) { return null; }
    return this.splitSets[splitIndex];
  }

  saveSplit(uuid: string, areas: ISplitArea[])  {
    let splitIndex = this.splitSets.findIndex(sSet => sSet.uuid == uuid);
    if (splitIndex < 0) { return null; }
    this.splitSets[splitIndex].splitAreas = areas;
    this.saveSplits();
  }

  saveSplits() {
    this.AppSettingsService.saveSplitSets(this.splitSets);
  }

}
