import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, Validators } from '@angular/forms';

import { UUID } from '../../uuid';

interface ctrlUpdate {
  pathUUID: string,
  // label: string
}

@Component({
  selector: 'boolean-multicontrol-options',
  templateUrl: './boolean-multicontrol-options.component.html',
  styleUrls: ['./boolean-multicontrol-options.component.css'],
})
export class BooleanMultiControlOptionsComponent implements OnInit {
  @Input() multiCtrlArray!: UntypedFormArray;
  @Output() private addPath = new EventEmitter<ctrlUpdate>();
  // @Output() private deleteCtrl = new EventEmitter<number>();

  constructor(
    private fb : UntypedFormBuilder
  ) { }

  ngOnInit(): void {
  }

  public addCtrlGroup() {
    const newUUID = UUID.create();
    this.multiCtrlArray.push(
      this.fb.group({
        ctrlLabel: [null, Validators.required],
        pathKeyName:[newUUID],
        color:['text'],
        value:[null]
      }
    ));

    this.addPath.emit({pathUUID: newUUID});
  }

  // public ctrlLabelChange(e: any): void {
  //   this.widgetConfig.multiChildCtrls[e.ctrlId].ctrlLabel = e.label;
  //   Object.assign(this.widgetConfig.paths[this.widgetConfig.multiChildCtrls[e.ctrlId].pathKeyName], {description: e.label});
  //   this.formMaster = this.generateFormGroups(this.widgetConfig);
  // }

  // public deleteControl(e: number) {
  //   delete this.widgetConfig.paths[this.widgetConfig.multiChildCtrls[e].pathKeyName];
  //   this.widgetConfig.multiChildCtrls.splice(e,1);
  //   this.formMaster = this.generateFormGroups(this.widgetConfig);
  // }
}
