import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input } from '@angular/core';
import {CdkDrag, CdkDragDrop, CdkDropList} from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { ISplitSet, LayoutSplitsService } from '../core/services/layout-splits.service';
import { MatMiniFabButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { DynamicWidgetContainerComponent } from '../dynamic-widget-container/dynamic-widget-container.component';
import { AngularSplitModule, IOutputData, ISplitDirection } from 'angular-split';


@Component({
    selector: 'layout-split',
    templateUrl: './layout-split.component.html',
    styleUrls: ['./layout-split.component.scss'],
    standalone: true,
    imports: [AngularSplitModule, CdkDrag, CdkDropList, DynamicWidgetContainerComponent, MatMenu, MatMenuItem, MatMiniFabButton, MatMenuTrigger]
})
export class LayoutSplitComponent implements OnInit, OnDestroy, OnChanges {

  @Input('unlockStatus') unlockStatus: boolean;
  @Input('splitUUID') splitUUID: string;

  splitSet: ISplitSet;
  splitSetSub: Subscription;

  constructor(
    private split: LayoutSplitsService) { }

  ngOnInit() {
    this.splitSetSub = this.split.getSplitObs(this.splitUUID).subscribe(
      splitSet => {
        this.splitSet = splitSet;
       }
    );

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
     this.split.updateSplitSizes(this.splitSet.uuid, sizesArray.sizes);
  }

  splitArea(areaUUID: string, direction: ISplitDirection) {
    this.split.splitArea(this.splitSet.uuid,areaUUID, direction);
  }


  deleteArea(areaUUID) {
    this.split.deleteArea(this.splitSet.uuid, areaUUID);
  }

  public drop(event: CdkDragDrop<ISplitSet[]>, uuid: string): void {
    this.split.dropArea(event, uuid);
  }

  ngOnDestroy() {
    this.splitSetSub.unsubscribe();
  }

}
