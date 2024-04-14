import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ISplitSet, LayoutSplitsService } from '../core/services/layout-splits.service';
import { MatMiniFabButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { DynamicWidgetContainerComponent } from '../dynamic-widget-container/dynamic-widget-container.component';
import { IOutputData, ISplitDirection } from 'angular-split'
import { NgFor, NgSwitch, NgSwitchCase, NgIf } from '@angular/common';
import { AngularSplitModule } from 'angular-split';

@Component({
    selector: 'layout-split',
    templateUrl: './layout-split.component.html',
    styleUrls: ['./layout-split.component.scss'],
    standalone: true,
    imports: [AngularSplitModule, NgFor, NgSwitch, NgSwitchCase, DynamicWidgetContainerComponent, NgIf, MatMenu, MatMenuItem, MatMiniFabButton, MatMenuTrigger]
})
export class LayoutSplitComponent implements OnInit, OnDestroy, OnChanges {

  @Input('unlockStatus') unlockStatus: boolean;
  @Input('splitUUID') splitUUID: string;

  splitSet: ISplitSet;
  splitSetSub: Subscription;

  constructor(
    private layoutSplitsService: LayoutSplitsService) { }

  ngOnInit() {
    this.splitSetSub = this.layoutSplitsService.getSplitObs(this.splitUUID).subscribe(
      splitSet => {
        this.splitSet = splitSet;
       }
    );

  }

  ngOnDestroy() {
    this.splitSetSub.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges) {

    if (changes.splitUUID) {
      if (! changes.splitUUID.firstChange) {
        this.ngOnDestroy();
        this.ngOnInit();

      }
    }
  }

  onDragEnd(sizesArray: IOutputData) {
     this.layoutSplitsService.updateSplitSizes(this.splitSet.uuid, sizesArray.sizes);
  }

  splitArea(areaUUID: string, direction: ISplitDirection) {
    this.layoutSplitsService.splitArea(this.splitSet.uuid,areaUUID, direction);
  }


  deleteArea(areaUUID) {
    this.layoutSplitsService.deleteArea(this.splitSet.uuid, areaUUID);
  }


}
