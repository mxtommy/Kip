import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';

export interface IDeleteEventObj {
  ctrlIndex: number,
  pathID: string
}

@Component({
  selector: 'boolean-control-config',
  templateUrl: './boolean-control-config.component.html',
  styleUrls: ['./boolean-control-config.component.css']
})
export class BooleanControlConfigComponent implements OnInit {
  @Input() ctrlFormGroup!: UntypedFormGroup;
  @Input() controlIndex: number;
  @Input() arrayLength: number;
  @Output() private deleteCtrl = new EventEmitter<IDeleteEventObj>();
  @Output() private moveUp = new EventEmitter<number>();
  @Output() private moveDown = new EventEmitter<number>();

  constructor() { }

  ngOnInit(): void {
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
