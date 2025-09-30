import { Component, OnDestroy, AfterViewInit, inject, effect, signal, viewChild, ElementRef, input, untracked } from '@angular/core';
import { CanvasService } from '../../core/services/canvas.service';
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
  private readonly canvasService = inject(CanvasService);

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
  private sizeSignature = signal<string>('');
  private resizeDebounceHandle: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Gauge internals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected gaugeOptions: any = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private gauge: any = null;
  private lastStructuralKey = '';
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

    // Structural gauge (re)build effect
    effect(() => {
      const cfg = this.runtime.options();
      const sig = this.sizeSignature();
      if (!cfg || !sig) return; // wait for size
      const structuralKey = [cfg.gauge?.faceColor, cfg.gauge?.noFrameVisible ? '1':'0', sig].join('|');
      if (structuralKey === this.lastStructuralKey && this.gauge) return;
      this.lastStructuralKey = structuralKey;
      this.buildOptions(cfg);
      this.createOrRebuildGauge();
    });
  }

  ngAfterViewInit(): void {
    // Setup ResizeObserver manually
    const wrapperEl = this.wrapperRef()?.nativeElement;
    if (wrapperEl) {
      this.resizeObserver = new ResizeObserver(entries => {
        const entry = entries[0];
        if (!entry) return;
        this.queueResize(entry.contentRect.width, entry.contentRect.height);
      });
      this.resizeObserver.observe(wrapperEl);
      // Initial size
      const rect = wrapperEl.getBoundingClientRect();
      this.queueResize(rect.width, rect.height);
    }
  }

  private queueResize(w: number, h: number): void {
    if (w < 50 || h < 50) return;
    const size = Math.min(w, h);
    const prev = this.sizeSignature();
    const prevSize = prev ? Number(prev.split(':')[1]) : NaN;
    // Ignore tiny changes (<4px) to reduce rebuild churn
    if (Number.isFinite(prevSize) && Math.abs(size - prevSize) < 4) return;
    const sig = 'horizon:' + Math.round(size);
    if (sig === prev) return;
    if (this.resizeDebounceHandle) window.clearTimeout(this.resizeDebounceHandle);
    this.resizeDebounceHandle = window.setTimeout(() => {
      this.sizeSignature.set(sig);
      this.resizeDebounceHandle = null;
    }, 120);
  }

  private buildOptions(cfg: IWidgetSvcConfig): void {
    if (typeof steelseries === 'undefined') {
      // steelseries not yet loaded (scripts), skip; effect will rerun when sizeSignature changes again after load
      return;
    }
    const frameMap = getSteelFrameDesign(steelseries);
    const pointerMap = getSteelPointerColors(steelseries);
    this.gaugeOptions = {
      pointerColor: pointerMap.Red,
      frameVisible: cfg.gauge?.noFrameVisible ?? false,
      frameDesign: frameMap[cfg.gauge?.faceColor ?? 'anthracite'],
      foregroundVisible: false,
      size: this.parseSizeFromSignature(this.sizeSignature())
    };
  }

  private parseSizeFromSignature(sig: string): number | undefined {
    if (!sig) return undefined;
    const parts = sig.split(':');
    const n = Number(parts[1]);
    return Number.isFinite(n) ? n : undefined;
  }

  private createOrRebuildGauge(): void {
    const canvasId = this.id() + '-canvas';
    // Release old gauge reference; clear canvas explicitly to prevent layered visuals
    if (this.gauge) {
      try { this.gauge = null; } catch { /* ignore */ }
    }
    const existingCanvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (existingCanvas) {
      const ctx = existingCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, existingCanvas.width, existingCanvas.height);
    }
    try {
      this.gauge = new steelseries.Horizon(canvasId, this.gaugeOptions);
      // Apply last known values
      const cfg = this.runtime.options();
      if (cfg && this.gauge) {
        try { this.gauge.setPitchAnimated(cfg.gauge?.invertPitch ? -this.latestPitch : this.latestPitch); } catch { /* ignore */ }
        try { this.gauge.setRollAnimated(cfg.gauge?.invertRoll ? -this.latestRoll : this.latestRoll); } catch { /* ignore */ }
      }
    } catch (e) {
      console.warn('[WidgetHorizon] Failed to build gauge', e);
    }
  }

  ngOnDestroy(): void {
    // Cleanup timers / observers
    if (this.resizeDebounceHandle) {
      window.clearTimeout(this.resizeDebounceHandle);
      this.resizeDebounceHandle = null;
    }
    if (this.resizeObserver) {
      try { this.resizeObserver.disconnect(); } catch { /* ignore */ }
      this.resizeObserver = null;
    }
    // Best-effort cleanup: release canvas element
    const canvas = document.getElementById(this.id() + '-canvas') as HTMLCanvasElement | null;
    this.canvasService.releaseCanvas(canvas, { clear: true, removeFromDom: false });
    this.gauge = null;
  }
}
