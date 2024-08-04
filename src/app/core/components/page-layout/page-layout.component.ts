import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input, ViewChild } from '@angular/core';
import {CdkDrag, CdkDragDrop, CdkDragMove, CdkDragPlaceholder, CdkDragRelease, CdkDropList} from '@angular/cdk/drag-drop';
import { Observable } from 'rxjs';
import { ISplitArea, ISplitSet, LayoutSplitsService } from '../../services/layout-splits.service';
import { MatMiniFabButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { DynamicWidgetContainerComponent } from '../dynamic-widget-container/dynamic-widget-container.component';
import { AngularSplitModule, IOutputData, ISplitDirection } from 'angular-split';
import { AsyncPipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';


@Component({
    selector: 'page-layout',
    templateUrl: './page-layout.component.html',
    styleUrls: ['./page-layout.component.scss'],
    standalone: true,
    imports: [ AngularSplitModule, CdkDrag, CdkDropList, AsyncPipe, DynamicWidgetContainerComponent, MatMenu, MatMenuItem, MatMiniFabButton, MatMenuTrigger, MatIcon]
})
export class PageLayoutComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild(CdkDropList) dropList?: CdkDropList;
  @Input('unlockStatus') unlockStatus: boolean;
  @Input('splitUUID') splitUUID: string;
  @Input('dashboard') dashboard: number;

  splitSet$: Observable<ISplitSet>;

  allowDropPredicate = (drag: CdkDrag, drop: CdkDropList) => {
  };

  constructor(
    private splits: LayoutSplitsService) { }

  ngOnInit() {
    this.splitSet$ = this.splits.getSplitObs(this.splitUUID);
  }

  ngAfterViewInit(): void {
  }

  ngOnChanges(changes: SimpleChanges) {

    if (changes.splitUUID) {
      if (! changes.splitUUID.firstChange) {
        this.ngOnDestroy();
        this.ngOnInit();

      }
    }
  }

  public onDragEnd(uuid: string, sizesArray: IOutputData) {
     this.splits.updateSplitSizes(uuid, sizesArray.sizes);
  }

  public addWidget(uuid: string, areaUUID: string, direction: ISplitDirection) {
    this.splits.addArea(uuid, areaUUID, direction);
  }

  public deleteArea(uuid: string, areaUUID: string) {
    this.splits.deleteArea(uuid, areaUUID);
  }

  public get connectedCdkDropLists() {
    return this.splits.dropLists;
  }

  ngOnDestroy() {
  }

}
