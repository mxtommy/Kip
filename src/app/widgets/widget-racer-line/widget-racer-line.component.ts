import {AfterViewInit, Component, effect, ElementRef, inject, OnDestroy, OnInit, viewChild} from '@angular/core';
import {BaseWidgetComponent} from '../../core/utils/base-widget.component';
import {States} from '../../core/interfaces/signalk-interfaces';
import {WidgetHostComponent} from '../../core/components/widget-host/widget-host.component';
import {IWidgetSvcConfig} from '../../core/interfaces/widgets-interface';
import {NgxResizeObserverModule} from 'ngx-resize-observer';
import {CanvasService} from '../../core/services/canvas.service';
import {SignalKDeltaService} from '../../core/services/signalk-delta.service';
import {WidgetTitleComponent} from '../../core/components/widget-title/widget-title.component';
import {MatButton} from '@angular/material/button';
import {UUID} from '../../core/utils/uuid';

@Component({
    selector: 'widget-racer-line',
    templateUrl: './widget-racer-line.component.html',
    styleUrls: ['./widget-racer-line.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent, NgxResizeObserverModule, WidgetTitleComponent, MatButton]
})
export class WidgetRacerLineComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private signalKDeltaService = inject(SignalKDeltaService);
  private widgetCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('widgetCanvas');
  private canvas = inject(CanvasService);
  private dtsValue: number = null;
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

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'DTS',
      filterSelfPaths: true,
      paths: {
        'dtsPath': {
          description: 'Distance to Start Line path',
          path: 'self.navigation.racing.distanceStartline',
          source: 'default',
          pathType: 'number',
          isPathConfigurable: true,
          convertUnitTo: 'm',
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 500
        },
        'lineLengthPath': {
          description: 'Length of the start line',
          path: 'self.navigation.racing.startLineLength',
          source: 'default',
          pathType: 'number',
          isPathConfigurable: true,
          convertUnitTo: 'm',
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 1000
        },
        'lineBiasPath': {
          description: 'Bias of the start line to starboard end',
          path: 'self.navigation.racing.stbLineBias',
          source: 'default',
          pathType: 'number',
          isPathConfigurable: true,
          convertUnitTo: 'm',
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 1000
        }
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

  toRadians(degrees) {
    return degrees ? degrees * (Math.PI / 180) : null;
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
    if (this.isDestroyed) { return; }
    this.startWidget();
    this.updateCanvas();
    console.log('ngAfterViewInit!');
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.dtsValue = null;
    this.lengthValue = null;
    this.biasValue = null;
    this.getColors(this.widgetProperties.config.color);
    this.observeDataStream('dtsPath', newValue => {
      this.dtsValue = newValue.data.value;
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

    this.observeDataStream('lineLengthPath', newValue => {
      this.lengthValue = newValue.data.value;
      this.updateCanvas();
    });

    this.observeDataStream('lineBiasPath', newValue => {
      this.biasValue = newValue.data.value;
      this.updateCanvas();
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.updateCanvas();
  }

  protected onResized(e: ResizeObserverEntry) {
    console.log('resize widget');
    if ((e.contentRect.height < 25) || (e.contentRect.width < 25)) { return; }

    this.canvas.setHighDPISize(this.widgetCanvas().nativeElement, e.contentRect);

    this.maxValueTextWidth = Math.floor(this.widgetCanvas().nativeElement.width * 0.85);
    this.maxValueTextHeight = Math.floor(this.heightAdjust(this.widgetCanvas().nativeElement.height) * 0.70);
    this.maxMinMaxTextWidth = Math.floor(this.widgetCanvas().nativeElement.width * 0.57);
    this.maxMinMaxTextHeight = Math.floor(this.heightAdjust(this.widgetCanvas().nativeElement.height) * 0.1);

    if (this.isDestroyed) { return; }
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
  }

private updateCanvas(): void {
    if (this.canvasCtx) {
      this.canvas.clearCanvas(this.canvasCtx,
        this.widgetCanvas().nativeElement.width,
        this.heightAdjust(this.widgetCanvas().nativeElement.height));
      this.drawValue();
      this.drawLengthBias();
      this.drawUnit();
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
    if (this.dtsValue === null) {
        return '--';
    }

    return this.dtsValue.toFixed(this.widgetProperties.config.numDecimal);
  }

  private drawUnit(): void {
    const unit = this.widgetProperties.config.paths['dtsPath'].convertUnitTo;
    if (['unitless', 'percent', 'ratio', 'latitudeSec', 'latitudeMin', 'longitudeSec', 'longitudeMin'].includes(unit)) { return; }

    this.canvas.drawText(
      this.canvasCtx,
      unit,
      Math.floor(this.widgetCanvas().nativeElement.width - 10 * this.canvas.scaleFactor),
      Math.floor(this.heightAdjust(this.widgetCanvas().nativeElement.height) - 10 * this.canvas.scaleFactor),
      Math.floor(this.widgetCanvas().nativeElement.width * 0.25),
      Math.floor(this.heightAdjust(this.widgetCanvas().nativeElement.height) * 0.15),
      'bold',
      this.valueColor,
      'end',
      'alphabetic'
    );
  }

  private drawLengthBias(): void {
    let unit = this.widgetProperties.config.paths['lineLengthPath'].convertUnitTo;
    let valueText = this.lengthValue != null
      ? ` Length: ${this.applyDecorations(this.lengthValue.toFixed(this.widgetProperties.config.numDecimal))}${unit}`
      : ' Length: --';

    valueText += '  Bias:';
    unit = this.widgetProperties.config.paths['lineLengthPath'].convertUnitTo;
    if (this.biasValue == null) {
      valueText += '--';
    } else if (this.biasValue < -1) {
      valueText += (-this.biasValue).toFixed(this.widgetProperties.config.numDecimal) + unit + ' port';
    } else if (this.biasValue > 1) {
      valueText += this.biasValue.toFixed(this.widgetProperties.config.numDecimal) + unit + ' stbd';
    } else {
      valueText += 'fair';
    }

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
    this.mode = (this.mode + 1) % 3;
    this.updateCanvas();
  }

  setLineEnd(end) {
    console.log('Set line end ', end);
    const requestId = UUID.create();
    const message = {
      context: 'vessels.self',
      requestId: requestId,
      put: {
        path: 'navigation.racing.setStartLine',
        value: { end, position : 'bow'}
      }
    };
    this.signalKDeltaService.publishDelta(message);
    return requestId;
  }

  adjustLineEnd(end: string, delta: number, rotate) {
    console.log('adjustLineEnd: delta ', delta, ' rotate ', rotate);
    const requestId = UUID.create();
    const message = {
      context: 'vessels.self',
      requestId: requestId,
      put: {
        path: 'navigation.racing.setStartLine',
        value: { end, delta, rotate : rotate ? this.toRadians(rotate) : null }
      }
    };
    this.signalKDeltaService.publishDelta(message);
    return requestId;
  }
}
