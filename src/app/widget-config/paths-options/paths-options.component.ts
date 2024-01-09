import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormGroupDirective, UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { IWidgetPath } from '../../widgets-interface';

export interface IAddNewPath {
  groupName: string,
  pathObj: IWidgetPath
}


@Component({
  selector: 'paths-options',
  templateUrl: './paths-options.component.html',
  styleUrls: ['./paths-options.component.css']
})
export class PathsOptionsComponent implements OnInit, OnChanges {
  @Input() formGroupName!: string;
  @Input() isArray!: boolean;
  @Input() enableTimeout!: UntypedFormControl;
  @Input() dataTimeout!: UntypedFormControl;
  @Input() filterSelfPaths!: UntypedFormControl;
  @Input() addPathEvent: IWidgetPath;

  public pathsFormGroup!: any;

  constructor(
    private rootFormGroup: FormGroupDirective,
    private fb: UntypedFormBuilder
  ) { }

  ngOnInit(): void {
    if (this.isArray) {
      this.pathsFormGroup = this.rootFormGroup.control.get(this.formGroupName) as UntypedFormArray;
    } else {
      this.pathsFormGroup = this.rootFormGroup.control.get(this.formGroupName) as UntypedFormGroup;
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
