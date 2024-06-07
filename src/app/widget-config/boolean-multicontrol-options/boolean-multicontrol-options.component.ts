import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, Validators, FormsModule, ReactiveFormsModule, FormGroup, UntypedFormGroup, AbstractControl } from '@angular/forms';
import { debounceTime } from 'rxjs/internal/operators/debounceTime';

import { IDynamicControl, IWidgetPath } from '../../core/interfaces/widgets-interface';
import { UUID } from '../../core/utils/uuid';
import { MatMiniFabButton } from '@angular/material/button';
import { BooleanControlConfigComponent, IDeleteEventObj } from '../boolean-control-config/boolean-control-config.component';
import { NgFor } from '@angular/common';
import { Subscription } from 'rxjs';


@Component({
    selector: 'boolean-multicontrol-options',
    templateUrl: './boolean-multicontrol-options.component.html',
    styleUrls: ['./boolean-multicontrol-options.component.css'],
    standalone: true,
    imports: [
        FormsModule,
        ReactiveFormsModule,
        NgFor,
        BooleanControlConfigComponent,
        MatMiniFabButton,
    ],
})
export class BooleanMultiControlOptionsComponent implements OnInit, OnDestroy {
  @Input() multiCtrlArray!: UntypedFormArray;
  @Output() private addPath = new EventEmitter<IWidgetPath>();
  @Output() private updatePath = new EventEmitter<IDynamicControl[]>();
  @Output() private delPath = new EventEmitter<IDeleteEventObj>();

  public multiFormGroup: UntypedFormGroup = null;
  public arrayLength: number = null;
  private multiCtrlArraySubscription: Subscription = null;

  constructor(
    private fb: UntypedFormBuilder
  ) { }

  ngOnInit(): void {
    this.arrayLength = this.multiCtrlArray.length;
    this.multiFormGroup = new FormGroup({
      multiCtrlArray: this.multiCtrlArray
    });
    this.multiCtrlArraySubscription = this.multiCtrlArray.valueChanges.pipe(debounceTime(350)).subscribe((values: IDynamicControl[]) => {
      this.updatePath.emit(values);
    })
  }

  public addCtrlGroup() {
    const newUUID = UUID.create();

    // create new control
    this.multiCtrlArray.push(
      this.fb.group({
        ctrlLabel: [null, Validators.required],
        type: ['1', Validators.required],
        pathID:[newUUID],
        color:['text'],
        isNumeric: [false],
        value:[null]
      }
    ));
    // update array length for child components
    this.arrayLength = this.multiCtrlArray.length;

    // Create corresponding path group
    const newPathObj: IWidgetPath = {
      description: null,
      path: null,
      pathID: newUUID,
      source: 'default',
      pathType: 'boolean',
      isPathConfigurable: true,
      showPathSkUnitsFilter: false,
      pathSkUnitsFilter: 'unitless',
      convertUnitTo: 'unitless',
      sampleTime: 500
    }

    this.addPath.emit(newPathObj);
  }

  public moveUp(index: number) {
    const ctrlGrp = this.multiCtrlArray.at(index);
    this.multiCtrlArray.removeAt(index, {emitEvent: false});
    this.multiCtrlArray.insert(index - 1, ctrlGrp, {emitEvent: false});
  }

  public moveDown(index: number) {
    const ctrlGrp = this.multiCtrlArray.at(index);
    this.multiCtrlArray.removeAt(index, {emitEvent: false});
    this.multiCtrlArray.insert(index + 1, ctrlGrp, {emitEvent: false});
  }

  public deletePath(e: IDeleteEventObj): void {
    this.delPath.emit(e);
    this.arrayLength = this.multiCtrlArray.length;
  }

  getFormGroup(ctrl: AbstractControl): UntypedFormGroup {
    return <UntypedFormGroup>ctrl;
  }

  ngOnDestroy(): void {
    this.multiCtrlArraySubscription?.unsubscribe();
  }
}
