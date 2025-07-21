import {AfterViewInit, Component, DestroyRef, effect, ElementRef, inject, OnDestroy, OnInit, untracked, viewChild} from '@angular/core';
import {BaseWidgetComponent} from '../../core/utils/base-widget.component';
import {States} from '../../core/interfaces/signalk-interfaces';
import {WidgetHostComponent} from '../../core/components/widget-host/widget-host.component';
import {IWidgetSvcConfig} from '../../core/interfaces/widgets-interface';
import {NgxResizeObserverModule} from 'ngx-resize-observer';
import {CanvasService} from '../../core/services/canvas.service';
import {SignalkRequestsService} from '../../core/services/signalk-requests.service';
import {WidgetTitleComponent} from '../../core/components/widget-title/widget-title.component';
import {MatButton} from '@angular/material/button';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

@Component({
  selector: 'widget-racer-line',
  templateUrl: './widget-racer-line.component.html',
  styleUrls: ['./widget-racer-line.component.scss'],
  standalone: true,
  imports: [WidgetHostComponent, NgxResizeObserverModule, WidgetTitleComponent, MatButton]
})
export class WidgetRacerLineComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private signalk = inject(SignalkRequestsService);
  private dToLineCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('dToLineCanvas');
  protected dToLineContext: CanvasRenderingContext2D;
  protected dToLineElement: HTMLCanvasElement;
  private canvasService = inject(CanvasService);
  private dtsValue: number = null;
  private lengthValue: number = null;
  private biasValue: number = null;
  protected labelColor: string = undefined;
  private valueColor: string = undefined;
  private dtsColor: string = undefined;
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;

  protected errorMessage = '';
  protected lenBiasValue = '';
  protected infoFontSize = '1em';

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
        untracked(() => {
          this.getColors(this.widgetProperties.config.color);
          this.updateCanvas();
        });
      }
    });
  }

  toRadians(degrees) {
    return degrees ? degrees * (Math.PI / 180) : null;
  }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.initCanvasContexts();
    if (this.isDestroyed) {
      return;
    }
    this.startWidget();
    this.updateCanvas();
  }

  private initCanvasContexts() {
    this.dToLineElement = this.dToLineCanvas().nativeElement;
    this.canvasService.setHighDPISize(this.dToLineElement, this.dToLineElement.parentElement.getBoundingClientRect());
    this.dToLineContext = this.dToLineElement.getContext('2d');
    this.maxValueTextWidth = Math.floor(this.dToLineElement.width * 0.95);
    this.maxValueTextHeight = Math.floor(this.dToLineElement.height * 0.95);
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.dtsValue = null;
    this.lengthValue = null;
    this.biasValue = null;
    this.getColors(this.widgetProperties.config.color);
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
      this.updateCanvas();
    });

    this.observeDataStream('lineLengthPath', newValue => {
      this.lengthValue = newValue.data.value;
      this.updateCanvas();
    });

    this.observeDataStream('lineBiasPath', newValue => {
      this.biasValue = newValue.data.value;
      this.updateCanvas();
    });

    this.signalk.subscribeRequest().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(requestResult => {
      // e.g.
      // {
      //   "requestId":"c8ce9f72-5218-4e9b-88fe-4fcc1966574d",
      //   "state":"COMPLETED",
      //   "statusCode":200,
      //   "widgetUUID":"0ad57184-5030-497c-a775-b1cbe06a9d02",
      //   "message":"Put start line end: OK",
      //   "statusCodeDescription":"The request was successfully."
      // },
      // {
      //   "requestId":"fc015ba8-1e1a-45dd-a788-75107e334dcd",
      //   "state":"COMPLETED",
      //   "statusCode":405,
      //   "widgetUUID":"0ad57184-5030-497c-a775-b1cbe06a9d02",
      //   "message":"PUT not supported for navigation.racing.setStartLine",
      //   "statusCodeDescription":"The server does not support the request."
      // }

      if (requestResult.widgetUUID === this.widgetProperties.uuid) {
        console.log('RESULT RECEIVED: ', JSON.stringify(requestResult));
        if (requestResult.statusCode === 200) {
          this.beep(600, 20)
        } else {
          this.errorMessage = 'Error: ' + requestResult.message;
          this.mode = -1;
          this.beep(300, 1000);
          this.updateCanvas();
          this.app.sendSnackbarNotification('Please check the Signalk-racer plugin installation/configuration', 5000, true);
        }
      }
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.updateCanvas();
  }

  protected onResized(e: ResizeObserverEntry) {
    console.log('resize widget');
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

  private getColors(color: string): void {
    switch (color) {
      case 'contrast':
        this.labelColor = this.theme().contrastDim;
        this.valueColor = this.theme().contrast;
        break;
      case 'blue':
        this.labelColor = this.theme().blueDim;
        this.valueColor = this.theme().blue;
        break;
      case 'green':
        this.labelColor = this.theme().greenDim;
        this.valueColor = this.theme().green;
        break;
      case 'pink':
        this.labelColor = this.theme().pinkDim;
        this.valueColor = this.theme().pink;
        break;
      case 'orange':
        this.labelColor = this.theme().orangeDim;
        this.valueColor = this.theme().orange;
        break;
      case 'purple':
        this.labelColor = this.theme().purpleDim;
        this.valueColor = this.theme().purple;
        break;
      case 'grey':
        this.labelColor = this.theme().greyDim;
        this.valueColor = this.theme().grey;
        break;
      case 'yellow':
        this.labelColor = this.theme().yellowDim;
        this.valueColor = this.theme().yellow;
        break;
      default:
        this.labelColor = this.theme().contrastDim;
        this.valueColor = this.theme().contrast;
        break;
    }
    this.dtsColor = this.valueColor;
  }

  ngOnDestroy() {
    console.log('ngOnDestroy!');
    this.isDestroyed = true;
    this.destroyDataStreams();
    this.canvasService.clearCanvas(this.dToLineContext, this.dToLineElement.width, this.dToLineElement.height);
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
        Math.floor((this.dToLineElement.height / 2) * 1.15),
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
    const unit = this.widgetProperties.config.convertUnitTo;
    this.canvasService.drawText(
      this.dToLineContext,
      unit,
      Math.floor(this.dToLineElement.width - 10 * this.canvasService.scaleFactor),
      Math.floor(this.dToLineElement.height - 10 * this.canvasService.scaleFactor),
      Math.floor(this.dToLineElement.width * 0.25),
      Math.floor(this.dToLineElement.height * 0.15),
      'bold',
      this.dtsColor,
      'end',
      'alphabetic'
    );
  }

  private drawLenBias(): void {
    let valueText = '';

    if (this.widgetProperties.config.paths['lineLengthPath'].path !== '') {
      const unit = this.widgetProperties.config.paths['lineLengthPath'].convertUnitTo;
      valueText += this.lengthValue != null
        ? `Line: ${this.applyDecorations(this.lengthValue.toFixed(this.widgetProperties.config.numDecimal))}${unit}`
        : 'Line: --';
      valueText += '  ';
    }

    if (this.widgetProperties.config.paths['lineBiasPath'].path !== '') {
      valueText += ' Bias: ';
      const unit = this.widgetProperties.config.paths['lineBiasPath'].convertUnitTo;
      if (this.biasValue == null) {
        valueText += '--';
      } else if (this.biasValue < -1) {
        valueText += (-this.biasValue).toFixed(this.widgetProperties.config.numDecimal) + unit + ' P';
      } else if (this.biasValue > 1) {
        valueText += this.biasValue.toFixed(this.widgetProperties.config.numDecimal) + unit + ' S';
      } else {
        valueText += 'fair';
      }
    }

    this.lenBiasValue = valueText;
  }

  private applyDecorations(txtValue: string): string {
    // apply decoration when required
    switch (this.widgetProperties.config.convertUnitTo) {
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
    console.log('toggle mode ', this.mode);
    this.errorMessage = '';
    this.mode = (this.mode + 1) % 4;
    this.updateCanvas();
  }

  public setLineEnd(end: string): string {
    const requestId = this.signalk.putRequest('navigation.racing.setStartLine', {end, position: 'bow'}, this.widgetProperties.uuid);
    console.log('Set line end ', end, ' ', requestId);
    return requestId;
  }

  public adjustLineEnd(end: string, delta: number, rotateRadians: number): string {
    const requestId = this.signalk.putRequest('navigation.racing.setStartLine',
      {end, delta, rotate: rotateRadians ? rotateRadians : null},
      this.widgetProperties.uuid);
    console.log('adjustLineEnd: delta ', delta, ' rotate ', rotateRadians, ' ', requestId);
    return requestId;
  }
}
