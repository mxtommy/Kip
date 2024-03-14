import { MatCard, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatOption, MatOptionSelectionChange } from '@angular/material/core';
import { MatSelect, MatSelectChange } from '@angular/material/select';
import { Component, Input, OnInit } from '@angular/core';
import { DatasetService } from '../../core/services/data-set.service';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { ReactiveFormsModule, UntypedFormControl } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';


@Component({
  selector: 'config-chart-options',
  standalone: true,
  templateUrl: './chart-options.component.html',
  styleUrl: './chart-options.component.scss',
  imports: [MatCard, MatCardHeader, MatCardTitle, MatCardSubtitle, MatCardContent, MatFormField,MatCheckbox, MatSelect, MatOption, MatLabel, MatInput, ReactiveFormsModule]
})
export class ChartOptionsComponent implements OnInit {
  @Input () displayName!: UntypedFormControl;
  @Input () convertUnitTo!: UntypedFormControl;
  @Input () datasetUUID!: UntypedFormControl;
  @Input () showAverageData!: UntypedFormControl;
  @Input () datasetAverageArray!: UntypedFormControl;
  @Input () displayDatasetMinimumValueLine!: UntypedFormControl;
  @Input () displayDatasetMaximumValueLine!: UntypedFormControl;
  @Input () displayDatasetAverageValueLine!: UntypedFormControl;
  @Input () displayDatasetAngleAverageValueLine!: UntypedFormControl;
  @Input () startScaleAtZero!: UntypedFormControl;
  @Input () verticalGraph!: UntypedFormControl;
  @Input () showTimeScale!: UntypedFormControl;
  @Input () enableMinMaxScaleLimit!: UntypedFormControl;
  @Input () minValue!: UntypedFormControl;
  @Input () maxValue!: UntypedFormControl;
  @Input () textColor!: UntypedFormControl;


  constructor(
    private dsService: DatasetService,
  ) { }

  ngOnInit(): void {
    if (this.startScaleAtZero.value) {
      this.displayDatasetMinimumValueLine.disable();
      this.displayDatasetMaximumValueLine.disable();
    }
  }

  public disableMinMaxLines(e: MatCheckboxChange): void {
    if (e.checked) {
      this.displayDatasetMinimumValueLine.setValue(!e.checked);
      this.displayDatasetMaximumValueLine.setValue(!e.checked);
      this.displayDatasetMinimumValueLine.disable();
      this.displayDatasetMaximumValueLine.disable();
    } else {
      this.displayDatasetMinimumValueLine.enable();
      this.displayDatasetMaximumValueLine.enable();
    }
  }
}
