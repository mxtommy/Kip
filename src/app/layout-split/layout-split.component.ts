import { Component, OnInit, Input } from '@angular/core';

import { ISplitSet, LayoutSplitsService } from '../layout-splits.service';
import { WidgetManagerService } from '../widget-manager.service';

@Component({
  selector: 'layout-split',
  templateUrl: './layout-split.component.html',
  styleUrls: ['./layout-split.component.css', './layout-split.component.scss']
})
export class LayoutSplitComponent implements OnInit {

  @Input('unlockStatus') unlockStatus: boolean;
  @Input('splitUUID') splitUUID: string;
  
  splitSet: ISplitSet;

  constructor(
    private LayoutSplitsService: LayoutSplitsService,
    private WidgetManagerService: WidgetManagerService) { }

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


  splitArea(areaUUID: string, direction: string) {
     
    let areaIndex = this.splitSet.splitAreas.findIndex(
                area => area.uuid == areaUUID
            );
    if (areaIndex < 0) { return; } // not found....   
     
    // get current size so we can split it in two
    let currentSize = this.splitSet.splitAreas[areaIndex].size;
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
    if (this.splitSet.direction == direction) {
     
      // same direction, add new area after specified area
                
      this.splitSet.splitAreas[areaIndex].size = area1Size;
      this.splitSet.splitAreas.splice(areaIndex+1, 0, newArea);
         
    } else {
      let newSplitUUID = this.LayoutSplitsService.newSplit(direction, areaUUID, newWidgetUUID);
      this.splitSet.splitAreas[areaIndex].uuid = newSplitUUID;
      this.splitSet.splitAreas[areaIndex].type = 'splitSet';
    }
    this.saveSplit();
  }
 
 
  deleteArea(areaUUID) {
 
    // if num of areas in split > 1, delete the area from the splitset.
        // delete widget too! :P
 
    // if num of areas in split = 1,
        // test if is rootsplit. if it is, just reset widget. (delete old first)
        // find Splitset that contains an area with uuid of this splitset.
        // delete widget
        // delete splitSet
        // delete area from parent splitset
         
    
  }


}
