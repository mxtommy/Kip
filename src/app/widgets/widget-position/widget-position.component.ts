import { Component, AfterViewInit, OnDestroy, ElementRef, viewChild, inject, effect, signal, untracked, input } from '@angular/core';
import { CanvasService } from '../../core/services/canvas.service';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';

@Component({
  selector: 'widget-position',
  templateUrl: './widget-position.component.html',
  styleUrls: ['./widget-position.component.scss'],
  imports: []
})
export class WidgetPositionComponent implements AfterViewInit, OnDestroy {
  // Functional Host2 inputs provided by dashboard container
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Directives/services
  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);
  private readonly canvas = inject(CanvasService);

  // Canvas refs
  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private titleBitmap: HTMLCanvasElement | null = null;
  private titleBitmapText: string | null = null;

  // Render metrics
  private maxTextWidth = 0;
  private maxTextHeight = 0;
  private middle = 0;
  private center = 0;
  private fontSizeOffset = 0;

  // Value state
  private latPos = '';
  private longPos = '';
  protected labelColor = signal<string>('');
  private valueColor = '';

  // Static default config cloned from legacy implementation
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Position',
    filterSelfPaths: true,
    paths: {
      longPath: {
        description: 'Longitude',
        path: 'self.navigation.position.longitude',
        source: 'default',
        pathType: 'number',
        isPathConfigurable: true,
        convertUnitTo: 'longitudeMin',
        showPathSkUnitsFilter: true,
        pathSkUnitsFilter: null,
        sampleTime: 500
      },
      latPath: {
        description: 'Latitude',
        path: 'self.navigation.position.latitude',
        source: 'default',
        pathType: 'number',
        isPathConfigurable: true,
        convertUnitTo: 'latitudeMin',
        showPathSkUnitsFilter: true,
        pathSkUnitsFilter: null,
        sampleTime: 500
      }
    },
    color: 'contrast',
    enableTimeout: false,
    dataTimeout: 5
  };

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
        this.draw();
      });
    });

    // Observe longitude path
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const pathCfg = cfg.paths?.['longPath'];
      if (!pathCfg?.path) return;
      untracked(() => this.streams.observe('longPath', pkt => {
        const val = pkt?.data?.value as number | null;
        if (val === null || val === undefined) this.longPos = '';
        else if (pathCfg.convertUnitTo === 'pdeg') this.longPos = (val as number).toFixed(6) + '°';
        else this.longPos = String(val);
        this.calculateFontSizeAndPositions();
        this.draw();
      }));
    });

    // Observe latitude path
    effect(() => {
      const cfg = this.runtime.options(); if (!cfg) return;
      const pathCfg = cfg.paths?.['latPath'];
      if (!pathCfg?.path) return;
      untracked(() => this.streams.observe('latPath', pkt => {
        const val = pkt?.data?.value as number | null;
        if (val === null || val === undefined) this.latPos = '';
        else if (pathCfg.convertUnitTo === 'pdeg') this.latPos = (val as number).toFixed(7) + '°';
        else this.latPos = String(val);
        this.calculateFontSizeAndPositions();
        this.draw();
      }));
    });
  }

  // Canvas lifecycle
  ngAfterViewInit(): void {
    this.canvasElement = this.canvasRef().nativeElement;
    this.ctx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true,
      onResize: (w, h) => {
        this.cssWidth = w;
        this.cssHeight = h;
        this.calculateFontSizeAndPositions();
        this.draw();
      }
    });
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    this.calculateFontSizeAndPositions();
    this.draw();
  }

  private calculateFontSizeAndPositions(): void {
    if (!this.cssWidth || !this.cssHeight) return;
    this.maxTextHeight = Math.floor(this.cssHeight * 0.6 / 2);
    this.maxTextWidth = Math.floor(this.cssWidth * 0.85);
    this.center = this.cssWidth / 2;
    this.middle = this.cssHeight * 0.57;
    const longestString = this.latPos.length > this.longPos.length ? this.latPos : this.longPos;
    if (this.ctx) {
      const size = this.canvas.calculateOptimalFontSize(this.ctx, longestString, this.maxTextWidth, this.maxTextHeight, 'bold');
      this.fontSizeOffset = Math.floor(size * 0.0005);
    }
  }

  private draw(): void {
    if (!this.ctx || !this.canvasElement) return;
    const cfg = this.runtime.options();
    if (!cfg) return;
    if (!this.titleBitmap || this.titleBitmap.width !== this.canvasElement.width || this.titleBitmap.height !== this.canvasElement.height || this.titleBitmapText !== cfg.displayName) {
      const name = cfg.displayName || 'Position';
      this.titleBitmap = this.canvas.createTitleBitmap(name, this.labelColor(), 'normal', this.cssWidth, this.cssHeight);
      this.titleBitmapText = name;
    }
    this.canvas.clearCanvas(this.ctx, this.cssWidth, this.cssHeight);
    // Draw the title bitmap at the top. Request an explicit target size in
    // CSS pixels to avoid any ambiguity with device-pixel intrinsic sizes.
    // Ensure canvas is not size 0
    if (this.titleBitmap && this.titleBitmap.width > 0 && this.titleBitmap.height > 0) {
      this.ctx.drawImage(this.titleBitmap, 0, 0, this.cssWidth, this.cssHeight);
    }
    // Latitude
    this.canvas.drawText(
      this.ctx,
      this.latPos,
      this.center,
      this.middle - this.fontSizeOffset,
      this.maxTextWidth,
      this.maxTextHeight,
      'bold',
      this.valueColor,
      'center',
      'bottom'
    );
    // Longitude
    this.canvas.drawText(
      this.ctx,
      this.longPos,
      this.center,
      this.middle + this.fontSizeOffset,
      this.maxTextWidth,
      this.maxTextHeight,
      'bold',
      this.valueColor,
      'center',
      'top'
    );
  }

  ngOnDestroy(): void {
    try {
      if (this.canvasElement) this.canvas.unregisterCanvas(this.canvasElement);
    } catch { /* ignore */ }
  }
}
