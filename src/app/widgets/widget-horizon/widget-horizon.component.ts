import { Component, OnDestroy, AfterViewInit, inject, effect, viewChild, ElementRef, input, untracked, NgZone } from '@angular/core';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { ITheme } from '../../core/services/app-service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let steelseries: any; // 3rd party global (loaded via scripts bundle)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSteelPointerColors(ss: any) {
  return {
    'Red': ss.ColorDef.RED,
    'Green': ss.ColorDef.GREEN,
    'Blue': ss.ColorDef.BLUE,
    'Orange': ss.ColorDef.ORANGE,
    'Yellow': ss.ColorDef.YELLOW,
    'Cyan': ss.ColorDef.CYAN,
    'Magenta': ss.ColorDef.MAGENTA,
    'White': ss.ColorDef.WHITE,
    'Gray': ss.ColorDef.GRAY,
    'Black': ss.ColorDef.BLACK,
    'Raith': ss.ColorDef.RAITH,
    'Green LCD': ss.ColorDef.GREEN_LCD,
    'JUG Green': ss.ColorDef.JUG_GREEN
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSteelFrameDesign(ss: any) {
  return {
    'blackMetal': ss.FrameDesign.BLACK_METAL,
    'metal': ss.FrameDesign.METAL,
    'shinyMetal': ss.FrameDesign.SHINY_METAL,
    'brass': ss.FrameDesign.BRASS,
    'steel': ss.FrameDesign.STEEL,
    'chrome': ss.FrameDesign.CHROME,
    'gold': ss.FrameDesign.GOLD,
    'anthracite': ss.FrameDesign.ANTHRACITE,
    'tiltedGray': ss.FrameDesign.TILTED_GRAY,
    'tiltedBlack': ss.FrameDesign.TILTED_BLACK,
    'glossyMetal': ss.FrameDesign.GLOSSY_METAL
  };
}

@Component({
  selector: 'widget-horizon',
  templateUrl: './widget-horizon.component.html',
  styleUrls: ['./widget-horizon.component.scss'],
})
export class WidgetHorizonComponent implements AfterViewInit, OnDestroy {
  // Functional inputs (Host2)
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Directives/services
  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);

  // Static default config (legacy parity + displayName)
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Horizon',
    filterSelfPaths: true,
    paths: {
      gaugePitchPath: {
        description: 'Attitude Pitch Data',
        path: 'self.navigation.attitude.pitch',
        source: 'default',
        pathType: 'number',
        pathRequired: false,
        isPathConfigurable: true,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad',
        convertUnitTo: 'deg',
        sampleTime: 1000
      },
      gaugeRollPath: {
        description: 'Attitude Roll Data',
        path: 'self.navigation.attitude.roll',
        source: 'default',
        pathType: 'number',
        pathRequired: false,
        isPathConfigurable: true,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad',
        convertUnitTo: 'deg',
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
    dataTimeout: 5
  };

  // View / layout
  private wrapperRef = viewChild<ElementRef<HTMLDivElement>>('hWrapper');
  private resizeObserver: ResizeObserver | null = null;
  private currentSize = 0; // last applied square size (updated ONLY by ResizeObserver)
  private structuralKey = ''; // frame visibility + face color (config structural aspects)
  // Resize stabilization fields
  private pendingSize: number | null = null;
  private sizeCommitTimer: number | null = null;
  private readonly SIZE_STABLE_MS = 180; // quiet window before rebuilding gauge
  private readonly ngZone = inject(NgZone);

  // Gauge internals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected gaugeOptions: any = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private gauge: any = null;
  // Structural options cache key removed – always rebuild on size / config change for simplicity
  private latestPitch = 0;
  private latestRoll = 0;

  constructor() {
    // Observe pitch path
    effect(() => {
      const cfg = this.runtime.options(); if (!cfg) return;
      const pitchCfg = cfg.paths?.['gaugePitchPath'];
      if (!pitchCfg?.path) return;
      untracked(() => this.streams.observe('gaugePitchPath', pkt => {
        const v = (pkt?.data?.value as number) ?? 0;
        this.latestPitch = v;
        if (this.gauge) {
          const inv = cfg.gauge?.invertPitch ? -v : v;
          try { this.gauge.setPitchAnimated(inv); } catch { /* ignore */ }
        }
      }));
    });

    // Observe roll path
    effect(() => {
      const cfg = this.runtime.options(); if (!cfg) return;
      const rollCfg = cfg.paths?.['gaugeRollPath'];
      if (!rollCfg?.path) return;
      untracked(() => this.streams.observe('gaugeRollPath', pkt => {
        const v = (pkt?.data?.value as number) ?? 0;
        this.latestRoll = v;
        if (this.gauge) {
          const inv = cfg.gauge?.invertRoll ? -v : v;
          try { this.gauge.setRollAnimated(inv); } catch { /* ignore */ }
        }
      }));
    });

    // Config structural effect (independent from size changes)
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const newKey = `${cfg.gauge?.noFrameVisible ?? false}|${cfg.gauge?.faceColor ?? 'anthracite'}`;
      if (newKey === this.structuralKey) {
        // Only inversion flags may have changed; apply directly without rebuild
        this.applyInversions(cfg);
        return;
      }
      this.structuralKey = newKey;
      if (this.currentSize >= 50) {
        this.buildOptions(cfg, this.currentSize);
        this.rebuildGauge();
      }
      // If size not yet known, first ResizeObserver pass will build with current config
    });
  }

  ngAfterViewInit(): void {
    const wrapperEl = this.wrapperRef()?.nativeElement;
    if (!wrapperEl) return;

    const commitSize = () => {
      if (this.pendingSize == null) return;
      if (this.pendingSize === this.currentSize) return; // nothing to do
      if (this.pendingSize < 50) return;
      const size = this.pendingSize;
      const cfg = this.runtime.options();
      if (!cfg) {
        // Config still not ready; keep pending and try again on next size/config change
        return;
      }
      this.currentSize = size;
      const canvasEl = document.getElementById(this.id() + '-canvas') as HTMLCanvasElement | null;
      if (canvasEl) {
        if (canvasEl.width !== size || canvasEl.height !== size) {
          canvasEl.width = size;
          canvasEl.height = size;
        }
        canvasEl.style.width = size + 'px';
        canvasEl.style.height = size + 'px';
      }
      this.buildOptions(cfg, size);
      this.rebuildGauge();
      this.pendingSize = null; // clear pending after successful commit
    };

    const scheduleCommit = () => {
      if (this.sizeCommitTimer) clearTimeout(this.sizeCommitTimer);
      this.sizeCommitTimer = window.setTimeout(() => {
        commitSize();
        this.sizeCommitTimer = null;
      }, this.SIZE_STABLE_MS);
    };

    const handleResize = () => {
      const rect = wrapperEl.getBoundingClientRect();
      const candidate = Math.round(Math.min(rect.width, rect.height));
      const ref = this.pendingSize ?? this.currentSize;
      if (!candidate || candidate < 50) return;
      if (ref && Math.abs(ref - candidate) < 4) {
        // jitter - ignore but still keep timer running
        return;
      }

      // First ever measurement -> immediate commit (fast initial paint)
      if (this.currentSize === 0 && this.pendingSize === null) {
        this.pendingSize = candidate;
        commitSize();
        return;
      }

      // Store candidate, live CSS adjust (without intrinsic pixel change to avoid blurs), then debounce
      this.pendingSize = candidate;
      const canvasEl = document.getElementById(this.id() + '-canvas') as HTMLCanvasElement | null;
      if (canvasEl) {
        canvasEl.style.width = candidate + 'px';
        canvasEl.style.height = candidate + 'px';
      }
      scheduleCommit();
    };

    // Run the observer and timers outside Angular to avoid change detection storms
    this.ngZone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => handleResize());
      this.resizeObserver.observe(wrapperEl);
      handleResize();
    });
  }

  private buildOptions(cfg: IWidgetSvcConfig, size: number): void {
    if (typeof steelseries === 'undefined') return;
    const frameMap = getSteelFrameDesign(steelseries);
    const pointerMap = getSteelPointerColors(steelseries);
    this.gaugeOptions = {
      pointerColor: pointerMap.Red,
      frameVisible: !(cfg.gauge?.noFrameVisible ?? false),
      frameDesign: frameMap[cfg.gauge?.faceColor ?? 'anthracite'],
      foregroundVisible: false,
      size
    };
  }

  private rebuildGauge(): void {
    const canvasId = this.id() + '-canvas';
    // Release old gauge reference; clear canvas explicitly to prevent layered visuals
    if (this.gauge) {
      try { this.gauge = null; } catch { /* ignore */ }
    }
    const existingCanvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (existingCanvas) {
      // Safety: ensure intrinsic size still matches currentSize before clearing
      if (this.currentSize && (existingCanvas.width !== this.currentSize || existingCanvas.height !== this.currentSize)) {
        existingCanvas.width = this.currentSize;
        existingCanvas.height = this.currentSize;
      }
      const ctx = existingCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, existingCanvas.width, existingCanvas.height);
    }
    // No live scale to clear in simplified mode
    try {
      this.gauge = new steelseries.Horizon(canvasId, this.gaugeOptions);
      // Apply last known values
      const cfg = this.runtime.options();
      if (cfg && this.gauge) {
        this.applyInversions(cfg);
      }
    } catch {/** ignore */ }
  }

  private applyInversions(cfg: IWidgetSvcConfig): void {
    if (!this.gauge) return;
    try { this.gauge.setPitchAnimated(cfg.gauge?.invertPitch ? -this.latestPitch : this.latestPitch); } catch { /* ignore */ }
    try { this.gauge.setRollAnimated(cfg.gauge?.invertRoll ? -this.latestRoll : this.latestRoll); } catch { /* ignore */ }
  }

  ngOnDestroy(): void {
    // Cleanup timers / observers
    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch { /* ignore */ }
      this.resizeObserver = null;
    }
    if (this.sizeCommitTimer) {
      clearTimeout(this.sizeCommitTimer);
      this.sizeCommitTimer = null;
    }
    // Best-effort cleanup: release canvas element
    const canvas = document.getElementById(this.id() + '-canvas') as HTMLCanvasElement | null;
    if (canvas) {
      try {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Optionally release backing store (keeps element in DOM per previous behavior)
        canvas.width = 0;
        canvas.height = 0;
      } catch { /* ignore */ }
    }
    this.gauge = null;
  }
}
