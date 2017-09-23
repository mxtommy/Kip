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

  private newUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
  }

  getActiveRootSub() {
    return this.activeRoot.asObservable();
  }
  
  getSplit(uuid:string) {
    let splitIndex = this.splitSets.findIndex(sSet => sSet.uuid == uuid);
    if (splitIndex < 0) { return null; }
    return this.splitSets[splitIndex];
  }

   //should only ever be called when changing directions. widgetUUID of area we're splitting 
   // becomes first area of new split
  newSplit(direction: string, widget1UUID: string, widget2UUID) {
    let uuid = this.newUuid();
    let newSplit: ISplitSet = {
      uuid: uuid,
      direction: direction,
      splitAreas: [
        {
          uuid: widget1UUID,
          type: 'widget',
          size: 50
        },
        {
          uuid: widget2UUID,
          type: 'widget',
          size: 50
        }
      ]
    }
    this.splitSets.push(newSplit);
    return uuid;
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
