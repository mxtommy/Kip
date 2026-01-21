import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, effect, inject, input, untracked, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, ChartData, Filler, Legend, LineElement, PointElement, RadarController, RadialLinearScale, Tooltip } from 'chart.js';
import { ITheme } from '../../core/services/app-service';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export interface PolarDataRow {
  twa: number;
  speeds: number[];
}

export interface PolarData {
  tws: number[];
  rows: PolarDataRow[];
}

const DEFAULT_POLAR_DATA: PolarData = {
  tws: [4, 6, 8, 10, 12, 14, 16, 20, 24],
  rows: [
    { twa: 0, speeds: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { twa: 44.0, speeds: [3.23, 0, 0, 0, 0, 0, 0, 0, 0] },
    { twa: 44.0, speeds: [0, 4.42, 0, 0, 0, 0, 0, 0, 0] },
    { twa: 42.2, speeds: [0, 0, 5.20, 0, 0, 0, 0, 0, 0] },
    { twa: 40.6, speeds: [0, 0, 0, 5.69, 0, 0, 0, 0, 0] },
    { twa: 39.7, speeds: [0, 0, 0, 0, 5.97, 0, 0, 0, 0] },
    { twa: 39.3, speeds: [0, 0, 0, 0, 0, 6.06, 0, 0, 0] },
    { twa: 39.2, speeds: [0, 0, 0, 0, 0, 0, 6.10, 0, 0] },
    { twa: 40.2, speeds: [0, 0, 0, 0, 0, 0, 0, 6.21, 0] },
    { twa: 41.8, speeds: [0, 0, 0, 0, 0, 0, 0, 0, 6.21] },
    { twa: 52, speeds: [3.64, 4.89, 5.76, 6.29, 6.57, 6.70, 6.76, 6.81, 6.79] },
    { twa: 60, speeds: [3.89, 5.16, 6.00, 6.47, 6.74, 6.89, 6.96, 7.03, 7.04] },
    { twa: 75, speeds: [4.03, 5.33, 6.16, 6.62, 6.90, 7.10, 7.24, 7.40, 7.48] },
    { twa: 90, speeds: [3.92, 5.23, 6.12, 6.67, 6.98, 7.17, 7.38, 7.70, 7.89] },
    { twa: 110, speeds: [3.74, 5.14, 6.17, 6.76, 7.12, 7.43, 7.69, 8.04, 8.30] },
    { twa: 120, speeds: [3.59, 4.95, 6.00, 6.66, 7.07, 7.40, 7.71, 8.33, 8.81] },
    { twa: 135, speeds: [3.16, 4.44, 5.51, 6.32, 6.82, 7.19, 7.53, 8.24, 9.21] },
    { twa: 150, speeds: [2.62, 3.79, 4.86, 5.75, 6.43, 6.87, 7.21, 7.87, 8.62] },
    { twa: 146.7, speeds: [2.72, 0, 0, 0, 0, 0, 0, 0, 0] },
    { twa: 146.7, speeds: [0, 3.94, 0, 0, 0, 0, 0, 0, 0] },
    { twa: 151.0, speeds: [0, 0, 4.81, 0, 0, 0, 0, 0, 0] },
    { twa: 154.6, speeds: [0, 0, 0, 5.55, 0, 0, 0, 0, 0] },
    { twa: 160.8, speeds: [0, 0, 0, 0, 6.04, 0, 0, 0, 0] },
    { twa: 167.3, speeds: [0, 0, 0, 0, 0, 6.43, 0, 0, 0] },
    { twa: 175.9, speeds: [0, 0, 0, 0, 0, 0, 6.72, 0, 0] },
    { twa: 178.1, speeds: [0, 0, 0, 0, 0, 0, 0, 7.34, 0] },
    { twa: 177.8, speeds: [0, 0, 0, 0, 0, 0, 0, 0, 7.96] }
  ]
};

@Component({
  selector: 'polar-chart',
  templateUrl: './polar-chart.component.html',
  styleUrl: './polar-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PolarChartComponent implements AfterViewInit, OnDestroy {
  public readonly polarData = input<PolarData>(DEFAULT_POLAR_DATA);
  public readonly theme = input<ITheme | null>(null);

  protected readonly polarChart = viewChild.required<ElementRef<HTMLCanvasElement>>('polarChart');

  private readonly ngZone = inject(NgZone);
  private chart: Chart<'radar'> | null = null;
  private readonly angleGridPlugin = {
    id: 'polarAngleGrid',
    beforeDraw: (chart: Chart<'radar'>) => {
      const scale = chart.scales?.r as RadialLinearScale | undefined;
      if (!scale) return;
      const ctx = chart.ctx;
      const centerX = scale.xCenter;
      const centerY = scale.yCenter;
      const radius = scale.drawingArea;
      const angleStep = 30;
      const rotation = (scale.options.startAngle ?? 0) * (Math.PI / 180);

      ctx.save();
      ctx.strokeStyle = scale.options.angleLines?.color as string ?? 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = (scale.options.angleLines?.lineWidth as number | undefined) ?? 1;
      for (let angle = 0; angle < 360; angle += angleStep) {
        const rad = (angle * Math.PI) / 180 + rotation;
        const x = centerX + Math.cos(rad) * radius;
        const y = centerY + Math.sin(rad) * radius;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  constructor() {
    effect(() => {
      const data = this.polarData();
      const theme = this.theme();
      const builtData = this.buildChartData(data ?? DEFAULT_POLAR_DATA);
      const options = this.buildChartOptions(theme);

      untracked(() => this.updateChart(builtData, options));
    });
  }

  ngAfterViewInit(): void {
    const data = this.buildChartData(this.polarData() ?? DEFAULT_POLAR_DATA);
    const options = this.buildChartOptions(this.theme());
    this.initChart(data, options);
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private initChart(data: ChartData<'radar'>, options: ChartConfiguration<'radar'>['options']): void {
    if (this.chart) return;
    const canvas = this.polarChart()?.nativeElement;
    if (!canvas) return;
    Chart.register(this.angleGridPlugin);
    const config: ChartConfiguration<'radar'> = {
      type: 'radar',
      data,
      options
    };
    this.ngZone.runOutsideAngular(() => {
      this.chart = new Chart(canvas, config);
    });
  }

  private updateChart(data: ChartData<'radar'>, options: ChartConfiguration<'radar'>['options']): void {
    if (!this.chart) {
      this.initChart(data, options);
      return;
    }
    this.chart.data = data;
    this.chart.options = options ?? this.chart.options;
    this.ngZone.runOutsideAngular(() => this.chart?.update('none'));
  }

  private buildChartData(data: PolarData): ChartData<'radar'> {
    const baseLabels = this.buildAngleLabels(10);
    const labels = this.buildMirroredLabels(baseLabels);
    const palette = this.buildPalette(data.tws.length);
    const grouped = this.interpolateRows(data.rows, data.tws.length, baseLabels);

    const datasets = data.tws.map((tws, idx) => {
      const values = labels.map(label => {
        const sourceLabel = label <= 180 ? label : 360 - label;
        const row = grouped.get(sourceLabel);
        if (!row) return null;
        const v = row[idx] ?? 0;
        return v > 0 ? v : null;
      });

      return {
        label: `${tws} kn`,
        data: values,
        borderColor: palette[idx].borderColor,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2
      };
    });

    return { labels, datasets };
  }

  private buildChartOptions(theme: ITheme | null): ChartConfiguration<'radar'>['options'] {
    const gridColor = theme?.contrastDimmer ?? 'rgba(255, 255, 255, 0.15)';
    const labelColor = theme?.contrast ?? 'rgba(255, 255, 255, 0.7)';

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        r: {
          angleLines: { display: false, color: gridColor },
          grid: { color: gridColor },
          pointLabels: {
            color: labelColor,
            display: false
          },
          ticks: { color: labelColor, backdropColor: 'rgba(0, 0, 0, 0)' }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: labelColor }
        },
        tooltip: { enabled: true }
      }
    };
  }

  private buildAngleLabels(step: number): number[] {
    const labels: number[] = [];
    for (let angle = 0; angle <= 180; angle += step) {
      labels.push(Number(angle.toFixed(1)));
    }
    return labels;
  }

  private buildMirroredLabels(baseLabels: number[]): number[] {
    if (baseLabels.length === 0) return baseLabels;
    const withoutEnds = baseLabels.filter((angle, index) => index !== 0 && index !== baseLabels.length - 1);
    const mirrored = [...withoutEnds].reverse().map(angle => 360 - angle);
    return [...baseLabels, ...mirrored];
  }

  private interpolateRows(rows: PolarDataRow[], twsCount: number, labels: number[]): Map<number, number[]> {
    const pointsByTws: { twa: number; speed: number }[][] = Array.from({ length: twsCount }, () => []);

    rows.forEach(row => {
      row.speeds.forEach((speed, idx) => {
        if (!speed || speed <= 0) return;
        pointsByTws[idx].push({ twa: row.twa, speed });
      });
    });

    const normalized = pointsByTws.map(points => {
      const map = new Map<number, number>();
      points.forEach(point => {
        const existing = map.get(point.twa);
        if (existing == null || existing < point.speed) map.set(point.twa, point.speed);
      });
      return Array.from(map.entries())
        .map(([twa, speed]) => ({ twa, speed }))
        .sort((a, b) => a.twa - b.twa);
    });

    const grouped = new Map<number, number[]>();
    labels.forEach(label => {
      const values = normalized.map(points => this.interpolateSpeed(points, label));
      grouped.set(label, values);
    });
    return grouped;
  }

  private interpolateSpeed(points: { twa: number; speed: number }[], target: number): number {
    if (!points.length) return 0;
    if (target <= points[0].twa) return points[0].twa === target ? points[0].speed : 0;
    if (target >= points[points.length - 1].twa) {
      return points[points.length - 1].twa === target ? points[points.length - 1].speed : 0;
    }

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (target === a.twa) return a.speed;
      if (target === b.twa) return b.speed;
      if (target > a.twa && target < b.twa) {
        const t = (target - a.twa) / (b.twa - a.twa);
        return a.speed + (b.speed - a.speed) * t;
      }
    }
    return 0;
  }

  private buildPalette(count: number): { borderColor: string; backgroundColor: string }[] {
    return Array.from({ length: count }).map((_, idx) => {
      const hue = Math.round((360 / Math.max(1, count)) * idx);
      return {
        borderColor: `hsl(${hue} 70% 55%)`,
        backgroundColor: `hsla(${hue} 70% 55% / 0.18)`
      };
    });
  }
}
