import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ISplitSet, LayoutSplitsService } from '../layout-splits.service';

@Component({
  selector: 'layout-split',
  templateUrl: './layout-split.component.html',
  styleUrls: ['./layout-split.component.scss']
})
export class LayoutSplitComponent implements OnInit, OnDestroy, OnChanges {

  @Input('unlockStatus') unlockStatus: boolean;
  @Input('splitUUID') splitUUID: string;

  splitSet: ISplitSet;
  splitSetSub: Subscription;

  constructor(
    private LayoutSplitsService: LayoutSplitsService) { }

  ngOnInit() {
    this.splitSetSub = this.LayoutSplitsService.getSplitObs(this.splitUUID).subscribe(
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

  onDragEnd(sizesArray: {gutterNum: number, sizes: Array<number>}) {
     this.LayoutSplitsService.updateSplitSizes(this.splitSet.uuid, sizesArray.sizes);
  }

  splitArea(areaUUID: string, direction: string) {
    this.LayoutSplitsService.splitArea(this.splitSet.uuid,areaUUID, direction);
  }


  deleteArea(areaUUID) {
    this.LayoutSplitsService.deleteArea(this.splitSet.uuid, areaUUID);
  }


}
