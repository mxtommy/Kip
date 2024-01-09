import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs/internal/operators/debounceTime';

import { IDynamicControl, IWidgetPath } from '../../widgets-interface';
import { UUID } from '../../uuid';


@Component({
  selector: 'boolean-multicontrol-options',
  templateUrl: './boolean-multicontrol-options.component.html',
  styleUrls: ['./boolean-multicontrol-options.component.css'],
})
export class BooleanMultiControlOptionsComponent implements OnInit {
  @Input() multiCtrlArray!: UntypedFormArray;
  @Output() private addPath = new EventEmitter<IWidgetPath>();
  @Output() private updatePath = new EventEmitter<IDynamicControl>();
  @Output() private delPath = new EventEmitter<string>();

  constructor(
    private fb: UntypedFormBuilder
  ) { }

  ngOnInit(): void {
    this.multiCtrlArray.valueChanges.pipe(debounceTime(350)).subscribe(values => {
      this.updatePath.emit(values);
    })
  }

  public addCtrlGroup() {
    const newUUID = UUID.create();

    // create new control
    this.multiCtrlArray.push(
      this.fb.group({
        ctrlLabel: [null, Validators.required],
        pathID:[newUUID],
        color:['text'],
        value:[null]
      }
    ));

    // Create corresponding path group
    const newPathObj: IWidgetPath = {
      description: null,
      path: null,
      pathID: newUUID,
      source: 'default',
      pathType: 'boolean',
      isPathConfigurable: true,
      convertUnitTo: 'unitless',
      sampleTime: 500
    }

    this.addPath.emit(newPathObj);
  }

  public deletePath(e): void {
    this.delPath.emit(e)
  }
}
