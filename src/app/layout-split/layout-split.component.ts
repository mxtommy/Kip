import { Component, OnInit, Input } from '@angular/core';

import { ISplitSet, LayoutSplitsService } from '../layout-splits.service';

@Component({
  selector: 'layout-split',
  templateUrl: './layout-split.component.html',
  styleUrls: ['./layout-split.component.css']
})
export class LayoutSplitComponent implements OnInit {

  @Input('unlockStatus') unlockStatus: boolean;
  @Input('splitUUID') splitUUID: string;
  
  splitSet: ISplitSet;

  constructor(private LayoutSplitsService: LayoutSplitsService) { }

  ngOnInit() {
    this.splitSet = this.LayoutSplitsService.getSplit(this.splitUUID);
  }

  onDragEnd(sizesArray: Array<number>) {
    for (let i=0; i < sizesArray.length; i++) {
      this.splitSet.splitAreas[i].size = sizesArray[i];
    }
    this.saveSplit();
  }

  saveSplit() {
    this.LayoutSplitsService.saveSplit(this.splitUUID, this.splitSet.splitAreas);
  }

}
