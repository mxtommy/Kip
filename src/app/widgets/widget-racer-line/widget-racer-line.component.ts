import { Component, AfterViewInit, OnDestroy, ElementRef, viewChild, inject, effect, signal, untracked, input } from '@angular/core';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { IWidgetSvcConfig, IPathArray } from '../../core/interfaces/widgets-interface';
import { CanvasService } from '../../core/services/canvas.service';
import { getColors } from '../../core/utils/themeColors.utils';
import { DashboardService } from '../../core/services/dashboard.service';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ITheme } from '../../core/services/app-service';

@Component({
  selector: 'widget-racer-line',
  templateUrl: './widget-racer-line.component.html',
  styleUrls: ['./widget-racer-line.component.scss'],
  imports: [MatButtonModule, MatIconModule]
})
export class WidgetRacerLineComponent implements AfterViewInit, OnDestroy {
  // Functional inputs (Host2 contract)
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Host2 directives/services
  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);
  private readonly canvas = inject(CanvasService);
  protected readonly dashboard = inject(DashboardService);
  private readonly signalk = inject(SignalkRequestsService);
  private readonly destroyRef = inject(DestroyRef);

  // Static config from legacy defaultConfig
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'DTS',
    filterSelfPaths: true,
    playBeeps: true,
    convertUnitTo: 'm',
    convertUnitToGroup: 'Length',
    numDecimal: 0,
    ignoreZones: true,
    color: 'contrast',
    enableTimeout: false,
    dataTimeout: 5,
    paths: {
      dtsPath: {
        description: 'Distance to Start Line',
        path: 'self.navigation.racing.distanceStartline',
        source: 'default',
        pathType: 'number',
        pathRequired: false,
        isPathConfigurable: false,
        convertUnitTo: 'm',
        showPathSkUnitsFilter: true,
        pathSkUnitsFilter: 'm',
        sampleTime: 500
      },
      lineLengthPath: {
        description: 'Length of the start line',
        path: 'self.navigation.racing.startLineLength',
        source: 'default',
        pathType: 'number',
        pathRequired: false,
        isPathConfigurable: false,
        convertUnitTo: 'm',
        showPathSkUnitsFilter: true,
        pathSkUnitsFilter: 'm',
        sampleTime: 1000
      },
      lineBiasPath: {
        description: 'Bias of the start line to starboard end',
        path: 'self.navigation.racing.stbLineBias',
        source: 'default',
        pathType: 'number',
        pathRequired: false,
        isPathConfigurable: false,
        convertUnitTo: 'm',
        showPathSkUnitsFilter: true,
        pathSkUnitsFilter: 'm',
        sampleTime: 1000
      }
    }
  };

  // Canvas refs
  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private titleBitmap: HTMLCanvasElement | null = null;
  private titleBitmapText: string | null = null;

  // State
  private dtsValue: number | null = null;
  private lengthValue: number | null = null;
  private biasValue: number | null = null;
  protected labelColor = signal<string>('');
  private valueColor = '';
  private dtsColor = '';
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;
  protected portBiasValue = signal<string>('');
  protected lineLengthValue = signal<string>('');
  protected stbBiasValue = signal<string>('');
  protected mode = signal<number>(0);

  constructor() {
    // Theme/palette effect
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      if (!cfg || !theme) return;
      untracked(() => {
        const palette = getColors(cfg.color, theme);
        this.labelColor.set(palette.dim);
        this.valueColor = palette.color;
        this.draw();
      });
    });

    // Observe dtsPath
    effect(() => {
      const cfg = this.runtime.options(); if (!cfg) return;
      const pathCfg = (cfg.paths as IPathArray | undefined)?.['dtsPath'];
      if (!pathCfg?.path) return;
      untracked(() => this.streams.observe('dtsPath', pkt => {
        this.dtsValue = pkt?.data?.value ?? null;
        this.updateDtsColor();
        this.draw();
      }));
    });

    // Observe lineLengthPath
    effect(() => {
      const cfg = this.runtime.options(); if (!cfg) return;
      const pathCfg = (cfg.paths as IPathArray | undefined)?.['lineLengthPath'];
      if (!pathCfg?.path) return;
      untracked(() => this.streams.observe('lineLengthPath', pkt => {
        this.lengthValue = pkt?.data?.value ?? null;
        this.drawLenBias();
        this.draw();
      }));
    });

    // Observe lineBiasPath
    effect(() => {
      const cfg = this.runtime.options(); if (!cfg) return;
      const pathCfg = (cfg.paths as IPathArray | undefined)?.['lineBiasPath'];
      if (!pathCfg?.path) return;
      untracked(() => this.streams.observe('lineBiasPath', pkt => {
        this.biasValue = pkt?.data?.value ?? null;
        this.drawLenBias();
      }));
    });

    // Request feedback beep
    this.signalk.subscribeRequest().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result.widgetUUID === this.id()) {
        if (result.statusCode === 200) this.beep(600, 20);
      }
    });
  }

  // Canvas lifecycle
  ngAfterViewInit(): void {
    this.canvasElement = this.canvasRef().nativeElement;
    this.ctx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true,
      onResize: (w, h) => {
        this.cssWidth = w; this.cssHeight = h;
        this.maxValueTextWidth = Math.floor(this.cssWidth * 0.95);
        this.maxValueTextHeight = Math.floor(this.cssHeight * 0.95);
        this.draw();
      }
    });
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    this.maxValueTextWidth = Math.floor(this.cssWidth * 0.95);
    this.maxValueTextHeight = Math.floor(this.cssHeight * 0.95);
    this.draw();
  }

  // Interaction methods
  public toggleMode(): void {
    this.mode.update(v => (v + 1) % 4);
    this.draw();
  }

  public setLineEnd(end: string): string {
    return this.signalk.putRequest('navigation.racing.setStartLine', { end, position: 'bow' }, this.id());
  }

  public adjustLineEnd(end: string, delta: number, rotateRadians: number): string {
    return this.signalk.putRequest('navigation.racing.setStartLine', { end, delta, rotate: rotateRadians || null }, this.id());
  }

  public toRadians(deg: number): number | null {
    return deg ? deg * (Math.PI / 180) : null;
  }

  // Drawing helpers
  private draw(): void {
    if (!this.ctx || !this.canvasElement) return;
    const cfg = this.runtime.options();
    if (!this.titleBitmap || !cfg || this.titleBitmap.width !== this.canvasElement.width || this.titleBitmap.height !== this.canvasElement.height || this.titleBitmapText !== cfg.displayName) {
      const name = cfg?.displayName || 'DTS';
      this.titleBitmap = this.canvas.createTitleBitmap(name, this.labelColor(), 'normal', this.cssWidth, this.cssHeight);
      this.titleBitmapText = name;
    }
    this.canvas.clearCanvas(this.ctx, this.cssWidth, this.cssHeight);
    if (this.titleBitmap) this.ctx.drawImage(this.titleBitmap, 0, 0, this.cssWidth, this.cssHeight);
    this.drawDToLine();
    this.drawLenBias();
    this.drawUnit();
  }

  private drawDToLine(): void {
    const valueText = this.getValueText();
    this.canvas.drawText(
      this.ctx,
      valueText,
      Math.floor(this.cssWidth / 2),
      Math.floor((this.cssHeight / 2) * 1.3),
      this.maxValueTextWidth,
      this.maxValueTextHeight,
      'bold',
      this.dtsColor
    );
  }

  private getValueText(): string {
    if (this.dtsValue === null) return '--';
    const cfg = this.runtime.options();
    return this.dtsValue.toFixed(cfg?.numDecimal ?? 0);
  }

  private drawUnit(): void {
    const unit = (this.runtime.options()?.paths as IPathArray | undefined)?.['dtsPath']?.convertUnitTo || 'm';
    this.canvas.drawText(
      this.ctx,
      unit,
      Math.floor(this.cssWidth - 10 * this.canvas.scaleFactor),
      Math.floor(this.cssHeight - 7 * this.canvas.scaleFactor),
      Math.floor(this.cssWidth * 0.25),
      Math.floor(this.cssHeight * 0.15),
      'bold',
      this.dtsColor,
      'end',
      'alphabetic'
    );
  }

  private drawLenBias(): void {
    const cfg = this.runtime.options(); if (!cfg) return;
    if ((cfg.paths as IPathArray)['lineLengthPath'].path && this.lengthValue != null) {
      let unit = (cfg.paths as IPathArray)['lineLengthPath'].convertUnitTo;
      if (unit === 'feet') unit = '′';
      this.lineLengthValue.set(`―${this.applyDecorations(this.lengthValue.toFixed(cfg.numDecimal))}${unit}―`);
    }
    if ((cfg.paths as IPathArray)['lineBiasPath'].path && this.biasValue != null) {
      let unit = (cfg.paths as IPathArray)['lineBiasPath'].convertUnitTo;
      if (unit === 'feet') unit = '′';
      if (this.biasValue < 0) {
        this.portBiasValue.set('+' + (-this.biasValue).toFixed(cfg.numDecimal) + unit);
        this.stbBiasValue.set(this.biasValue.toFixed(cfg.numDecimal) + unit);
      } else {
        this.portBiasValue.set(' ' + (-this.biasValue).toFixed(cfg.numDecimal) + unit);
        this.stbBiasValue.set(' +' + this.biasValue.toFixed(cfg.numDecimal) + unit);
      }
    }
  }

  private applyDecorations(txt: string): string {
    switch ((this.runtime.options()?.paths as IPathArray | undefined)?.['dtsPath']?.convertUnitTo) {
      case 'percent':
      case 'percentraw':
        return txt + '%';
      default:
        return txt;
    }
  }

  private updateDtsColor(): void {
    const theme = this.theme(); const cfg = this.runtime.options();
    if (!theme || !cfg) return;
    if (cfg.ignoreZones) {
      if (!this.dtsValue) this.dtsColor = this.valueColor;
      else if (this.dtsValue < 0) this.dtsColor = theme.zoneAlarm;
      else if (this.dtsValue < 10) this.dtsColor = theme.zoneWarn;
      else if (this.dtsValue < 20) this.dtsColor = theme.zoneAlert;
      else this.dtsColor = this.valueColor;
    } else {
      // Placeholder for potential state-driven colors (legacy used path states)
      this.dtsColor = this.valueColor;
    }
  }

  private beep(frequency = 440, duration = 100) {
    if (!this.runtime.options()?.playBeeps) return;
    const AudioCtx = (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const audioCtx = new AudioCtx();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration / 1000);
  }

  ngOnDestroy(): void {
    try {
      if (this.canvasElement) this.canvas.unregisterCanvas(this.canvasElement);
    } catch { /* ignore */ }
  }
}
