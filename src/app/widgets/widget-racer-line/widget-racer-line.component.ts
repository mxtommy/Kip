import { MatIconModule } from '@angular/material/icon';
import {AfterViewInit, Component, DestroyRef, effect, ElementRef, inject, OnDestroy, OnInit, signal, untracked, viewChild} from '@angular/core';
import {BaseWidgetComponent} from '../../core/utils/base-widget.component';
import {States} from '../../core/interfaces/signalk-interfaces';
import {WidgetHostComponent} from '../../core/components/widget-host/widget-host.component';
import {IWidgetSvcConfig} from '../../core/interfaces/widgets-interface';
import {NgxResizeObserverModule} from 'ngx-resize-observer';
import {CanvasService} from '../../core/services/canvas.service';
import {SignalkRequestsService} from '../../core/services/signalk-requests.service';
import {WidgetTitleComponent} from '../../core/components/widget-title/widget-title.component';
import { MatButtonModule} from '@angular/material/button';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import { getColors } from '../../core/utils/themeColors.utils';
import { DashboardService } from '../../core/services/dashboard.service';

@Component({
  selector: 'widget-racer-line',
  templateUrl: './widget-racer-line.component.html',
  styleUrls: ['./widget-racer-line.component.scss'],
  imports: [WidgetHostComponent, NgxResizeObserverModule, WidgetTitleComponent, MatButtonModule, MatIconModule]
})
export class WidgetRacerLineComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private signalk = inject(SignalkRequestsService);
  protected readonly dashboard = inject(DashboardService);
  private dToLineCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('dToLineCanvas');
  protected dToLineContext: CanvasRenderingContext2D;
  protected dToLineElement: HTMLCanvasElement;
  private canvasService = inject(CanvasService);
  private dtsValue: number = null;
  private lengthValue: number = null;
  private biasValue: number = null;
  protected labelColor = signal<string>(undefined);
  private valueColor: string = undefined;
  private dtsColor: string = undefined;
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;

  protected portBiasValue = signal<string>('');
  protected lineLengthValue = signal<string>('');
  protected stbBiasValue = signal<string>('');
  protected infoFontSize = '1em';

  private initCompleted = false;
  private isDestroyed = false; // guard against callbacks after destroyed
  protected mode = 0;

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    super();

    this.defaultConfig = {
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
        'dtsPath': {
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
        'lineLengthPath': {
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
        'lineBiasPath': {
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

    effect(() => {
      if (this.theme()) {
        if (!this.initCompleted) return;
        untracked(() => {
          this.labelColor.set(getColors(this.widgetProperties.config.color, this.theme()).dim);
          this.valueColor = getColors(this.widgetProperties.config.color, this.theme()).color;
          this.updateCanvas();
        });
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
    this.labelColor.set(getColors(this.widgetProperties.config.color, this.theme()).dim);
    this.valueColor = getColors(this.widgetProperties.config.color, this.theme()).color;
  }

  ngAfterViewInit(): void {
    this.initCompleted = true;
    this.initCanvasContexts();
    if (this.isDestroyed) {
      return;
    }
    this.startWidget();
  }

  private initCanvasContexts() {
    this.dToLineElement = this.dToLineCanvas().nativeElement;
    this.canvasService.setHighDPISize(this.dToLineElement, this.dToLineElement.parentElement.getBoundingClientRect());
    this.dToLineContext = this.dToLineElement.getContext('2d');
    this.maxValueTextWidth = Math.floor(this.dToLineElement.width * 0.95);
    this.maxValueTextHeight = Math.floor(this.dToLineElement.height * 0.95);
  }

  protected startWidget(): void {
    this.widgetProperties.config.paths['dtsPath'].convertUnitTo = this.widgetProperties.config.convertUnitTo || 'm';
    this.widgetProperties.config.paths['lineLengthPath'].convertUnitTo = this.widgetProperties.config.convertUnitTo || 'm';
    this.widgetProperties.config.paths['lineBiasPath'].convertUnitTo = this.widgetProperties.config.convertUnitTo || 'm';
    this.unsubscribeDataStream();
    this.dtsValue = null;
    this.lengthValue = null;
    this.biasValue = null;

    this.drawUnit();
    this.observeDataStream('dtsPath', newValue => {
      this.dtsValue = newValue.data.value;
      if (this.widgetProperties.config.ignoreZones) {
        if (!this.dtsValue) {
          this.dtsColor = this.valueColor;
        } else if (this.dtsValue < 0) {
          this.dtsColor = this.theme().zoneAlarm;
        } else if (this.dtsValue < 10) {
          this.dtsColor = this.theme().zoneWarn;
        } else if (this.dtsValue < 20) {
          this.dtsColor = this.theme().zoneAlert;
        } else {
          this.dtsColor = this.valueColor;
        }
      } else {
        switch (newValue.state) {
          case States.Alarm:
            this.dtsColor = this.theme().zoneAlarm;
            break;
          case States.Warn:
            this.dtsColor = this.theme().zoneWarn;
            break;
          case States.Alert:
            this.dtsColor = this.theme().zoneAlert;
            break;
          default:
            this.dtsColor = this.valueColor;
            break;
        }
      }
      this.updateCanvas()
    });

    this.observeDataStream('lineLengthPath', newValue => {
      this.lengthValue = newValue.data.value;
      this.updateCanvas()
    });

    this.observeDataStream('lineBiasPath', newValue => {
      this.biasValue = newValue.data.value;
      this.drawLenBias();
    });

    this.signalk.subscribeRequest().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(requestResult => {
      if (requestResult.widgetUUID === this.widgetProperties.uuid) {
        if (requestResult.statusCode === 200) {
          this.beep(600, 20)
        } else {
          this.app.sendSnackbarNotification(`Please check the Signalk-racer plugin installation/configuration. Error: ${requestResult.message}`, 0, false);
        }
      }
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
  }

  protected onResized(e: ResizeObserverEntry) {
    if ((e.contentRect.height < 25) || (e.contentRect.width < 25)) {
      return;
    }

    this.infoFontSize = Math.floor(e.contentRect.width * 0.05) + 'px';

    this.initCanvasContexts();
    if (this.isDestroyed) {
      return;
    }
    this.updateCanvas();
  }

  protected beep(frequency = 440, duration = 100) {
    if (this.widgetProperties.config.playBeeps) {
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

  private updateCanvas(): void {
    this.drawDToLine();
    this.drawLenBias();
    this.drawUnit();
  }

  private drawDToLine(): void {
    if (this.dToLineCanvas) {
      this.canvasService.clearCanvas(this.dToLineContext, this.dToLineElement.width, this.dToLineElement.height);
      const valueText = this.getValueText();
      this.canvasService.drawText(
        this.dToLineContext,
        valueText,
        Math.floor(this.dToLineElement.width / 2),
        Math.floor((this.dToLineElement.height / 2) * 1.3),
        this.maxValueTextWidth,
        this.maxValueTextHeight,
        'bold',
        this.dtsColor
      );
    }
  }

  private getValueText(): string {
    if (this.dtsValue === null) {
      return '--';
    }
    return this.dtsValue.toFixed(this.widgetProperties.config.numDecimal);
  }

  private drawUnit(): void {
    const unit = this.widgetProperties.config.paths['dtsPath'].convertUnitTo;
    this.canvasService.drawText(
      this.dToLineContext,
      unit,
      Math.floor(this.dToLineElement.width - 10 * this.canvasService.scaleFactor),
      Math.floor(this.dToLineElement.height - 7 * this.canvasService.scaleFactor),
      Math.floor(this.dToLineElement.width * 0.25),
      Math.floor(this.dToLineElement.height * 0.15),
      'bold',
      this.dtsColor,
      'end',
      'alphabetic'
    );
  }

  private drawLenBias(): void {
    if (this.widgetProperties.config.paths['lineLengthPath'].path !== '' && this.lengthValue) {
      let unit = this.widgetProperties.config.paths['lineLengthPath'].convertUnitTo;
      if (unit === 'feet')
        unit = '′';
      this.lineLengthValue.set(`―${this.applyDecorations(this.lengthValue.toFixed(this.widgetProperties.config.numDecimal))}${unit}―`);
    }
    if (this.widgetProperties.config.paths['lineBiasPath'].path !== '' && this.biasValue) {
      let unit = this.widgetProperties.config.paths['lineBiasPath'].convertUnitTo;
      if (unit === 'feet')
        unit = '′';
      if (this.biasValue < 0) {
        this.portBiasValue.set('+' + (-this.biasValue).toFixed(this.widgetProperties.config.numDecimal) + unit);
        this.stbBiasValue.set(this.biasValue.toFixed(this.widgetProperties.config.numDecimal) + unit);
      } else {
        this.portBiasValue.set(' ' + (-this.biasValue).toFixed(this.widgetProperties.config.numDecimal) + unit);
        this.stbBiasValue.set(' +' + this.biasValue.toFixed(this.widgetProperties.config.numDecimal) + unit);
      }
    }
  }

  private applyDecorations(txtValue: string): string {
    // apply decoration when required
    switch (this.widgetProperties.config.paths['dtsPath'].convertUnitTo) {
      case 'percent':
      case 'percentraw':
        txtValue += '%';
        break;
      default:
        break;
    }
    return txtValue;
  }

  public toggleMode(): void {
    this.mode = (this.mode + 1) % 4;
    this.updateCanvas();
  }

  public setLineEnd(end: string): string {
    const requestId = this.signalk.putRequest('navigation.racing.setStartLine', {end, position: 'bow'}, this.widgetProperties.uuid);
    return requestId;
  }

  public adjustLineEnd(end: string, delta: number, rotateRadians: number): string {
    const requestId = this.signalk.putRequest('navigation.racing.setStartLine',
      {end, delta, rotate: rotateRadians ? rotateRadians : null},
      this.widgetProperties.uuid);
    return requestId;
  }

  protected toRadians(degrees: number): number | null {
    return degrees ? degrees * (Math.PI / 180) : null;
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroyDataStreams();
    this.canvasService.clearCanvas(this.dToLineContext, this.dToLineElement.width, this.dToLineElement.height);
  }
}
