import { Component, OnDestroy, OnInit, input, output, inject } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, Validators, FormsModule, ReactiveFormsModule, FormGroup, UntypedFormGroup, AbstractControl } from '@angular/forms';
import { debounceTime } from 'rxjs/internal/operators/debounceTime';

import { IDynamicControl, IWidgetPath } from '../../core/interfaces/widgets-interface';
import { UUID } from '../../core/utils/uuid.util';
import { MatButtonModule } from '@angular/material/button';
import { BooleanControlConfigComponent, IDeleteEventObj } from '../boolean-control-config/boolean-control-config.component';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

export interface IAddNewPathObject {
  path: IWidgetPath;
  ctrlType: number;
}

@Component({
    selector: 'boolean-multicontrol-options',
    templateUrl: './boolean-multicontrol-options.component.html',
    styleUrls: ['./boolean-multicontrol-options.component.css'],
    imports: [
        FormsModule,
        ReactiveFormsModule,
        BooleanControlConfigComponent,
        MatButtonModule,
        MatIconModule
    ],
})
export class BooleanMultiControlOptionsComponent implements OnInit, OnDestroy {
  private fb = inject(UntypedFormBuilder);
  readonly multiCtrlArray = input.required<UntypedFormArray>();
  public readonly addPath = output<IAddNewPathObject>();
  public readonly updatePath = output<IDynamicControl[]>();
  public readonly delPath = output<IDeleteEventObj>();
  public multiFormGroup: UntypedFormGroup = null;
  public arrayLength = 0;
  private multiCtrlArraySubscription: Subscription = null;

  ngOnInit(): void {
    this.arrayLength = this.multiCtrlArray().length;
    this.multiFormGroup = new FormGroup({
      multiCtrlArray: this.multiCtrlArray()
    });
    this.multiCtrlArraySubscription = this.multiCtrlArray().valueChanges.pipe(debounceTime(350)).subscribe((values: IDynamicControl[]) => {
      this.updatePath.emit(values);
    })
  }

  public addCtrlGroup() {
    const newUUID = UUID.create();

    // create new control
    this.multiCtrlArray().push(
      this.fb.group({
        ctrlLabel: [null, Validators.required],
        type: ['1', Validators.required],
        pathID:[newUUID],
        color:['contrast'],
        isNumeric: [false],
        value:[null]
      }
    ));
    // update array length for child components
    this.arrayLength = this.multiCtrlArray().length;

    // Create corresponding path group
    const newPath: IAddNewPathObject = {
      path: {
        description: null,
        path: null,
        pathID: newUUID,
        source: 'default',
        pathType: 'boolean',
        supportsPut: true,
        isPathConfigurable: true,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: null,
        convertUnitTo: null,
        sampleTime: 500
      },
      ctrlType: 1
    };

    this.addPath.emit(newPath);
  }

  public moveUp(index: number) {
    const ctrlGrp = this.multiCtrlArray().at(index);
    this.multiCtrlArray().removeAt(index, {emitEvent: false});
    this.multiCtrlArray().insert(index - 1, ctrlGrp, {emitEvent: false});
  }

  public moveDown(index: number) {
    const ctrlGrp = this.multiCtrlArray().at(index);
    this.multiCtrlArray().removeAt(index, {emitEvent: false});
    this.multiCtrlArray().insert(index + 1, ctrlGrp, {emitEvent: false});
  }

  public deletePath(e: IDeleteEventObj): void {
    this.delPath.emit(e);
    this.arrayLength = this.multiCtrlArray().length;
  }

  getFormGroup(ctrl: AbstractControl): UntypedFormGroup {
    return ctrl as UntypedFormGroup;
  }

  ngOnDestroy(): void {
    this.multiCtrlArraySubscription?.unsubscribe();
  }
}
