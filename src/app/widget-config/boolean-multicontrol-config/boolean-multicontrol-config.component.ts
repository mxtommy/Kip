import { Component, Input, OnInit} from '@angular/core';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { IChildControl } from '../../widgets-interface';

interface ctrlGroup {
  [key: string]: any,
  index: number,
  formGroup: UntypedFormGroup
}

@Component({
  selector: 'app-boolean-multicontrol-config',
  templateUrl: './boolean-multicontrol-config.component.html',
  styleUrls: ['./boolean-multicontrol-config.component.css']
})
export class BooleanMultiControlConfigComponent implements OnInit {
  @Input() formMultiCtrlGroup!: ctrlGroup;
  @Input() formMultiCtrlConfig!: Object[];

  constructor() { }

  ngOnInit(): void {
    console.error('config widget')
  }

  public onAddControlGroup(): void {


    let cfg: IChildControl = {
      label: '',
      pathKeyName: '',
      color: 'text',
      value: null
    }
    let idxCfg = this.formMultiCtrlConfig.push(cfg)

    let group: UntypedFormGroup = new UntypedFormGroup({
      label: new UntypedFormControl(),
      pathKeyName: new UntypedFormControl(),
      color: new UntypedFormControl('text'),
      value: new UntypedFormControl(),
    });


    const i = Object.keys(this.formMultiCtrlGroup).length;
    const fg: Record<string, any> = {}
    fg[i] = group;

    Object.assign(this.formMultiCtrlGroup, fg);
  }
}
