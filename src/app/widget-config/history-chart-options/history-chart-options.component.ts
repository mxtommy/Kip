import { Component, OnInit, input, inject } from '@angular/core';
import { AppService } from '../../core/services/app-service';
import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { ReactiveFormsModule, UntypedFormControl } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'config-history-chart-options',
  standalone: true,
  templateUrl: './history-chart-options.component.html',
  styleUrl: './history-chart-options.component.scss',
  imports: [
    MatCardModule, 
    MatFormFieldModule, 
    MatCheckboxModule, 
    MatSelectModule, 
    MatOptionModule, 
    MatLabel, 
    MatInputModule, 
    MatRadioModule, 
    MatButtonToggleModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ReactiveFormsModule,
    AsyncPipe
  ]
})
export class HistoryChartOptionsComponent implements OnInit {
  private app = inject(AppService);
  private http = inject(HttpClient);

  readonly displayName = input.required<UntypedFormControl>();
  readonly historyApiUrl = input.required<UntypedFormControl>();
  readonly historyPaths = input.required<UntypedFormControl>();
  readonly aggregationMethods = input.required<UntypedFormControl>();
  readonly timeMode = input.required<UntypedFormControl>();
  readonly startTime = input.required<UntypedFormControl>();
  readonly endTime = input.required<UntypedFormControl>();
  readonly duration = input.required<UntypedFormControl>();
  readonly durationUnit = input.required<UntypedFormControl>();
  readonly refreshEnabled = input.required<UntypedFormControl>();
  readonly refreshInterval = input.required<UntypedFormControl>();
  readonly resolution = input.required<UntypedFormControl>();
  readonly useUTC = input.required<UntypedFormControl>();
  readonly showTimeScale = input.required<UntypedFormControl>();
  readonly showYScale = input.required<UntypedFormControl>();
  readonly startScaleAtZero = input.required<UntypedFormControl>();
  readonly yScaleSuggestedMin = input.required<UntypedFormControl>();
  readonly yScaleSuggestedMax = input.required<UntypedFormControl>();
  readonly enableMinMaxScaleLimit = input.required<UntypedFormControl>();
  readonly yScaleMin = input.required<UntypedFormControl>();
  readonly yScaleMax = input.required<UntypedFormControl>();
  readonly inverseYAxis = input.required<UntypedFormControl>();
  readonly verticalChart = input.required<UntypedFormControl>();
  readonly numDecimal = input.required<UntypedFormControl>();
  readonly color = input.required<UntypedFormControl>();

  protected colors = [];
  availablePaths$: Observable<string[]>;
  
  aggregationOptions = [
    { value: 'average', label: 'Average' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
    { value: 'first', label: 'First' },
    { value: 'last', label: 'Last' },
    { value: 'mid', label: 'Median' },
    { value: 'middle_index', label: 'Middle Index' }
  ];

  durationUnits = [
    { value: 's', label: 'Seconds' },
    { value: 'm', label: 'Minutes' },
    { value: 'h', label: 'Hours' },
    { value: 'd', label: 'Days' }
  ];

  ngOnInit(): void {
    this.colors = this.app.configurableThemeColors;
    this.loadAvailablePaths();
    
    if (this.enableMinMaxScaleLimit()) {
      this.setValueScaleOptionsControls(this.enableMinMaxScaleLimit().value);
    }

    if (this.timeMode()) {
      this.setTimeModeControls(this.timeMode().value);
    }

    if (this.refreshEnabled()) {
      this.setRefreshControls(this.refreshEnabled().value);
    }

    // Listen for start time changes to auto-enable refresh for 'now'
    this.startTime().valueChanges?.subscribe((value: string) => {
      if (value === 'now') {
        // Auto-enable refresh when 'now' is selected
        if (!this.refreshEnabled().value) {
          this.refreshEnabled().setValue(true);
          this.setRefreshControls(true);
        }
      } else {
        // Disable refresh when not using 'now'
        this.refreshEnabled().setValue(false);
        this.setRefreshControls(false);
      }
    });
  }

  private loadAvailablePaths(): void {
    // Use relative path to current server
    const apiUrl = '/signalk/v1/history/paths';
    
    this.availablePaths$ = this.http.get<string[]>(apiUrl).pipe(
      catchError(error => {
        console.error('Failed to load history paths from', apiUrl, ':', error);
        // Provide some common fallback paths for testing
        return of([
          'navigation.speedOverGround',
          'navigation.courseOverGroundTrue', 
          'navigation.position',
          'environment.wind.speedTrue',
          'environment.wind.directionTrue',
          'navigation.headingTrue'
        ]);
      })
    );
  }

  private setValueScaleOptionsControls(enableMinMaxScaleLimit: boolean): void {
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

  private setTimeModeControls(timeMode: string): void {
    if (timeMode === 'duration') {
      this.endTime()?.disable();
      this.duration()?.enable();
      this.durationUnit()?.enable();
    } else {
      this.endTime()?.enable();
      this.duration()?.disable();
      this.durationUnit()?.disable();
    }
  }

  private setRefreshControls(refreshEnabled: boolean): void {
    if (refreshEnabled) {
      this.refreshInterval()?.enable();
    } else {
      this.refreshInterval()?.disable();
    }
  }

  public setScaleControls(e: MatRadioChange): void {
    this.setValueScaleOptionsControls(e.value);
  }

  public onTimeModeChange(timeMode: string): void {
    this.setTimeModeControls(timeMode);
  }

  public onRefreshEnabledChange(refreshEnabled: boolean): void {
    this.setRefreshControls(refreshEnabled);
  }

  public onHistoryApiUrlChange(): void {
    this.loadAvailablePaths();
  }
}