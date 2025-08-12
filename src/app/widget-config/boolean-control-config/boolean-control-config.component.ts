import { Component, OnInit, input, output, inject } from '@angular/core';
import { AppService } from './../../core/services/app-service';
import { UntypedFormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';

export interface IDeleteEventObj {
  ctrlIndex: number,
  pathID: string
}

@Component({
    selector: 'boolean-control-config',
    templateUrl: './boolean-control-config.component.html',
    styleUrls: ['./boolean-control-config.component.scss'],
    imports: [FormsModule, ReactiveFormsModule, MatFormField, MatLabel, MatInput, MatSelect, MatOption, MatIconButton, MatCheckboxModule, MatIconModule]
})
export class BooleanControlConfigComponent implements OnInit {
  private app = inject(AppService);
  readonly ctrlFormGroup = input.required<UntypedFormGroup>();
  readonly controlIndex = input<number>(undefined);
  readonly arrayLength = input<number>(undefined);
  public readonly deleteCtrl = output<IDeleteEventObj>();
  public readonly moveUp = output<number>();
  public readonly moveDown = output<number>();
  protected colors = [];

  ngOnInit(): void {
    this.colors = this.app.configurableThemeColors;
  }

  public deleteControl() {
    const delEvent: IDeleteEventObj = {ctrlIndex: this.controlIndex(), pathID: this.ctrlFormGroup().get('pathID').value};
    this.deleteCtrl.emit(delEvent);
  }

  public moveCtrlUp() {
    this.moveUp.emit(this.controlIndex());
  }

  public moveCtrlDown() {
    this.moveDown.emit(this.controlIndex());
  }
}
