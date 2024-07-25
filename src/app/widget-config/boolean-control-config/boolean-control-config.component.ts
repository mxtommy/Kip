import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AppService } from './../../core/services/app-service';
import { UntypedFormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AsyncPipe } from '@angular/common';
import { ObjectKeysPipe } from './../../core/pipes/object-keys.pipe';
import { MatIconModule } from '@angular/material/icon';

export interface IDeleteEventObj {
  ctrlIndex: number,
  pathID: string
}

@Component({
    selector: 'boolean-control-config',
    templateUrl: './boolean-control-config.component.html',
    styleUrls: ['./boolean-control-config.component.scss'],
    standalone: true,
    imports: [FormsModule, ReactiveFormsModule, MatFormField, MatLabel, MatInput, MatSelect, MatOption, MatIconButton, MatCheckboxModule, AsyncPipe, ObjectKeysPipe, MatIconModule]
})
export class BooleanControlConfigComponent implements OnInit {
  @Input() ctrlFormGroup!: UntypedFormGroup;
  @Input() controlIndex: number;
  @Input() arrayLength: number;
  @Output() private deleteCtrl = new EventEmitter<IDeleteEventObj>();
  @Output() private moveUp = new EventEmitter<number>();
  @Output() private moveDown = new EventEmitter<number>();
  protected colors = [];

  constructor(private app: AppService) { }

  ngOnInit(): void {
    this.colors = this.app.configurableThemeColors;
  }

  public deleteControl() {
    const delEvent: IDeleteEventObj = {ctrlIndex: this.controlIndex, pathID: this.ctrlFormGroup.get('pathID').value};
    this.deleteCtrl.emit(delEvent);
  }

  public moveCtrlUp() {
    this.moveUp.emit(this.controlIndex);
  }

  public moveCtrlDown() {
    this.moveDown.emit(this.controlIndex);
  }
}
