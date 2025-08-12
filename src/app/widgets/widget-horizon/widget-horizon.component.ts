import { Component, OnInit, OnDestroy, AfterContentInit, signal, ChangeDetectorRef, inject } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { debounce } from 'lodash';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

declare let steelseries: any; // 3rd party

export const SteelPointerColors = {
  'Red': steelseries.ColorDef.RED,
  'Green': steelseries.ColorDef.GREEN,
  'Blue': steelseries.ColorDef.BLUE,
  'Orange': steelseries.ColorDef.ORANGE,
  'Yellow': steelseries.ColorDef.YELLOW,
  'Cyan': steelseries.ColorDef.CYAN,
  'Magenta': steelseries.ColorDef.MAGENTA,
  'White': steelseries.ColorDef.WHITE,
  'Gray': steelseries.ColorDef.GRAY,
  'Black': steelseries.ColorDef.BLACK,
  'Raith': steelseries.ColorDef.RAITH,
  'Green LCD': steelseries.ColorDef.GREEN_LCD,
  'JUG Green': steelseries.ColorDef.JUG_GREEN
}

export const SteelFrameDesign = {
  'blackMetal': steelseries.FrameDesign.BLACK_METAL,
  'metal': steelseries.FrameDesign.METAL,
  'shinyMetal': steelseries.FrameDesign.SHINY_METAL,
  'brass': steelseries.FrameDesign.BRASS,
  'steel': steelseries.FrameDesign.STEEL,
  'chrome': steelseries.FrameDesign.CHROME,
  'gold': steelseries.FrameDesign.GOLD,
  'anthracite': steelseries.FrameDesign.ANTHRACITE,
  'tiltedGray': steelseries.FrameDesign.TILTED_GRAY,
  'tiltedBlack': steelseries.FrameDesign.TILTED_BLACK,
  'glossyMetal': steelseries.FrameDesign.GLOSSY_METAL
}

interface AttitudeData {
  roll: number;
  pitch: number;
  yaw: number;
}

@Component({
    selector: 'widget-horizon',
    templateUrl: './widget-horizon.component.html',
    styleUrls: ['./widget-horizon.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent, NgxResizeObserverModule]
})
export class WidgetHorizonComponent extends BaseWidgetComponent implements OnInit, AfterContentInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private gaugeOptions: any = {};
  private gauge = null;

  constructor() {
    super();

    this.defaultConfig = {
      filterSelfPaths: true,
      paths: {
        "gaugePitchPath": {
          description: "Attitude Pitch Data",
          path: "self.navigation.attitude.pitch",
          source: "default",
          pathType: 'number',
          isPathConfigurable: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          sampleTime: 500
        },
        "gaugeRollPath": {
          description: "Attitude Roll Data",
          path: "self.navigation.attitude.roll",
          source: "default",
          pathType: 'number',
          isPathConfigurable: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          sampleTime: 500
        }
      },
      gauge: {
        type: 'horizon',
        faceColor: 'Red'
      },
      enableTimeout: false,
      dataTimeout: 5,
    };

    // Debounce the onResized method
  this.onResized = debounce(this.onResized.bind(this), 200);
  }

  ngOnInit() {
    this.validateConfig();
  }

  ngAfterContentInit(): void {
    this.cdr.detectChanges(); // Force DOM update
    // this.startWidget();
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.buildOptions();
    if (this.gauge) {
      this.gauge = null;
    }
    this.gauge = new steelseries.Horizon(this.widgetProperties.uuid, this.gaugeOptions);

    this.observeDataStream('gaugePitchPath', newValue => {
      if (newValue.data.value == null) {
        this.gauge.setPitchAnimated(0);
      } else {
        this.gauge.setPitchAnimated(newValue.data.value);
      }
    });

    this.observeDataStream('gaugeRollPath', newValue => {
      if (newValue.data.value == null) {
        this.gauge.setRollAnimated(0);
      } else {
        this.gauge.setRollAnimated(newValue.data.value);
      }
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
  }

  ngOnDestroy() {
    this.destroyDataStreams();
    if (this.gauge) {
      this.gauge = null;
    }
  }

  private buildOptions() {
    this.gaugeOptions['pointerColor'] = SteelPointerColors[this.widgetProperties.config.gauge.faceColor];
    this.gaugeOptions['frameVisible'] = false;
    this.gaugeOptions['foregroundVisible'] = false
  }

  onResized(event: ResizeObserverEntry) {
    // Check if the size is too small to avoid rendering issues
    if (event.contentRect.height < 50 || event.contentRect.width < 50) {
      return;
    }
    const size = Math.min(event.contentRect.height, event.contentRect.width);
    this.gaugeOptions['size'] = size;
    this.startWidget();
  }
}
