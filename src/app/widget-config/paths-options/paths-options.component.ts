import { Component, OnChanges, OnInit, SimpleChanges, input, inject } from '@angular/core';
import { FormGroupDirective, UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import type { IDynamicControl, IWidgetPath } from '../../core/interfaces/widgets-interface';
import { ObjectKeysPipe } from '../../core/pipes/object-keys.pipe';
import { PathControlConfigComponent } from '../path-control-config/path-control-config.component';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatCheckbox } from '@angular/material/checkbox';
import { IAddNewPathObject } from '../boolean-multicontrol-options/boolean-multicontrol-options.component';

export interface IAddNewPath {
  groupName: string,
  pathObj: IWidgetPath
}


@Component({
    selector: 'paths-options',
    templateUrl: './paths-options.component.html',
    styleUrls: ['./paths-options.component.scss'],
    imports: [MatCheckbox, FormsModule, ReactiveFormsModule, MatFormField, MatLabel, MatInput, MatSuffix, PathControlConfigComponent, ObjectKeysPipe]
})
export class PathsOptionsComponent implements OnInit, OnChanges {
  private rootFormGroup = inject(FormGroupDirective);
  private fb = inject(UntypedFormBuilder);

  readonly formGroupName = input.required<string>();
  readonly isArray = input.required<boolean>();
  readonly enableTimeout = input.required<UntypedFormControl>();
  readonly dataTimeout = input.required<UntypedFormControl>();
  readonly filterSelfPaths = input.required<UntypedFormControl>();
  readonly addPathEvent = input<IAddNewPathObject>(undefined);
  readonly delPathEvent = input<string>(undefined);
  readonly updatePathEvent = input<IDynamicControl[]>(undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected pathsFormGroup!: any;
  protected multiCTRLArray: IDynamicControl[] = [];

  ngOnInit(): void {
    if (this.isArray()) {
      this.pathsFormGroup = this.rootFormGroup.control.get(this.formGroupName()) as UntypedFormArray;
      this.multiCTRLArray = this.rootFormGroup.control.get('multiChildCtrls').value;
    } else {
      this.pathsFormGroup = this.rootFormGroup.control.get(this.formGroupName()) as UntypedFormGroup;
    }
  }

  public addPath(newPath: IAddNewPathObject): void {
    this.pathsFormGroup.push(
      this.fb.group({
        description: [newPath.path.description],
        path: [newPath.path.path, Validators.required],
        pathID: [newPath.path.pathID],
        source: [newPath.path.source, Validators.required],
        pathType: [newPath.path.pathType],
        isPathConfigurable: [newPath.path.isPathConfigurable],
        showPathSkUnitsFilter: [newPath.path.showPathSkUnitsFilter],
        pathSkUnitsFilter: [newPath.path.pathSkUnitsFilter],
        convertUnitTo: [newPath.path.convertUnitTo],
        sampleTime: [newPath.path.sampleTime],
        supportsPut: [newPath.path.supportsPut],
      })
    );
    this.pathsFormGroup.updateValueAndValidity();
    this.multiCTRLArray = this.rootFormGroup.control.get('multiChildCtrls').value;
  }

  private delPath(): void {
    this.multiCTRLArray = this.rootFormGroup.control.get('multiChildCtrls').value;
  }

  private updatePath(ctrls: IDynamicControl[]): void {
    this.multiCTRLArray = ctrls;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.addPathEvent && !changes.addPathEvent.firstChange) {
      this.addPath(changes.addPathEvent.currentValue);
    }

    if (changes.delPathEvent && !changes.delPathEvent.firstChange) {
      this.delPath();
    }

    if (changes.updatePathEvent && !changes.updatePathEvent.firstChange) {
      this.updatePath(changes.updatePathEvent.currentValue);
    }
  }

}
