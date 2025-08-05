import { Component, OnInit, input, inject } from '@angular/core';
import { AppService } from '../../core/services/app-service';
import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
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
  private app = inject(AppService);

  readonly displayName = input.required<UntypedFormControl>();
  readonly showLabel = input.required<UntypedFormControl>();
  readonly convertUnitTo = input.required<UntypedFormControl>();
  readonly datasetUUID = input.required<UntypedFormControl>();
  readonly datasetAverageArray = input.required<UntypedFormControl>();
  readonly showAverageData = input.required<UntypedFormControl>();
  readonly trackAgainstAverage = input.required<UntypedFormControl>();
  readonly showDatasetMinimumValueLine = input.required<UntypedFormControl>();
  readonly showDatasetMaximumValueLine = input.required<UntypedFormControl>();
  readonly showDatasetAverageValueLine = input.required<UntypedFormControl>();
  readonly showDatasetAngleAverageValueLine = input.required<UntypedFormControl>();
  readonly verticalChart = input.required<UntypedFormControl>();
  readonly inverseYAxis = input.required<UntypedFormControl>();
  readonly showTimeScale = input.required<UntypedFormControl>();

  readonly showYScale = input.required<UntypedFormControl>();
  readonly startScaleAtZero = input.required<UntypedFormControl>();
  readonly yScaleSuggestedMin = input.required<UntypedFormControl>();
  readonly yScaleSuggestedMax = input.required<UntypedFormControl>();

  readonly enableMinMaxScaleLimit = input.required<UntypedFormControl>();
  readonly yScaleMin = input.required<UntypedFormControl>();
  readonly yScaleMax = input.required<UntypedFormControl>();

  readonly numDecimal = input.required<UntypedFormControl>();
  readonly color = input.required<UntypedFormControl>();
  protected colors = [];

  ngOnInit(): void {
    this.colors = this.app.configurableThemeColors;
    if (this.showAverageData() && !this.showAverageData()?.value) {
      this.trackAgainstAverage().disable();
    }

    if (this.enableMinMaxScaleLimit()) {
      this.setValueScaleOptionsControls(this.enableMinMaxScaleLimit().value);
    }
  }

  private setValueScaleOptionsControls(enableMinMaxScaleLimit: boolean) {
    if (enableMinMaxScaleLimit) {
      this.yScaleMin()?.enable();
      this.yScaleMax()?.enable();
      this.yScaleSuggestedMin()?.disable();
      this.yScaleSuggestedMax()?.disable();
    } else {
      this.yScaleMin()?.disable();
      this.yScaleMax()?.disable();
      this.yScaleSuggestedMin()?.enable();
      this.yScaleSuggestedMax()?.enable();
    }
  }

  public setScaleControls(e: MatRadioChange) {
    this.setValueScaleOptionsControls(e.value);
  }

  public enableTrackAgainstMovingAverage(e: MatCheckboxChange): void {
    if (e.checked) {
      this.trackAgainstAverage().enable();
    } else {
      this.trackAgainstAverage().setValue(e.checked);
      this.trackAgainstAverage().disable();
    }
  }
}
