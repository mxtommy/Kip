import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { Component, Input, OnInit } from '@angular/core';
import { DatasetService } from '../../core/services/data-set.service';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { ReactiveFormsModule, UntypedFormControl } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';


@Component({
  selector: 'config-display-chart-options',
  standalone: true,
  templateUrl: './display-chart-options.component.html',
  styleUrl: './display-chart-options.component.scss',
  imports: [MatCardModule, MatFormFieldModule, MatCheckboxModule, MatSelectModule, MatOptionModule, MatLabel, MatInputModule, MatRadioModule, ReactiveFormsModule]
})
export class DisplayChartOptionsComponent implements OnInit {
  @Input () displayName!: UntypedFormControl;
  @Input () showLabel!: UntypedFormControl;
  @Input () convertUnitTo!: UntypedFormControl;
  @Input () datasetUUID!: UntypedFormControl;
  @Input () datasetAverageArray!: UntypedFormControl;
  @Input () showAverageData!: UntypedFormControl;
  @Input () trackAgainstAverage!: UntypedFormControl;
  @Input () showDatasetMinimumValueLine!: UntypedFormControl;
  @Input () showDatasetMaximumValueLine!: UntypedFormControl;
  @Input () showDatasetAverageValueLine!: UntypedFormControl;
  @Input () showDatasetAngleAverageValueLine!: UntypedFormControl;
  @Input () verticalGraph!: UntypedFormControl;
  @Input () showTimeScale!: UntypedFormControl;

  @Input () showYScale!: UntypedFormControl;
  @Input () startScaleAtZero!: UntypedFormControl;
  @Input () yScaleSuggestedMin!: UntypedFormControl;
  @Input () yScaleSuggestedMax!: UntypedFormControl;

  @Input () enableMinMaxScaleLimit!: UntypedFormControl;
  @Input () yScaleMin!: UntypedFormControl;
  @Input () yScaleMax!: UntypedFormControl;

  @Input () numDecimal!: UntypedFormControl;
  @Input () textColor!: UntypedFormControl;


  constructor(
    private dsService: DatasetService,
  ) { }

  ngOnInit(): void {
    if (!this.showAverageData.value) {
      this.trackAgainstAverage.disable();
    }

    this.setValueScaleOptionsControls(this.enableMinMaxScaleLimit.value);
  }

  private setValueScaleOptionsControls(enableMinMaxScaleLimit: boolean) {
    if (enableMinMaxScaleLimit) {
      this.yScaleMin.enable();
      this.yScaleMax.enable();
      this.yScaleSuggestedMin.disable();
      this.yScaleSuggestedMax.disable();
    } else {
      this.yScaleMin.disable();
      this.yScaleMax.disable();
      this.yScaleSuggestedMin.enable();
      this.yScaleSuggestedMax.enable();
    }
  }

  public setScaleControls(e: MatRadioChange) {
    this.setValueScaleOptionsControls(e.value);
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
