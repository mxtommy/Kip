import {AfterViewInit, Component, effect, ElementRef, inject, OnDestroy, OnInit, viewChild} from '@angular/core';
import {BaseWidgetComponent} from '../../core/utils/base-widget.component';
import {States} from '../../core/interfaces/signalk-interfaces';
import {WidgetHostComponent} from '../../core/components/widget-host/widget-host.component';
import {IWidgetSvcConfig} from '../../core/interfaces/widgets-interface';
import {NgxResizeObserverModule} from 'ngx-resize-observer';
import {CanvasService} from '../../core/services/canvas.service';
import {SignalkRequestsService} from '../../core/services/signalk-requests.service';
import {WidgetTitleComponent} from '../../core/components/widget-title/widget-title.component';
import {MatButton} from '@angular/material/button';
import {Subscription} from 'rxjs';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'widget-racer-timer',
  templateUrl: './widget-racer-timer.component.html',
  styleUrls: ['./widget-racer-timer.component.scss'],
  standalone: true,
  imports: [WidgetHostComponent, NgxResizeObserverModule, WidgetTitleComponent, MatButton, FormsModule]
})
export class WidgetRacerTimerComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private signalk = inject(SignalkRequestsService);
  private widgetCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('widgetCanvas');
  private canvas = inject(CanvasService);
  private ttsValue: number = null;
  private lengthValue: number = null;
  private biasValue: number = null;
  protected labelColor: string = undefined;
  private valueColor: string = undefined;
  private valueStateColor: string = undefined;
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;
  private maxMinMaxTextWidth = 0;
  private maxMinMaxTextHeight = 0;

  private flashInterval = null;
  private isDestroyed = false; // guard against callbacks after destroyed
  protected mode = 0;

  protected canvasCtx: CanvasRenderingContext2D;
  private skRequestSubscription: Subscription;
  protected startAtTime = 'HH:MM:SS';

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'TTS',
      filterSelfPaths: true,
      paths: {
        'ttsPath': {
          description: 'Time to Start path',
          path: 'self.navigation.racing.timeToStart',
          source: 'default',
          pathType: 'number',
          isPathConfigurable: true,
          convertUnitTo: 's',
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 500
        },
        'startTimePath': {
          description: 'Time of the start',
          path: 'self.navigation.racing.startTime',
          source: 'default',
          pathType: 'string',
          isPathConfigurable: true,
          convertUnitTo: 'unitless',
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 1000
        },
      },
      numDecimal: 0,
      color: 'contrast',
      enableTimeout: false,
      dataTimeout: 5,
      ignoreZones: false
    };

    effect(() => {
      if (this.theme()) {
        this.getColors(this.widgetProperties.config.color);
        this.updateCanvas();
      }
    });
  }

  heightAdjust(height: number): number {
    return height;
  }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    const canvasElement = this.widgetCanvas().nativeElement;
    this.canvas.setHighDPISize(this.widgetCanvas().nativeElement, canvasElement.parentElement.getBoundingClientRect());
    this.canvasCtx = this.widgetCanvas().nativeElement.getContext('2d');

    this.maxValueTextWidth = Math.floor(this.widgetCanvas().nativeElement.width * 0.85);
    this.maxValueTextHeight = Math.floor(this.heightAdjust(this.widgetCanvas().nativeElement.height) * 0.70);
    this.maxMinMaxTextWidth = Math.floor(this.widgetCanvas().nativeElement.width * 0.57);
    this.maxMinMaxTextHeight = Math.floor(this.heightAdjust(this.widgetCanvas().nativeElement.height) * 0.1);
    if (this.isDestroyed) {
      return;
    }
    this.startWidget();
    this.updateCanvas();
    console.log('ngAfterViewInit!');
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.ttsValue = null;
    this.lengthValue = null;
    this.biasValue = null;
    this.getColors(this.widgetProperties.config.color);
    this.observeDataStream('ttsPath', newValue => {
      this.ttsValue = newValue.data.value;
      if (!this.widgetProperties.config.ignoreZones) {
        switch (newValue.state) {
          case States.Alarm:
            this.valueStateColor = this.theme().zoneAlarm;
            break;
          case States.Warn:
            this.valueStateColor = this.theme().zoneWarn;
            break;
          case States.Alert:
            this.valueStateColor = this.theme().zoneAlert;
            break;
          default:
            this.valueStateColor = this.valueColor;
            break;
        }
      }
      this.updateCanvas();
    });

    this.observeDataStream('startTimePath', newValue => {
      if (!newValue.data.value) {
        this.startAtTime = 'HH:MM:SS';
      } else {
        const isoTime = new Date(newValue.data.value);
        this.startAtTime = isoTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
      this.updateCanvas();
    });

    this.skRequestSubscription = this.signalk.subscribeRequest().subscribe(requestResult => {
      if (requestResult.widgetUUID === this.widgetProperties.uuid) {
        console.log('RESULT RECEIVED: ', JSON.stringify(requestResult));
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

    this.canvas.setHighDPISize(this.widgetCanvas().nativeElement, e.contentRect);

    this.maxValueTextWidth = Math.floor(this.widgetCanvas().nativeElement.width * 0.85);
    this.maxValueTextHeight = Math.floor(this.heightAdjust(this.widgetCanvas().nativeElement.height) * 0.70);
    this.maxMinMaxTextWidth = Math.floor(this.widgetCanvas().nativeElement.width * 0.57);
    this.maxMinMaxTextHeight = Math.floor(this.heightAdjust(this.widgetCanvas().nativeElement.height) * 0.1);

    if (this.isDestroyed) {
      return;
    }
    this.updateCanvas();
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
    this.valueStateColor = this.valueColor;
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroyDataStreams();
    if (this.flashInterval) {
      clearInterval(this.flashInterval);
      this.flashInterval = null;
    }
    this.canvas.clearCanvas(this.canvasCtx,
      this.widgetCanvas().nativeElement.width,
      this.heightAdjust(this.widgetCanvas().nativeElement.height));

    if (this.skRequestSubscription !== null) {
      this.skRequestSubscription.unsubscribe();
      this.skRequestSubscription = null;
    }
  }

  private updateCanvas(): void {
    if (this.canvasCtx) {
      this.canvas.clearCanvas(this.canvasCtx,
        this.widgetCanvas().nativeElement.width,
        this.heightAdjust(this.widgetCanvas().nativeElement.height));
      this.drawValue();
      this.drawStartAt();
    }
  }

  private drawValue(): void {
    const valueText = this.getValueText();
    this.canvas.drawText(
      this.canvasCtx,
      valueText,
      Math.floor(this.widgetCanvas().nativeElement.width / 2),
      Math.floor((this.heightAdjust(this.widgetCanvas().nativeElement.height) / 2) * 1.15),
      this.maxValueTextWidth,
      this.maxValueTextHeight,
      'bold',
      this.valueStateColor
    );
  }

  private getValueText(): string {
    if (this.ttsValue === null) {
      return '--';
    }

    const seconds = this.ttsValue;
    const minutes = Math.floor(seconds / 60);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mm = Math.floor(minutes % 60);
      const ss = Math.floor(seconds % 60);
      return `${hours.toString()}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    } else {
      const mm = Math.floor(minutes % 60);
      const ss = Math.floor(seconds % 60);
      return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    }
  }

  private drawStartAt(): void {
    const valueText = this.startAtTime != null
      ? ` Start at: ${this.startAtTime}`
      : ' Start at: HH:MM:SS';

    this.canvas.drawText(
      this.canvasCtx,
      valueText,
      10 * this.canvas.scaleFactor,
      Math.floor(this.heightAdjust(this.widgetCanvas().nativeElement.height) - 10 * this.canvas.scaleFactor),
      this.maxMinMaxTextWidth,
      this.maxMinMaxTextHeight,
      'normal',
      this.valueColor,
      'start',
      'alphabetic'
    );
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

  toggleMode() {
    console.log('toggle mode ', this.mode);
    this.mode = (this.mode + 1) % 4;
    switch (this.mode) {
      case 0:
        if (this.startAtTime !== null && this.startAtTime !== 'HH:MM:SS') {
          this.mode = 1;
        }
        break;
      case 1:
        if (!this.startAtTime || this.startAtTime === 'HH:MM:SS') {
          this.mode = 2;
        }
        break;
      default:
    }
    this.updateCanvas();
  }

  sendStartTimerCommand(command) {
    const requestId = this.signalk.putRequest('navigation.racing.setStartTime', {command}, this.widgetProperties.uuid);
    console.log('Start Timer Command ', command, ' ', requestId);
    switch (command) {
      case 'start':
        this.mode = 1;
        this.updateCanvas();
        break;
      case 'reset':
        this.mode = 0;
        this.startAtTime = 'HH:MM:SS';
        this.updateCanvas();
        break;
      default:
    }
    return requestId;
  }

  adjustStartTime(delta: number) {
    const requestId = this.signalk.putRequest('navigation.racing.setStartTime', {command: 'adjust', delta}, this.widgetProperties.uuid);
    console.log('Adjust Timer: delta=', delta, ' ', requestId);
    return requestId;
  }

  setStartTime(startAtTime: string) {
    const now = new Date();
    const [hours, minutes, seconds] = startAtTime.split(':').map(Number);

    const date = new Date(now); // clone the current date
    date.setHours(hours, minutes, seconds, 0);

    // If the scheduled time is in the past, move it to the next day
    if (date <= now) {
      date.setDate(date.getDate() + 1);
    }

    const requestId = this.signalk.putRequest(
      'navigation.racing.setStartTime',
      { command: 'set', startTime: date.toISOString() },
      this.widgetProperties.uuid
    );

    console.log('Set Timer: startAtTime=', startAtTime, ' →', date.toISOString(), 'requestId=', requestId);
  }
}
