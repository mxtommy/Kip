import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';

interface ctrlUpdate {
  ctrlId: number,
  label: string
}

@Component({
  selector: 'boolean-control-config',
  templateUrl: './boolean-control-config.component.html',
  styleUrls: ['./boolean-control-config.component.css']
})
export class BooleanControlConfigComponent implements OnInit {
  @Input() ctrlFormGroup!: UntypedFormGroup;
  @Input() controlIndex: number;
  @Output() private ctrlLabelChange = new EventEmitter<ctrlUpdate>();
  @Output() private deleteCtrl = new EventEmitter<number>();

  constructor() { }

  ngOnInit(): void {
    // console.log()
  }

  public labelChange(inputValue: string): void {
    let update: ctrlUpdate = {
      ctrlId: this.controlIndex,
      label: inputValue
    }
    this.ctrlLabelChange.emit(update);
  }

  public deleteControl(): void {
    this.deleteCtrl.emit(this.controlIndex);
  }
}
