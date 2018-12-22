import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { UnitsService, IUnitInfo } from '../units.service';
import { Subscription } from 'rxjs';


@Component({
  selector: 'modal-unit-selector',
  templateUrl: './modal-unit-selector.component.html',
  styleUrls: ['./modal-unit-selector.component.css']
})
export class ModalUnitSelectorComponent implements OnInit {

  @Input() path: string;
  @Input() formGroup: FormGroup;
  @Input() controlName: string;

  constructor(private UnitsService: UnitsService) { }

  unitList: IUnitInfo[] = [];
  default: string;
  pathSub: Subscription;

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChanges) {

    //path
    if (changes.path) {
       this.updateUnits();
    }
  }

  updateUnits() {
    let unitInfo = this.UnitsService.getConversionsForPath(this.path);
    this.unitList = unitInfo.conversions;  // array of { "group": "angle", "unit": "deg" }
    //check if our current setting exists in unitList. If not, set default
    if (!this.unitList.some(group => group.units.includes(this.formGroup.controls[this.controlName].value))) {
      this.formGroup.controls[this.controlName].setValue(unitInfo.default);
    }

  }

}
