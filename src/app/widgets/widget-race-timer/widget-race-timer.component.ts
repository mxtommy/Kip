import { Component, OnDestroy, ElementRef, viewChild, inject, effect, signal, untracked, input, AfterViewInit } from '@angular/core';
import { TimersService } from '../../core/services/timers.service';
import { States } from '../../core/interfaces/signalk-interfaces';
import { CanvasService } from '../../core/services/canvas.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';

@Component({
  selector: 'widget-racetimer',
  templateUrl: './widget-race-timer.component.html',
  styleUrls: ['./widget-race-timer.component.scss'],
  imports: [MatButtonModule, MatIconModule]
})
export class WidgetRaceTimerComponent implements AfterViewInit, OnDestroy {
  // Functional inputs
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Host2 runtime (for config + timers not path-driven)
  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly timers = inject(TimersService);
  private readonly canvas = inject(CanvasService);

  // Static config
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    timerLength: -300,
    color: 'contrast',
    playBeeps: true,
    // host2 widgets expect core shape fields when saved; minimal additions:
    displayName: 'Race',
    filterSelfPaths: true,
    paths: {},
    enableTimeout: false,
    dataTimeout: 5,
    ignoreZones: true
  };

  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private maxTextWidth = 0;
  private maxTextHeight = 0;

  private dataValue: number | null = null;
  private zoneState: States | null = null;
  private currentValueLength = 0;
  private valueFontSize = 1;
  private flashOn = false;
  private flashInterval: ReturnType<typeof setInterval> | null = null;
  public timerRunning = signal<boolean>(false);
  private readonly timeName = 'race';
  private warnColor = '';
  private textColor = '';

  constructor() {
    // Palette effect
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      if (!cfg || !theme) return;
      untracked(() => {
        this.applyColors(cfg.color, theme);
        this.draw();
      });
    });

    // Timer subscription effect
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      // ensure timer instance exists
      this.ensureTimer(cfg.timerLength ?? -300);
    });
  }

  ngAfterViewInit(): void {
    this.canvasElement = this.canvasRef().nativeElement;
    this.ctx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true,
      onResize: (w, h) => {
        this.cssWidth = w; this.cssHeight = h;
        this.maxTextWidth = Math.floor(this.cssWidth * 0.95);
        this.maxTextHeight = Math.floor(this.cssHeight);
        this.draw();
      }
    });
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    this.maxTextWidth = Math.floor(this.cssWidth * 0.95);
    this.maxTextHeight = Math.floor(this.cssHeight);
    // initial subscribe/draw handled by ensureTimer via effects
    this.draw();
  }

  private ensureTimer(initial: number) {
    // subscribe only once per widget id
    const obs = this.timers.createTimer(this.timeName, initial, 1000);
    obs.subscribe(newValue => {
      this.dataValue = newValue;
      this.timerRunning.set(this.timers.isRunning(this.timeName));
      // zone & beeps
      if (newValue > 0) {
        this.zoneState = States.Normal;
      } else if (newValue === 0) {
        this.zoneState = States.Normal; this.beep(500, 2000);
      } else if (newValue > -10) {
        this.zoneState = States.Alarm; this.beep(450, 100);
      } else if (newValue >= -29) {
        this.zoneState = States.Warn;
      } else if (newValue === -30) {
        this.zoneState = States.Warn; this.beep(400, 200);
      } else {
        this.zoneState = States.Normal;
      }
      // flashing logic
      if (this.zoneState === States.Alarm && !this.flashInterval) {
        this.flashInterval = setInterval(() => { this.flashOn = !this.flashOn; this.draw(); }, 500);
      } else if (this.zoneState !== States.Alarm && this.flashInterval) {
        clearInterval(this.flashInterval); this.flashInterval = null; this.flashOn = false;
      }
      this.draw();
    });
  }

  public startTimer() {
    this.timers.startTimer(this.timeName);
    this.timerRunning.set(true);
  }

  public resetTimer() {
    this.timers.deleteTimer(this.timeName);
    this.timerRunning.set(false);
    const cfg = this.runtime.options();
    this.ensureTimer(cfg?.timerLength ?? -300);
    this.draw();
  }

  public pauseTimer() {
    this.timers.stopTimer(this.timeName);
    this.timerRunning.set(false);
  }

  public roundToMin() {
    if (this.dataValue == null) return;
    const v = this.dataValue < 0 ? -this.dataValue : this.dataValue;
    const seconds = v % 60;
    if (this.dataValue > 0) {
      this.timers.setTimer(this.timeName, this.dataValue + (seconds > 30 ? (60 - seconds) : -seconds));
    } else {
      this.timers.setTimer(this.timeName, this.dataValue + (seconds > 30 ? -(60 - seconds) : seconds));
    }
  }

  public addTime(amount: number) {
    if (this.dataValue != null) this.timers.setTimer(this.timeName, this.dataValue + amount);
  }

  public removeTime(amount: number) {
    if (this.dataValue != null) this.timers.setTimer(this.timeName, this.dataValue - amount);
  }

  private applyColors(color: string, theme: ITheme) {
    switch (color) {
      case "contrast":
        this.textColor = theme.contrast; this.warnColor = theme.zoneAlarm;
        break;
      case "blue":
        this.textColor = theme.blue; this.warnColor = theme.zoneAlarm;
        break;
      case "green":
        this.textColor = theme.green; this.warnColor = theme.zoneAlarm;
        break;
      case "pink":
        this.textColor = theme.pink; this.warnColor = theme.zoneAlarm;
        break;
      case "orange":
        this.textColor = theme.orange; this.warnColor = theme.zoneAlarm;
        break;
      case "purple":
        this.textColor = theme.purple; this.warnColor = theme.zoneAlarm;
        break;
      case "grey":
        this.textColor = theme.grey; this.warnColor = theme.zoneAlarm;
        break;
      case "yellow":
        this.textColor = theme.yellow; this.warnColor = theme.zoneAlarm;
        break;
      default:
        this.textColor = theme.contrast; this.warnColor = theme.zoneAlarm;
        break;
    }
  }
  protected beep(frequency = 440, duration = 100) {
    if (this.runtime.options()?.playBeeps) {
      const audioCtx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency; // Hz
      gainNode.gain.value = 0.1; // volume

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration / 1000);
    }
  }

  ngOnDestroy() {
    try { if (this.canvasElement) this.canvas.unregisterCanvas(this.canvasElement); } catch { /* ignore */ }
    if (this.flashInterval) { clearInterval(this.flashInterval); this.flashInterval = null; }
  }

  /* ******************************************************************************************* */
  /*                                  Canvas                                                     */
  /* ******************************************************************************************* */

  private draw() {
    if (!this.ctx) return;
    this.canvas.clearCanvas(this.ctx, this.cssWidth, this.cssHeight);
    let valueText: string;

    if (this.dataValue != null) {
      const v = Math.abs(this.dataValue); // Always positive
      const m = Math.floor(v / 60);
      const s = Math.floor(v % 60);
      valueText = `${m}:${('0' + s).slice(-2)}`;

      if (this.dataValue < 0) {
        valueText = `-${valueText}`;
      }
    } else {
      valueText = "--";
    }

    // Check if the length of the string has changed
    if (this.currentValueLength !== valueText.length) {
      this.currentValueLength = valueText.length;
      this.valueFontSize = this.canvas.calculateOptimalFontSize(this.ctx, valueText, this.maxTextWidth, this.maxTextHeight, 'bold');
    }

    // Set the text color based on the zone state
    switch (this.zoneState) {
      case States.Alarm:
        if (this.flashOn) { this.ctx.fillStyle = this.textColor; }
        else { this.canvas.drawRectangle(this.ctx, 0, 0, this.cssWidth, this.cssHeight, this.warnColor); this.ctx.fillStyle = this.textColor; }
        break;
      case States.Warn:
        this.ctx.fillStyle = this.warnColor;
        break;
      default:
        this.ctx.fillStyle = this.textColor;
    }

    // Draw the text
    this.canvas.drawText(this.ctx, valueText, this.cssWidth / 2, this.cssHeight / 2, this.maxTextWidth, this.maxTextHeight, 'bold', this.ctx.fillStyle, 'center', 'middle');
  }
}
