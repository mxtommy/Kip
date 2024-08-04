import { Inject, Injectable, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDragMove, CdkDragRelease, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

import { AppSettingsService } from './app-settings.service';
import { WidgetManagerService } from './widget-manager.service';
import { IAreaSize, IOutputAreaSizes, ISplitDirection } from 'angular-split';
import { UUID } from '../utils/uuid'
import { DashboardService } from './dashboard.service';

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
  activeRoot: BehaviorSubject<string> = new BehaviorSubject<string>(null);

  dropLists: CdkDropList[] = [];
  currentHoverDropListId: string = null;
  oldHoverDropListId: string = null;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private settings: AppSettingsService,
    private WidgetManagerService: WidgetManagerService,
    private _dashboards: DashboardService) {

    this._layoutEditSubscription = this._isEditLayout$.subscribe(isEditing => {
      if (!isEditing && this._lastIsEditLayout !== isEditing) {
        this._lastIsEditLayout = isEditing;
        this.settings.saveSplitSets(this.splitSets);
      } else {
        this._lastIsEditLayout = isEditing;
      }
    });
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
    this._dashboards.navigateToActive();
  }

  private setRoot(index: number): void {
    this._dashboards.navigateTo(index);
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

  public addArea(splitSetUUID: string, areaUUID: string, direction: ISplitDirection): void {
  }

  // should only ever be called when changing directions. widgetUUID of area we're splitting
  // becomes first area of new split
  private addSplit(parentUUID: string, direction: ISplitDirection, currentWidgetUUID: string, newWidgetUUID: string): string {
    return '';
  }

  public updateSplitSizes(splitSetUUID: string, sizesArray: IOutputAreaSizes): void {
  }

  public deleteArea(splitSetUUID: string, areaUUID: string): void {
  }

  private updateSplit(split: ISplitSet): void {
    const splitSub = this.splitSetObs.find(sSet => sSet.uuid == split.uuid);
    if (splitSub) {
      splitSub.observable.next(split);
    }
  }

  ngOnDestroy(): void {
    this._layoutEditSubscription?.unsubscribe();
  }

}
