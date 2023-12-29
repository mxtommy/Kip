import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';

interface ctrlUpdate {
  ctrlId: number,
  label: string
}

@Component({
  selector: 'app-boolean-multicontrol-config',
  templateUrl: './boolean-multicontrol-config.component.html',
  styleUrls: ['./boolean-multicontrol-config.component.css'],
})
export class BooleanMultiControlConfigComponent implements OnInit {
  @Input() formGroup!: UntypedFormGroup;
  @Input() controlIndex: number;
  @Output() private ctrlLabelChange = new EventEmitter<ctrlUpdate>();
  @Output() private deleteCtrl = new EventEmitter<number>();

  constructor() { }

  ngOnInit(): void {
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
