import { Component, OnInit, OnDestroy, AfterContentInit, ChangeDetectorRef, inject } from '@angular/core';
import { CanvasService } from '../../core/services/canvas.service';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let steelseries: any; // 3rd party global

// Provide minimal mock for unit tests when external script not loaded.
if (typeof steelseries === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).steelseries = {};
}
// Augment missing collections (idempotent) with minimal placeholders.
const ss = (globalThis as unknown as { steelseries: Record<string, unknown> }).steelseries as Record<string, unknown> & { ColorDef?: unknown; FrameDesign?: unknown };
// dynamic augmentation for test shim
(ss as Record<string, unknown>)['ColorDef'] = (ss as Record<string, unknown>)['ColorDef'] || {
  RED: 'red', GREEN: 'green', BLUE: 'blue', ORANGE: 'orange', YELLOW: 'yellow', CYAN: 'cyan', MAGENTA: 'magenta',
  WHITE: 'white', GRAY: 'gray', BLACK: 'black', RAITH: 'raith', GREEN_LCD: 'greenLcd', JUG_GREEN: 'jugGreen'
};
// dynamic augmentation for test shim
(ss as Record<string, unknown>)['FrameDesign'] = (ss as Record<string, unknown>)['FrameDesign'] || {
  BLACK_METAL: 'blackMetal', METAL: 'metal', SHINY_METAL: 'shinyMetal', BRASS: 'brass', STEEL: 'steel', CHROME: 'chrome',
  GOLD: 'gold', ANTHRACITE: 'anthracite', TILTED_GRAY: 'tiltedGray', TILTED_BLACK: 'tiltedBlack', GLOSSY_METAL: 'glossyMetal'
};

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

@Component({
  selector: 'widget-horizon',
  templateUrl: './widget-horizon.component.html',
  styleUrls: ['./widget-horizon.component.scss'],
  standalone: true,
  imports: [WidgetHostComponent, NgxResizeObserverModule]
})
export class WidgetHorizonComponent extends BaseWidgetComponent implements OnInit, AfterContentInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private readonly canvasService = inject(CanvasService);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected gaugeOptions: any = {};
  private gauge = null;
  private streamsInitialized = false;
  private lastSizeSignature = '';
  private resizeTimer: number | null = null;
  private pendingStructuralRebuild = false;

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
          pathRequired: false,
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          sampleTime: 1000
        },
        "gaugeRollPath": {
          description: "Attitude Roll Data",
          path: "self.navigation.attitude.roll",
          source: "default",
          pathType: 'number',
          pathRequired: false,
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          sampleTime: 1000
        }
      },
      gauge: {
        type: 'horizon',
        noFrameVisible: false,
        faceColor: 'anthracite',
        invertPitch: false,
        invertRoll: false
      },
      enableTimeout: false,
      dataTimeout: 5,
    };
  }

  ngOnInit() {
    this.validateConfig();
  }

  ngAfterContentInit(): void {
    this.cdr.detectChanges(); // Force DOM update
    this.startWidget();
    // Perform an initial resize to avoid first-draw jump
    const canvas = document.getElementById(this.widgetProperties.uuid + '-canvas') as HTMLCanvasElement | null;
    const container = canvas?.parentElement as HTMLElement | null;
    if (container) {
      const rect = container.getBoundingClientRect();
      this.onResized({ contentRect: { width: rect.width, height: rect.height } } as unknown as ResizeObserverEntry);
    }
  }

  protected startWidget(forceRebuild = false): void {
    this.buildOptions();
    const id = this.widgetProperties.uuid + '-canvas';
    if (!id) return;

    if (this.gauge && !forceRebuild && !this.pendingStructuralRebuild) {
      // mutable-only update path (no direct setters beyond pitch/roll used later)
    } else {
      this.pendingStructuralRebuild = false;
      this.gauge = new steelseries.Horizon(id, this.gaugeOptions);
    }

    if (!this.streamsInitialized) {
      this.observeDataStream('gaugePitchPath', newValue => {
        const v = newValue.data.value ?? 0;
        this.gauge.setPitchAnimated(this.widgetProperties.config.gauge.invertPitch ? -v : v);
      });

      this.observeDataStream('gaugeRollPath', newValue => {
        const v = newValue.data.value ?? 0;
        this.gauge.setRollAnimated(this.widgetProperties.config.gauge.invertRoll ? -v : v);
      });

      this.streamsInitialized = true;
    }
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.pendingStructuralRebuild = true; // horizon face/frame toggles etc.
    this.startWidget(true);
  }

  private buildOptions() {
    this.gaugeOptions['pointerColor'] = SteelPointerColors.Red;
    this.gaugeOptions['frameVisible'] = this.widgetProperties.config.gauge.noFrameVisible ?? false;
    this.gaugeOptions['frameDesign'] = SteelFrameDesign[this.widgetProperties.config.gauge.faceColor ?? 'anthracite'];
    this.gaugeOptions['foregroundVisible'] = false;
  }

  onResized(event: ResizeObserverEntry) {
    if (event.contentRect.height < 50 || event.contentRect.width < 50) return;
    const size = Math.min(event.contentRect.height, event.contentRect.width);
    const signature = 'horizon:' + size;
    if (signature === this.lastSizeSignature) return;
    this.lastSizeSignature = signature;
    this.gaugeOptions['size'] = size;
    if (this.resizeTimer) window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      this.startWidget(true);
      this.resizeTimer = null;
    }, 120);
  }

  ngOnDestroy() {
    this.destroyDataStreams();
    if (this.gauge) {
      this.gauge = null;
    }
    // Release horizon canvas
    const canvas = document.getElementById(this.widgetProperties.uuid + '-canvas') as HTMLCanvasElement | null;
    this.canvasService.releaseCanvas(canvas, { clear: true, removeFromDom: true });
  }
}
