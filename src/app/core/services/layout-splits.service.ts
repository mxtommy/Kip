import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

import { AppSettingsService } from './app-settings.service';
import { WidgetManagerService } from './widget-manager.service';
import { UUID } from '../../utils/uuid'
import { IAreaSize, IOutputAreaSizes, ISplitDirection } from 'angular-split';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';


export interface ISplitArea {
  uuid: string; // uuid of area. Area can contain widget or splitSet.
  type: string; //(widget|splitSet)
  size: IAreaSize;
}

export interface ISplitSet {
  uuid: string;
  parentUUID?: string;
  direction: ISplitDirection;
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
    if (this.router.url == "/settings" || this.router.url == "/data" || this.router.url == "/help") {
      this.router.navigate(['/page', currentIndex]);
    } else if ((currentIndex == -1) || ((currentIndex + 1) == this.rootUUIDs.length)) {
      this.router.navigate(['/page', 0]);
    } else {
      this.router.navigate(['/page', currentIndex + 1]);
    }
  }

  previousRoot() {
    let currentIndex = this.rootUUIDs.indexOf(this.activeRoot.getValue());
    if (this.router.url == "/settings" || this.router.url == "/data" || this.router.url == "/help") {
      this.router.navigate(['/page', currentIndex]);
    } else if (currentIndex >= 1) {
      this.router.navigate(['/page', currentIndex -1]);
    } else {
      this.router.navigate(['/page', this.rootUUIDs.length - 1]);
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

  // should only ever be called when changing directions. widgetUUID of area we're splitting
  // becomes first area of new split
  newSplit(parentUUID: string, direction: ISplitDirection, currentWidgetUUID: string, newWidgetUUID: string) {
    const uuid = UUID.create();
    const newSplit: ISplitSet = {
      uuid: uuid,
      parentUUID: parentUUID,
      direction: direction,
      splitAreas: [
        {
          uuid: currentWidgetUUID,
          type: 'widget',
          size: 50
        },
        {
          uuid: newWidgetUUID,
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
    const uuid = UUID.create();
    const newWidget = this.WidgetManagerService.newWidget();
    const newRootSplit: ISplitSet = {
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

  splitArea(splitSetUUID: string, areaUUID: string, direction: ISplitDirection): void {
    const split = this.splitSets.find(split => split.uuid == splitSetUUID);
    if (split) {
      const area = split.splitAreas.find(area => area.uuid == areaUUID
);
      if (area) {
        // get current size so we can split it in two
        const currentSize = area.size;
        const area1Size = Number(currentSize) / 2;
        const area2Size = Number(currentSize) - area1Size;

        const newWidgetUUID = this.WidgetManagerService.newWidget();
        const newArea = {
          uuid: newWidgetUUID,
          type: 'widget',
          size: area2Size
        };

        // test correct direction. If we're splitting in same direction, we just add another
        // area. If we're splitting in other direction, we need a new splitSet...
        if (split.direction == direction) {
          area.size = area1Size;
          const areaIndex = split.splitAreas.findIndex(area => area.uuid == areaUUID);
          split.splitAreas.splice(areaIndex + 1, 0, newArea);

        } else {
        const newSplitUUID = this.newSplit(splitSetUUID, direction, areaUUID, newWidgetUUID);
        area.uuid = newSplitUUID;
        area.type = 'splitSet';
        }
        this.updateSplit(split);
      }
    }
  }

  updateSplitSizes(splitSetUUID: string, sizesArray: IOutputAreaSizes): void {
    const split = this.splitSets.find(split => split.uuid == splitSetUUID);
    if (split) {
      for (let i = 0; i < sizesArray.length; i++) {
        split.splitAreas[i].size = sizesArray[i];
      }
      this.updateSplit(split);
    }
  }


  public deleteArea(splitSetUUID: string, areaUUID: string): void {
    const split = this.splitSets.find(split => split.uuid == splitSetUUID);
    if (split) {
      this.WidgetManagerService.deleteWidget(areaUUID);

      // if not last areas in this split, delete area that contained the widget
      if (split.splitAreas.length > 1) {
        const areaIndex = split.splitAreas.findIndex(area => area.uuid == areaUUID)
        if (areaIndex < 0) { return null; } // not found?
        split.splitAreas.splice(areaIndex, 1);
        this.updateSplit(split);

      } else {
        // We're the last area in the splitSet. Delete area and split container.
        const splitIndex = this.splitSets.findIndex( split => split.uuid == splitSetUUID);
        // We're the rootSplit, delete root split (will delete the page)
        if (this.isRootSplit(splitSetUUID)) {
          this.splitSets.splice(splitIndex, 1);
          this.splitSetObs.find(splitObs => splitObs.uuid === splitSetUUID).observable.complete();
          this.splitSetObs.splice(this.splitSetObs.findIndex(splitObs => splitObs.uuid === splitSetUUID), 1);


          const rootIndex = this.rootUUIDs.findIndex( uuid => uuid == splitSetUUID);
          this.rootUUIDs.splice(rootIndex, 1);
          this.saveRootUUIDs();

          if (this.rootUUIDs.length <= 0) {
            // no more roots, we need at least one to have a default page with blank widget
            this.newRootSplit();
            this.setActiveRootIndex(0);
          }
          this.nextRoot();
        } else {
          // we're not the root, keep the area abd parent UUID for delete.
          const parentIndex = this.splitSets.findIndex(splitParent => splitParent.uuid == split.parentUUID);
          const parentUUID = this.splitSets[parentIndex].uuid;

          // delete split, stop observers and remove from split Observer array
          this.splitSets.splice(splitIndex, 1);
          this.splitSetObs.find(splitObs => splitObs.uuid === splitSetUUID).observable.complete();
          this.splitSetObs.splice(this.splitSetObs.findIndex(splitObs => splitObs.uuid === splitSetUUID), 1);
          // we don't delete the sub, otherwise might get areas

          // delete area from parent
          this.deleteArea(parentUUID, splitSetUUID);
        }
      }
    }
  }

  private updateSplit(split: ISplitSet): void {
    const splitSub = this.splitSetObs.find(sSet => sSet.uuid == split.uuid);
    if (splitSub) {
      splitSub.observable.next(split);
      this.saveSplits();
    }
  }

  /**
   * Checks if the given UUID is a root UUID.
   *
   * @param {string} uuid - The UUID to check.
   * @returns {boolean} True if the UUID is a root UUID, false otherwise.
   */
  isRootSplit(uuid: string): boolean {
    return this.rootUUIDs.includes(uuid);
  }

  saveRootUUIDs() {
    this.AppSettingsService.saveRootUUIDs(this.rootUUIDs);
  }

  saveSplits() {
    this.AppSettingsService.saveSplitSets(this.splitSets);
  }

  public dropArea(event: CdkDragDrop<ISplitSet[]>, splitSetUUID: string): void {
    const split = this.splitSets.find(split => split.uuid === splitSetUUID)
    moveItemInArray(split.splitAreas, event.previousIndex, event.currentIndex);
    this.updateSplit(split);
  }
}
