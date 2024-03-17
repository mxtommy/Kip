import { MatCard, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
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
  @Input () trackAgainstAverage!: UntypedFormControl;
  @Input () datasetAverageArray!: UntypedFormControl;
  @Input () showDatasetMinimumValueLine!: UntypedFormControl;
  @Input () showDatasetMaximumValueLine!: UntypedFormControl;
  @Input () showDatasetAverageValueLine!: UntypedFormControl;
  @Input () showDatasetAngleAverageValueLine!: UntypedFormControl;
  @Input () startScaleAtZero!: UntypedFormControl;
  @Input () verticalGraph!: UntypedFormControl;
  @Input () showLabel!: UntypedFormControl;
  @Input () showYScale!: UntypedFormControl;
  @Input () showTimeScale!: UntypedFormControl;
  @Input () enableMinMaxScaleLimit!: UntypedFormControl;
  @Input () minValue!: UntypedFormControl;
  @Input () maxValue!: UntypedFormControl;
  @Input () numDecimal!: UntypedFormControl;
  @Input () textColor!: UntypedFormControl;


  constructor(
    private dsService: DatasetService,
  ) { }

  ngOnInit(): void {
    if (this.startScaleAtZero.value) {
      this.showDatasetMinimumValueLine.disable();
      this.showDatasetMaximumValueLine.disable();
    }

    if (!this.showAverageData.value) {
      this.trackAgainstAverage.disable();
    }
  }

  public disableMinMaxLines(e: MatCheckboxChange): void {
    if (e.checked) {
      this.showDatasetMinimumValueLine.setValue(!e.checked);
      this.showDatasetMaximumValueLine.setValue(!e.checked);
      this.showDatasetMinimumValueLine.disable();
      this.showDatasetMaximumValueLine.disable();
    } else {
      this.showDatasetMinimumValueLine.enable();
      this.showDatasetMaximumValueLine.enable();
    }
  }

  public enableTrackAgainstMovingAverage(e: MatCheckboxChange): void {
    if (e.checked) {
      this.trackAgainstAverage.enable();
    } else {
      this.trackAgainstAverage.setValue(e.checked);
      this.trackAgainstAverage.disable();
    }
  }
}
