import { Component, effect, signal, inject, input, untracked, viewChild, ElementRef, DestroyRef, model } from '@angular/core';
import { AfterViewInit, OnDestroy } from '@angular/core';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { IPathArray } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { CanvasService } from '../../core/services/canvas.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getColors } from '../../core/utils/themeColors.utils';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'widget-racer-timer',
  templateUrl: './widget-racer-timer.component.html',
  styleUrls: ['./widget-racer-timer.component.scss'],
  imports: [FormsModule, MatButtonModule, MatIconModule]
})
export class WidgetRacerTimerComponent implements AfterViewInit, OnDestroy {
  // Functional inputs
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Static config
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'TTS',
    nextDashboard: 0,
    playBeeps: true,
    filterSelfPaths: true,
    paths: {
      ttsPath: { description: 'Time to the Start in seconds', path: 'self.navigation.racing.timeToStart', source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false, convertUnitTo: 's', showConvertUnitTo: false, showPathSkUnitsFilter: false, pathSkUnitsFilter: 's', sampleTime: 500 },
      startTimePath: { description: 'Time of the start', path: 'self.navigation.racing.startTime', source: 'default', pathType: 'Date', pathRequired: false, isPathConfigurable: false, sampleTime: 500 },
      dtsPath: { description: 'Distance to Start Line path, used to determine OCS', path: 'self.navigation.racing.distanceStartline', source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false, convertUnitTo: 'm', showPathSkUnitsFilter: false, pathSkUnitsFilter: 'm', sampleTime: 500 }
    },
    color: 'contrast',
    enableTimeout: false,
    dataTimeout: 5,
    ignoreZones: true
  };

  // Injected directives/services
  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);
  private readonly signalk = inject(SignalkRequestsService);
  protected readonly dashboard = inject(DashboardService);
  private readonly canvas = inject(CanvasService);
  private readonly destroyRef = inject(DestroyRef);

  // Canvas refs
  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private titleBitmap: HTMLCanvasElement | null = null;
  private titleBitmapText: string | null = null;

  // Signals
  protected labelColor = signal<string>('');
  protected mode = signal<number>(1); // mimic legacy mode state machine
  private ttsValue: number | null = null;
  private dtsValue: number | null = null;
  private valueColor = '';
  private valueStateColor = '';
  protected startAtTime = signal<string>('00:00:00');
  protected startAtTimeEdit = model<string>('');

  constructor() {
    // Theme / palette effect
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      if (!cfg || !theme) return;
      untracked(() => {
        const palette = getColors(cfg.color, theme);
        this.labelColor.set(palette.dim);
        this.valueColor = palette.color;
        this.valueStateColor = palette.color;
        this.draw();
      });
    });

    // Stream: TTS
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['ttsPath']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('ttsPath', pkt => {
        const lastTts = this.ttsValue;
        this.ttsValue = pkt?.data?.value ?? null;
        this.updateValueColor();
        this.draw();
        if (this.shouldBeep(lastTts, this.ttsValue)) this.beepForValue(this.ttsValue!);
        if (cfg.nextDashboard >= 0 && lastTts === 1 && this.ttsValue === 0 && (!this.dtsValue || this.dtsValue >= 0)) {
          // Navigation handled externally (legacy used router) – could inject Router if needed
        }
      }));
    });

    // Stream: start time
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['startTimePath']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('startTimePath', pkt => {
        const v = pkt?.data?.value as string | null;
        if (!v) {
          this.startAtTime.set('HH:MM:SS');
          this.startAtTimeEdit.set('HH:MM:SS');
          if (this.mode() === 2) this.mode.set(1);
        } else {
          const iso = new Date(v);
          this.startAtTimeEdit.set(iso.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          this.startAtTime.set(this.startAtTimeEdit());
        }
        this.draw();
      }));
    });

    // Stream: distance to start line
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['dtsPath']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('dtsPath', pkt => {
        this.dtsValue = pkt?.data?.value ?? null;
      }));
    });

    // Request subscription (PUT feedback)
    this.signalk.subscribeRequest().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result.widgetUUID === this.id()) {
        if (result.statusCode === 200) this.beep(600, 20);
      }
    });
  }

  // Canvas lifecycle
  ngAfterViewInit() {
    this.canvasElement = this.canvasRef().nativeElement;
    this.ctx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true, onResize: (w, h) => {
        this.cssWidth = w; this.cssHeight = h; this.draw();
      }
    });
    // initial dims
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    this.draw();
  }

  ngOnDestroy() {
    try { if (this.canvasElement) this.canvas.unregisterCanvas(this.canvasElement); } catch { /* ignore */ }
  }

  // Interaction methods (mapped from legacy)
  public toggleMode(): void {
    this.mode.update(v => (v + 1) % 5);
    const tts = this.ttsValue;
    if (this.mode() === 1 && this.isStartTimerRunning()) this.mode.set(2);
    if (this.mode() === 2 && tts !== 0 && !this.isStartTimerRunning()) this.mode.set(3);
    this.draw();
  }

  public sendStartTimerCommand(command: string): void {
    this.signalk.putRequest('navigation.racing.setStartTime', { command }, this.id());
    if (command === 'start') this.mode.set(0);
    if (command === 'reset') { this.startAtTime.set('HH:MM:SS'); this.mode.set(1); }
  }

  public adjustStartTime(delta: number): void {
    this.signalk.putRequest('navigation.racing.setStartTime', { command: 'adjust', delta }, this.id());
  }

  public setStartTime(): void {
    const now = new Date();
    const parts = this.startAtTimeEdit().split(':').map(Number);
    const hours = parts[0]; const minutes = parts[1]; const seconds = parts.length >= 3 ? parts[2] : 0;
    const date = new Date(now); date.setHours(hours, minutes, seconds, 0); if (date <= now) date.setDate(date.getDate() + 1);
    this.mode.set(0);
    this.signalk.putRequest('navigation.racing.setStartTime', { command: 'set', startTime: date.toISOString() }, this.id());
  }

  // Helpers
  private isStartTimerRunning(): boolean {
    return (this.ttsValue ?? 0) > 0 && this.startAtTime() !== null && this.startAtTime() !== 'HH:MM:SS';
  }

  private shouldBeep(lastVal: number | null, current: number | null): boolean {
    if (current == null) return false;
    if (this.startAtTime() === 'HH:MM:SS') return false;
    if (!this.runtime.options()?.playBeeps) return false;
    if (current === 0 && lastVal !== 0) return true;
    if (current < 10 && current >= 0) return true;
    if (current < 60 && current % 10 === 0) return true;
    if (current % 60 === 0) return true;
    return false;
  }

  private beepForValue(v: number) {
    if (v === 0) this.beep(500, 1000);
    else if (v < 10) this.beep(450, 100);
    else if (v < 60 && v % 10 === 0) this.beep(400, 150);
    else if (v % 60 === 0) this.beep(350, 200);
  }

  private updateValueColor() {
    const theme = this.theme(); const cfg = this.runtime.options();
    if (!theme || !cfg) return;
    if (cfg.ignoreZones) {
      if (!this.ttsValue) this.valueStateColor = this.valueColor;
      else if (this.ttsValue === 0) this.valueStateColor = this.valueColor;
      else if (this.ttsValue < 10) this.valueStateColor = (this.dtsValue ?? 0) < 0 ? theme.zoneAlarm : theme.zoneWarn;
      else if (this.ttsValue < 60) this.valueStateColor = theme.zoneAlert;
      else this.valueStateColor = this.valueColor;
    } else {
      this.valueStateColor = this.valueColor; // states path not used; kept for future
    }
    if (this.ttsValue === 0) {
      this.mode.set(2);
      if ((this.dtsValue ?? 0) < 0) this.valueStateColor = theme.zoneAlarm;
    } else if (this.mode() === 1 && this.isStartTimerRunning()) this.mode.set(2);
  }

  private getValueText(): string {
    if (this.ttsValue == null) return '--';
    const seconds = this.ttsValue;
    const minutes = Math.floor(seconds / 60);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mm = Math.floor(minutes % 60);
      const ss = Math.floor(seconds % 60);
      return `${hours}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    } else {
      const mm = Math.floor(minutes % 60);
      const ss = Math.floor(seconds % 60);
      return `${mm.toString().padStart(1, '0')}:${ss.toString().padStart(2, '0')}`;
    }
  }

  private draw() {
    if (!this.ctx || !this.canvasElement) return;
    if (!this.titleBitmap || this.titleBitmap.width !== this.canvasElement.width || this.titleBitmap.height !== this.canvasElement.height || this.titleBitmapText !== this.runtime.options()?.displayName) {
      const cfg = this.runtime.options();
      const name = cfg?.displayName || 'TTS';
      this.titleBitmap = this.canvas.createTitleBitmap(name, this.labelColor(), 'normal', this.cssWidth, this.cssHeight);
      this.titleBitmapText = name;
    }
    this.canvas.clearCanvas(this.ctx, this.cssWidth, this.cssHeight);
    if (this.titleBitmap) this.ctx.drawImage(this.titleBitmap, 0, 0, this.cssWidth, this.cssHeight);
    const text = this.getValueText();
    this.canvas.drawText(
      this.ctx,
      text,
      Math.floor(this.cssWidth / 2),
      Math.floor((this.cssHeight / 2) * 1.3),
      Math.floor(this.cssWidth * 0.95),
      Math.floor(this.cssHeight * 0.95),
      'bold',
      this.valueStateColor
    );
  }

  private beep(frequency = 440, duration = 100) {
    if (!this.runtime.options()?.playBeeps) return;
    const AudioCtx = (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const audioCtx = new AudioCtx();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode); gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine'; oscillator.frequency.value = frequency; gainNode.gain.value = 0.1;
    oscillator.start(); oscillator.stop(audioCtx.currentTime + duration / 1000);
  }
}
