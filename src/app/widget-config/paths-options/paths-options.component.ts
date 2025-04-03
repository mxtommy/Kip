import { Component, OnChanges, OnInit, SimpleChanges, input, inject } from '@angular/core';
import { FormGroupDirective, UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import type { IWidgetPath } from '../../core/interfaces/widgets-interface';
import { ObjectKeysPipe } from '../../core/pipes/object-keys.pipe';
import { ModalPathControlConfigComponent } from '../path-control-config/path-control-config.component';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatCheckbox } from '@angular/material/checkbox';

export interface IAddNewPath {
  groupName: string,
  pathObj: IWidgetPath
}


@Component({
    selector: 'paths-options',
    templateUrl: './paths-options.component.html',
    styleUrls: ['./paths-options.component.css'],
    standalone: true,
    imports: [MatCheckbox, FormsModule, ReactiveFormsModule, MatFormField, MatLabel, MatInput, MatSuffix, ModalPathControlConfigComponent, ObjectKeysPipe]
})
export class PathsOptionsComponent implements OnInit, OnChanges {
  private rootFormGroup = inject(FormGroupDirective);
  private fb = inject(UntypedFormBuilder);

  readonly formGroupName = input.required<string>();
  readonly isArray = input.required<boolean>();
  readonly enableTimeout = input.required<UntypedFormControl>();
  readonly dataTimeout = input.required<UntypedFormControl>();
  readonly filterSelfPaths = input.required<UntypedFormControl>();
  readonly addPathEvent = input<IWidgetPath>(undefined);

  public pathsFormGroup!: any;

  ngOnInit(): void {
    if (this.isArray()) {
      this.pathsFormGroup = this.rootFormGroup.control.get(this.formGroupName()) as UntypedFormArray;
    } else {
      this.pathsFormGroup = this.rootFormGroup.control.get(this.formGroupName()) as UntypedFormGroup;
    }
  }

  public addPath(newPath: IWidgetPath): void {
    this.pathsFormGroup.push(
      this.fb.group({
        description: [newPath.description],
        path: [newPath.path, Validators.required],
        pathID: [newPath.pathID],
        source: [newPath.source, Validators.required],
        pathType: [newPath.pathType],
        isPathConfigurable: [newPath.isPathConfigurable],
        showPathSkUnitsFilter: [newPath.showPathSkUnitsFilter],
        pathSkUnitsFilter: [newPath.pathSkUnitsFilter],
        convertUnitTo: [newPath.convertUnitTo],
        sampleTime: [newPath.sampleTime]
      })
    );
    this.pathsFormGroup.updateValueAndValidity();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.addPathEvent && !changes.addPathEvent.firstChange) {
      this.addPath(changes.addPathEvent.currentValue);
    }
  }

}
