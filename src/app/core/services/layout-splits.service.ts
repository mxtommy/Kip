import { Inject, Injectable, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragMove, CdkDragRelease, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

import { AppSettingsService } from './app-settings.service';
import { WidgetManagerService } from './widget-manager.service';
import { IAreaSize, IOutputAreaSizes, ISplitDirection } from 'angular-split';
import { UUID } from '../utils/uuid'

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
export class LayoutSplitsService implements OnDestroy {

  private _isEditLayout$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private _layoutEditSubscription: Subscription;
  private _lastIsEditLayout: boolean = false;
  splitSets: Array<ISplitSet> = [];
  splitSetObs: Array<ISplitSetObs> = [];
  rootUUIDs: Array<string> = [];
  activeRoot: BehaviorSubject<string> = new BehaviorSubject<string>(null);

  dropLists: CdkDropList[] = [];
  currentHoverDropListId: string = null;
  oldHoverDropListId: string = null;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private settings: AppSettingsService,
    private WidgetManagerService: WidgetManagerService,
    private router: Router) {

    this._layoutEditSubscription = this._isEditLayout$.subscribe(isEditing => {
      if (!isEditing && this._lastIsEditLayout !== isEditing) {
        this._lastIsEditLayout = isEditing;
        this.settings.saveSplitSets(this.splitSets);
      } else {
        this._lastIsEditLayout = isEditing;
      }
    });

    this.splitSets = this.settings.getSplitSets();
    // prepare subs
    for (let i = 0; i < this.splitSets.length; i++) {
      this.splitSetObs.push({uuid: this.splitSets[i].uuid, observable: new BehaviorSubject(this.splitSets[i])} );
    }

    this.rootUUIDs = this.settings.getRootSplits();
  }

  // Lock/unlock layout editing status
  public getEditLayoutObservable(): Observable<boolean> {
    return this._isEditLayout$.asObservable();
  }

  public setEditLayoutStatus(value: boolean): void {
    this._isEditLayout$.next(value);
  }

  public getActiveRootSub() {
    return this.activeRoot.asObservable();
  }

  public setActiveRootIndex(index: number) {
    if (this.rootUUIDs[index]) {
      this.activeRoot.next(this.rootUUIDs[index]);
    } else {
      this.activeRoot.next(this.rootUUIDs[0]);
    }
  }

  public nextRoot(): void {
    const currentIndex = this.rootUUIDs.indexOf(this.activeRoot.getValue());
    if (this.router.url == "/settings" || this.router.url == "/data" || this.router.url == "/help") {
      this.router.navigate(['/page', currentIndex]);
    } else if ((currentIndex == -1) || ((currentIndex + 1) == this.rootUUIDs.length)) {
      this.router.navigate(['/page', 0]);
    } else {
      this.router.navigate(['/page', currentIndex + 1]);
    }
  }

  public previousRoot(): void{
    const currentIndex = this.rootUUIDs.indexOf(this.activeRoot.getValue());
    if (this.router.url == "/settings" || this.router.url == "/data" || this.router.url == "/help") {
      this.router.navigate(['/page', currentIndex]);
    } else if (currentIndex >= 1) {
      this.router.navigate(['/page', currentIndex -1]);
    } else {
      this.router.navigate(['/page', this.rootUUIDs.length - 1]);
    }
  }

  private setRoot(index: number): void {
    this.router.navigate(['/page', index]);
  }

  public getSplitObs(uuid:string): Observable<ISplitSet> | null {
    const splitObs = this.splitSetObs.find(sSet => sSet.uuid == uuid);
    if (splitObs) {
      return splitObs.observable.asObservable();
    } else {
      return null;
    }
  }

  public getSplit(uuid:string): ISplitSet {
    let splitIndex = this.splitSets.findIndex(sSet => sSet.uuid == uuid);
    if (splitIndex < 0) { return null; }
    return this.splitSets[splitIndex];
  }

  public newRootSplit(): void {
    const currentIndex = this.rootUUIDs.indexOf(this.activeRoot.getValue());
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

    // Insert the new UUID after the current index in rootUUIDs
    this.rootUUIDs.splice(currentIndex + 1, 0, uuid);
    this.saveRootUUIDs();

    //get index of our new split
    this.router.navigate(['/page', this.rootUUIDs.indexOf(uuid)]);
  }

  public addArea(splitSetUUID: string, areaUUID: string, direction: ISplitDirection): void {
    const split = this.splitSets.find(split => split.uuid == splitSetUUID);
    if (split) {
      const currentArea = split.splitAreas.find(area => area.uuid == areaUUID
);
      if (currentArea) {
        // get current size so we can split it in two
        const reducedSize = Number(currentArea.size) / 2;
        const newAreaSize = Number(currentArea.size) - reducedSize;

        const newWidgetUUID = this.WidgetManagerService.newWidget();
        const newWidgetArea = {
          uuid: newWidgetUUID,
          type: 'widget',
          size: newAreaSize
        };

        // test correct direction. If we're splitting in same direction, we just add another
        // area. If we're splitting in other direction, we need a new splitSet...
        if (split.direction == direction) {
          currentArea.size = reducedSize;
          const areaIndex = split.splitAreas.findIndex(area => area.uuid == areaUUID);
          split.splitAreas.splice(areaIndex + 1, 0, newWidgetArea);
        } else {
          const newSplitUUID = this.addSplit(splitSetUUID, direction, areaUUID, newWidgetUUID);
          currentArea.uuid = newSplitUUID;
          currentArea.type = 'splitSet';
        }
        this.updateSplit(split);
      }
    }
  }

  // should only ever be called when changing directions. widgetUUID of area we're splitting
  // becomes first area of new split
  private addSplit(parentUUID: string, direction: ISplitDirection, currentWidgetUUID: string, newWidgetUUID: string): string {
    const newSplitUuid = UUID.create();
    const newSplit: ISplitSet = {
      uuid: newSplitUuid,
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
    this.splitSetObs.push({uuid: newSplitUuid, observable: new BehaviorSubject(newSplit)})
    return newSplitUuid;
  }

  public updateSplitSizes(splitSetUUID: string, sizesArray: IOutputAreaSizes): void {
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


          let rootIndex = this.rootUUIDs.findIndex( uuid => uuid == splitSetUUID);
          this.rootUUIDs.splice(rootIndex, 1);
          this.saveRootUUIDs();

          if (this.rootUUIDs.length <= 0) {
            // no more roots, we need at least one to have a default page with blank widget
            this.newRootSplit();
            rootIndex = 0;
          } else if (rootIndex > this.rootUUIDs.length - 1) {
            rootIndex = this.rootUUIDs.length - 1;
          }

          this.setActiveRootIndex(rootIndex);
          this.setRoot(rootIndex);

        } else {
          // we're not the root, keep the area and parent UUID for delete.
          const parentIndex = this.splitSets.findIndex(splitParent => splitParent.uuid == split.parentUUID);
          const parentUUID = this.splitSets[parentIndex].uuid;

          // delete split, stop observers and remove from split Observer from array
          this.splitSets.splice(splitIndex, 1);
          this.splitSetObs.find(splitObs => splitObs.uuid === splitSetUUID).observable.complete();
          this.splitSetObs.splice(this.splitSetObs.findIndex(splitObs => splitObs.uuid === splitSetUUID), 1);

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
    }
  }

  /**
   * Checks if the given UUID is a root UUID.
   *
   * @param {string} uuid - The UUID to check.
   * @returns {boolean} True if the UUID is a root UUID, false otherwise.
   */
  public isRootSplit(uuid: string): boolean {
    return this.rootUUIDs.includes(uuid);
  }

  private saveRootUUIDs(): void {
    this.settings.saveRootUUIDs(this.rootUUIDs);
  }

  public register(dropList: CdkDropList): void {
    this.dropLists.push(dropList);
  }

  public dragMoved(event: CdkDragMove<ISplitArea>): void {
    const elementFromPoint = this.document.elementFromPoint(
      event.pointerPosition.x,
      event.pointerPosition.y
    );

    if (!elementFromPoint) {
      this.currentHoverDropListId = null;
      console.log('no element from point. ID = null.');
      return;
    }

    if (elementFromPoint.classList.contains('no-drop')) {
      this.currentHoverDropListId = null;//'no-drop';
      console.log('no element from point is no-drop. ID = null.');
      return;
    }

    const dropList = elementFromPoint.classList.contains('cdk-drop-list')
      ? elementFromPoint
      : elementFromPoint.closest('.cdk-drop-list');

    if (!dropList) {
      this.currentHoverDropListId = null;
      console.log('Not DropList, or ancestors.');
      return;
    }
     if (dropList.id !== this.oldHoverDropListId) {
      this.oldHoverDropListId = dropList.id;
      console.log('New DropList: ' + dropList.id +'\nMoving over element:', elementFromPoint);
    }

    this.currentHoverDropListId = dropList.id;

  }

  public isDropAllowed(drag: CdkDrag, drop: CdkDropList): boolean {
    // if (this.currentHoverDropListId == null) {
    //   console.warn('isDropAllowed null. currentHoverDropListId: null.' + ' drop.id: ' + drop.id);
    //   return false;
    // }

    // console.warn('isDropAllowed - currentHoverDropListId: ' + this.currentHoverDropListId + ' drop.id: ' + drop.id);
    // // return drop.id === this.currentHoverDropListId;
    return true;
  }

  public dragReleased(event: CdkDragRelease): void {
    this.currentHoverDropListId = undefined;
  }

  public dropArea(splitSetUUID: string, event: CdkDragDrop<ISplitArea[]>): void {
    console.warn("area dropped\n" + "previous: " + event.previousContainer.id + "\nnew: " + event.container.id + "\n index :" + event.previousIndex + " to " + event.currentIndex + " in " + splitSetUUID);

    const split = this.splitSets.find(split => split.uuid === splitSetUUID)
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) {
        return;
      }
      moveItemInArray(split.splitAreas, event.previousIndex, event.currentIndex);
    } else {

      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
  }

  ngOnDestroy(): void {
    this._layoutEditSubscription?.unsubscribe();
  }

}
