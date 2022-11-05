import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

import { AppSettingsService } from './app-settings.service';
import { WidgetManagerService } from './widget-manager.service';


interface ISplitArea {
  uuid: string; // uuid of widget of splitset, depending on type.
  type: string; //(widget|splitSet)
  size: number;
}

export interface ISplitSet {
  uuid: string;
  parentUUID?: string;
  direction: string;
  splitAreas: Array<ISplitArea>;
}

interface ISplitSetObs {
  uuid: string;
  observable: BehaviorSubject<ISplitSet>;
}

@Injectable()
export class LayoutSplitsService {

  splitSets: Array<ISplitSet> = [];
  splitSetObs: Array<ISplitSetObs> = [];
  rootUUIDs: Array<string> = [];
  activeRoot: BehaviorSubject<string> = new BehaviorSubject<string>(null);

  constructor(
    private AppSettingsService: AppSettingsService,
    private WidgetManagerService: WidgetManagerService,
    private router: Router) {
    this.splitSets = this.AppSettingsService.getSplitSets();
    // prepare subs
    for (let i=0; i<this.splitSets.length; i++) {
      this.splitSetObs.push({uuid: this.splitSets[i].uuid, observable: new BehaviorSubject(this.splitSets[i])} );
    }

    this.rootUUIDs = this.AppSettingsService.getRootSplits();
    //this.activeRoot.next(this.rootUUIDs[0]);
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

  setActiveRootIndex(index: number) {
    if (this.rootUUIDs[index]) {
      this.activeRoot.next(this.rootUUIDs[index]);
    } else {
      this.activeRoot.next(this.rootUUIDs[0]);
    }
  }

  nextRoot() {
    let currentIndex = this.rootUUIDs.indexOf(this.activeRoot.getValue());
    if (currentIndex == -1) {
      this.router.navigate(['/page', 0]);
    } else if (this.router.url != "/settings") {
      this.router.navigate(['/page', currentIndex + 1]);
    } else {
      this.router.navigate(['/page', currentIndex]);
    }
  }

  previousRoot() {
    let currentIndex = this.rootUUIDs.indexOf(this.activeRoot.getValue());
    if (currentIndex == -1) {
      this.router.navigate(['/page', 0]);
    } else if (this.router.url != "/settings") {
      if (currentIndex == 0) {
        this.router.navigate(['/page', this.rootUUIDs.length - 1]);
      } else {
        this.router.navigate(['/page', currentIndex - 1]);
      }
    } else {
      this.router.navigate(['/page', currentIndex]);
    }
  }

  getSplitObs(uuid:string) {
    let splitIndex = this.splitSetObs.findIndex(sSet => sSet.uuid == uuid);
    if (splitIndex < 0) { return null; }
    return this.splitSetObs[splitIndex].observable.asObservable();
  }

  getSplit(uuid:string) {
    let splitIndex = this.splitSets.findIndex(sSet => sSet.uuid == uuid);
    if (splitIndex < 0) { return null; }
    return this.splitSets[splitIndex];
  }

   //should only ever be called when changing directions. widgetUUID of area we're splitting
   // becomes first area of new split
  newSplit(parentUUID: string, direction: string, widget1UUID: string, widget2UUID) {
    let uuid = this.newUuid();
    let newSplit: ISplitSet = {
      uuid: uuid,
      parentUUID: parentUUID,
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
    this.splitSetObs.push({uuid: uuid, observable: new BehaviorSubject(newSplit)})
    return uuid;
  }

  newRootSplit() {
    //create new root split
    let uuid = this.newUuid();
    let newWidget = this.WidgetManagerService.newWidget();
    let newRootSplit: ISplitSet = {
      uuid: uuid,
      direction: 'horizontal',
      splitAreas: [ {uuid: newWidget, type: 'widget', size: 100}]
    }
    this.splitSets.push(newRootSplit);

    this.splitSetObs.push({uuid: uuid, observable: new BehaviorSubject(newRootSplit)});

    this.rootUUIDs.push(uuid);
    this.saveRootUUIDs();

    //get index of our new split
    this.router.navigate(['/page', this.rootUUIDs.indexOf(uuid)]);
  }

  splitArea(splitSetUUID: string, areaUUID: string, direction: string) {
    let splitIndex = this.splitSets.findIndex(sSet => sSet.uuid == splitSetUUID);
    if (splitIndex < 0) { return null; }
    let areaIndex = this.splitSets[splitIndex].splitAreas.findIndex(
                area => area.uuid == areaUUID
            );
    if (areaIndex < 0) { return; } // not found....

    // get current size so we can split it in two
    let currentSize = this.splitSets[splitIndex].splitAreas[areaIndex].size;
    let area1Size = currentSize / 2;
    let area2Size = currentSize - area1Size;

    let newWidgetUUID = this.WidgetManagerService.newWidget();
    let newArea = {
        uuid: newWidgetUUID,
        type: 'widget',
        size: area2Size
        };

    // test currect direction. If we're splitting in same direction, we just add another
    // area. If we're splitting in other direction, we need a new splitSet...
    if (this.splitSets[splitIndex].direction == direction) {

      // same direction, add new area after specified area

      this.splitSets[splitIndex].splitAreas[areaIndex].size = area1Size;
      this.splitSets[splitIndex].splitAreas.splice(areaIndex+1, 0, newArea);

    } else {
      let newSplitUUID = this.newSplit(splitSetUUID, direction, areaUUID, newWidgetUUID);
      this.splitSets[splitIndex].splitAreas[areaIndex].uuid = newSplitUUID;
      this.splitSets[splitIndex].splitAreas[areaIndex].type = 'splitSet';
    }
    this.updateSplit(splitSetUUID);
  }

  updateSplitSizes(splitSetUUID: string, sizesArray: Array<number>) {
    let splitIndex = this.splitSets.findIndex(sSet => sSet.uuid == splitSetUUID);
    if (splitIndex < 0) { return null; }
    for (let i=0; i < sizesArray.length; i++) {
      this.splitSets[splitIndex].splitAreas[i].size = sizesArray[i];
    }
    this.updateSplit(splitSetUUID);
  }


  deleteArea(splitSetUUID, areaUUID) {

    let splitIndex = this.splitSets.findIndex(sSet => sSet.uuid == splitSetUUID);
    if (splitIndex < 0) { return null; }
    // if num of areas in split > 1, delete the area from the splitset.
    // delete widget too! :P
    if (this.splitSets[splitIndex].splitAreas.length > 1) {
      // delete widget
      this.WidgetManagerService.deleteWidget(areaUUID);

      //delete Area
      let areaIndex = this.splitSets[splitIndex].splitAreas.findIndex(w => w.uuid == areaUUID)
      if (areaIndex < 0) { return null; } // not found?
      //delete area
      this.splitSets[splitIndex].splitAreas.splice(areaIndex,1);
      this.updateSplit(splitSetUUID);

    } else {
      // We're the last area in the splitset, so delete the whole splitset
      this.WidgetManagerService.deleteWidget(areaUUID);

      if (this.isRootSplit(splitSetUUID)) {
        // We're the rootsplit, bye bye page
        console.log('[LayoutSplit Service] Deleting last split in root');

        //delete this splitset...
        this.splitSets.splice(splitIndex, 1);

        //remove from rootUUIDs
        let rootIndex = this.rootUUIDs.findIndex( uuid => uuid == splitSetUUID);
        this.rootUUIDs.splice(rootIndex,1);
        this.saveRootUUIDs();

        if (this.rootUUIDs.length <= 0) {
          // no more roots, we need at least one
          console.log("[LayoutSplit Service] Deleted last page");
          this.newRootSplit();
          this.setActiveRootIndex(0);
        }

        this.nextRoot();
      } else {
        // we're not the root, so find parent split and clear there.

        // find parent split,
        let parentIndex = this.splitSets.findIndex( sSet => sSet.uuid == this.splitSets[splitIndex].parentUUID);
        let parentUUID = this.splitSets[parentIndex].uuid;

        //delete this splitset...
        this.splitSets.splice(splitIndex, 1);
        // we don't delete the sub, otherwise might get areas

        this.deleteArea(parentUUID, splitSetUUID);
        }


    }



  }

  updateSplit(splitSetUUID: string) {
    let splitIndex = this.splitSets.findIndex(sSet => sSet.uuid == splitSetUUID);
    if (splitIndex < 0) { return null; }

    let subIndex = this.splitSetObs.findIndex(sSet => sSet.uuid == splitSetUUID);
    if (subIndex < 0) { return null; }

    this.splitSetObs[subIndex].observable.next(this.splitSets[splitIndex]);
    this.saveSplits();
  }

  isRootSplit(uuid: string) {
    return this.rootUUIDs.includes(uuid);
  }

  saveRootUUIDs() {
    this.AppSettingsService.saveRootUUIDs(this.rootUUIDs);
  }

  saveSplits() {
    this.AppSettingsService.saveSplitSets(this.splitSets);
  }

}
