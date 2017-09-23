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
    console.log(sizesArray);
    console.log(this.splitSet);
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
    
    let newArea = {
        uuid: 'widgetno-1xxx-4xxx-yxa9-xxxxxxxxxxxx',
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
     /*
        // new direction, convert current splitArea to a SplitSet with 2 areas,
        // 1 containing existing area, 1 new one.
        let newSplitSet = newUUID();
        let newSplitSet: ISplitSet =  {
            uuid: newUUID,
            direction: direction,
            splitAreas: [{
                    uuid: splitAreaUUID,
                    type: 'widget',
                    size: area1Size
                }]
            }
        newSplitSet.splitAreas.push(newArea);
        this.splitSets.push(newSplitSet);
         
        // convert existing area to splitset.
        this.splitSets[splitSetIndex].splitAreas[areaIndex].uuid = newUUID;
        this.splitSets[splitSetIndex].splitAreas[areaIndex].type = 'splitSet'
     */
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
