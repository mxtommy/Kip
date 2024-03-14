import { Component, ViewChild, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { DatasetService, IDatasetServiceDatasetConfig, IDatasetServiceDataset } from '../../core/services/data-set.service';
import { Subscription } from 'rxjs';

import { Chart, ChartConfiguration, ChartData, ChartType } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import 'chartjs-adapter-date-fns';

interface IChartColors {
    valueLine: string,
    valueFill: string,
    averageLine: string,
    averageFill: string,
    averageChartLine: string,
}

@Component({
  selector: 'widget-data-chart',
  standalone: true,
  imports: [],
  templateUrl: './widget-data-chart.component.html',
  styleUrl: './widget-data-chart.component.scss'
})
export class WidgetDataChartComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('chartTrends', {static: true, read: ElementRef}) chartTrends: ElementRef;

  private transformDataset = (rawDs: IDatasetServiceDataset[], datasetType: number) => {
    let newDs = [];
    rawDs.map(row => {
      newDs.push(this.transformDatasetRow(row, datasetType));
    });
    return newDs;
  };
  private transformDatasetRow = (row: IDatasetServiceDataset, datasetType) => {
    const newRow: {x: number, y: number} = {x: row.timestamp, y: null};

    // Check if its a value or an average row
    if (datasetType === 0) {
      newRow.y = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.value);
    } else {
      switch (this.widgetProperties.config.datasetAverageArray) {
        case "sma":
          newRow.y = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.sma);
          break;
        case "ema":
          newRow.y = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.ema);
          break;

        case "dema":
          newRow.y = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.doubleEma);
          break;

        case "avg":
          newRow.y = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, row.data.lastAverage);
          break;
      }
    }
    return newRow;
  };

  public lineChartData: ChartData <'line', {x: number, y: number} []> = {
    datasets: []
  };
  public lineChartOptions: ChartConfiguration['options'] = {
    parsing: false,
    datasets: {
      line: {
        pointRadius: 0, // disable for all `'line'` datasets
        pointHoverRadius: 0, // disable for all `'line'` datasets
        tension:  0.4,
      }
    },
    animations: {
      tension: {
        easing: "easeInOutCubic"
      }
    }
  }
  public lineChartType: ChartType = 'line';
  private chart;
  private dsServiceSub: Subscription = null;
  private datasetConfig: IDatasetServiceDatasetConfig = null;

  constructor(private dsService: DatasetService) {
    super();

    this.defaultConfig = {
      displayName: 'Chart Label',
      filterSelfPaths: true,
      convertUnitTo: "unitless",
      datasetUUID: null,
      invertData: false,
      datasetAverageArray: 'avg',
      showAverageData: true,
      displayDatasetMinimumValueLine: false,
      displayDatasetMaximumValueLine: false,
      displayDatasetAverageValueLine: true,
      displayDatasetAngleAverageValueLine: false,
      startScaleAtZero: true,
      verticalGraph: false,
      showTimeScale: false,
      enableMinMaxScaleLimit: false,
      minValue: null,
      maxValue: null,
      textColor: 'primary',
    };

    Chart.register(annotationPlugin);
   }

  ngOnInit(): void {
    this.validateConfig();
    this.setChartOptions();

    // Get dataset configuration
    this.datasetConfig = this.dsService.getDatasetConfig(this.widgetProperties.config.datasetUUID);
    if (this.datasetConfig) {
      // Get historical data
      const dsData: IDatasetServiceDataset[] = this.dsService.getHistoricalData(this.widgetProperties.config.datasetUUID);

      if (dsData && dsData.length > 0) {
        // Transform, convert to units data and load chart dataset data
        this.lineChartData.datasets[0].data = this.transformDataset(dsData, 0);

        if (this.widgetProperties.config.showAverageData) {
          this.lineChartData.datasets[1].data = this.transformDataset(dsData, 1);
        }

        const lastAverage = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsData[dsData.length - 1].data.lastAverage);
        const lastMinimum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsData[dsData.length - 1].data.lastMinimum);
        const lastMaximum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsData[dsData.length - 1].data.lastMaximum);

        this.chart = new Chart(this.chartTrends.nativeElement.getContext('2d'), {
          type: this.lineChartType,
          data: this.lineChartData,
          options: this.lineChartOptions
        });

        this.chart.options.plugins.annotation.annotations.averageLine.value = lastAverage;
        this.chart.options.plugins.annotation.annotations.averageLine.label.content = `Avg: ${Math.round(lastAverage)}`;
        this.chart.options.plugins.annotation.annotations.minimumLine.value = lastMinimum;
        this.chart.options.plugins.annotation.annotations.minimumLine.label.content = `Min: ${Math.round(lastMinimum)}`;
        this.chart.options.plugins.annotation.annotations.maximumLine.value = lastMaximum;
        this.chart.options.plugins.annotation.annotations.maximumLine.label.content = `Max: ${Math.round(lastMaximum)}`;
        this.chart?.update('none');
      } else {
        this.chart = new Chart(this.chartTrends.nativeElement.getContext('2d'), {
          type: this.lineChartType,
          data: this.lineChartData,
          options: this.lineChartOptions
        });
      }

      this.startStreaming();
    }
  }

  private setChartOptions() {
    this.lineChartOptions.maintainAspectRatio = false;

    this.lineChartData.datasets.push(
      {
        label: 'Value',
        data: [],
        order: 2,
        parsing: false,
        tension: 0,
        borderWidth: 0,
        backgroundColor: this.getThemeColors().averageFill,
        fill: true
      }
    );

    this.lineChartData.datasets.push(
      {
        label: 'Average',
        data: [],
        order: 1,
        parsing: false,
        tension: 0.4,
        borderColor: this.getThemeColors().valueLine,
        fill: false
      }
    );

    this.lineChartOptions.scales = {
      x: {
        type: "time",
        time: {
          unit: "second",
          minUnit: "second",
          round: "second",
          displayFormats: {
            second: "ss"
          }
        }
      },
      y: {
        position: "right",
        beginAtZero: !this.widgetProperties.config.startScaleAtZero,
        grace: "5%",
        ticks: {
          maxTicksLimit: 6
        }
      }
    }

    this.lineChartOptions.plugins = {
      title: {
        display: true,
        text: this.widgetProperties.config.displayName
      },
      annotation : {
        annotations: {
          averageLine: {
            type: 'line',
            scaleID: 'y',
            display: this.widgetProperties.config.displayDatasetAverageValueLine,
            value: null,
            borderDash: [6, 6],
            borderColor: this.getThemeColors().averageChartLine,
            drawTime: 'afterDatasetsDraw',
            label: {
              display: true
            }
          },
          minimumLine: {
            type: 'line',
            scaleID: 'y',
            display: this.widgetProperties.config.startScaleAtZero ? false : this.widgetProperties.config.displayDatasetMinimumValueLine,
            value: null,
            drawTime: 'afterDatasetsDraw',
            label: {
              display: true
            }
          },
          maximumLine: {
            type: 'line',
            scaleID: 'y',
            display: this.widgetProperties.config.displayDatasetMaximumValueLine,
            value: null,
            drawTime: 'afterDatasetsDraw',
            label: {
              display: true
            }
          }
        }
      },
      legend: {
        display: false
      }
    }
  }

  private getThemeColors(): IChartColors {
    const widgetColor = this.widgetProperties.config.textColor;
    const colors: IChartColors = {
      valueLine: null,
      valueFill: null,
      averageLine: null,
      averageFill: null,
      averageChartLine: null,
    };

    switch (widgetColor) {
      case "text":
        colors.valueLine = this.theme.text;
        colors.valueFill = this.theme.text;
        colors.averageLine = this.theme.textDark;
        colors.averageFill = this.theme.textDark;
        colors.averageChartLine = this.theme.textDark;
        break;

      case "primary":
        colors.valueLine = this.theme.textPrimaryLight;
        colors.valueFill = this.theme.textPrimaryLight;
        colors.averageLine = this.theme.textPrimaryDark;
        colors.averageFill = this.theme.textPrimaryDark;
        colors.averageChartLine = this.theme.primary;
        break;

      case "accent":
        colors.valueLine = this.theme.textAccentLight;
        colors.valueFill = this.theme.textAccentLight;
        colors.averageLine = this.theme.textAccentDark;
        colors.averageFill = this.theme.textAccentDark;
        colors.averageChartLine = this.theme.accent;
        break;

      case "warn":
        colors.valueLine = this.theme.textWarnLight;
        colors.valueFill = this.theme.textWarnLight;
        colors.averageLine = this.theme.textWarnDark;
        colors.averageFill = this.theme.textWarnDark;
        colors.averageChartLine = this.theme.warn;
        break;
    }
    return colors;
  }

  private startStreaming(): void {
    this.dsServiceSub = this.dsService.getDatasetObservable(this.widgetProperties.uuid, this.widgetProperties.config.datasetUUID).subscribe(
      (dsPoint: IDatasetServiceDataset) => {
        if (!dsPoint) return; // we will get null back if we subscribe to a dataset before the app has started it. No need to update until we have values

        if (this.lineChartData.datasets[0].data.length >= this.datasetConfig.maxDataPoints) {
          this.lineChartData.datasets.forEach(dataset => dataset.data.shift());
        }

        // Value datasets
        this.lineChartData.datasets[0].data.push(this.transformDatasetRow(dsPoint, 0));
        // Average dataset
        if (this.widgetProperties.config.showAverageData) {
          this.lineChartData.datasets[1].data.push(this.transformDatasetRow(dsPoint, this.widgetProperties.config.datasetAverageArray));
        }

        const lastAverage = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.lastAverage);
        const lastMinimum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.lastMinimum);
        const lastMaximum = this.unitsService.convertUnit(this.widgetProperties.config.convertUnitTo, dsPoint.data.lastMaximum);

        if (this.chart.options.plugins.annotation.annotations.averageLine.value != lastAverage) {
          this.chart.options.plugins.annotation.annotations.averageLine.value = lastAverage;
          this.chart.options.plugins.annotation.annotations.averageLine.label.content = `Avg: ${Math.round(lastAverage)}`;
        }
        if (this.chart.options.plugins.annotation.annotations.minimumLine.value != lastMinimum) {
          this.chart.options.plugins.annotation.annotations.minimumLine.value = lastMinimum;
          this.chart.options.plugins.annotation.annotations.minimumLine.label.content = `Min: ${Math.round(lastMinimum)}`;
        }
        if (this.chart.options.plugins.annotation.annotations.maximumLine.value != lastMaximum) {
          this.chart.options.plugins.annotation.annotations.maximumLine.value = lastMaximum;
          this.chart.options.plugins.annotation.annotations.maximumLine.label.content = `Max: ${Math.round(lastMaximum)}`;
        }

        this.chart?.update('none');
      }
    );
  }

  ngOnDestroy(): void {
    this.dsServiceSub?.unsubscribe();
  }
}
