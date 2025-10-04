import { Component, OnDestroy, ElementRef, AfterViewInit, effect, inject, viewChild, signal, input, computed, untracked } from '@angular/core';
import { formatDate } from '@angular/common';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { ITheme } from '../../core/services/app-service';

@Component({
  selector: 'widget-datetime',
  templateUrl: './widget-datetime.component.html',
  styleUrls: ['./widget-datetime.component.scss'],
  imports: [NgxResizeObserverModule]
})
export class WidgetDatetimeComponent implements AfterViewInit, OnDestroy {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);

  // Static DEFAULT_CONFIG for Host2
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Time Label',
    filterSelfPaths: true,
    paths: {
      gaugePath: {
        description: 'Date / Time',
        path: null,
        source: null,
        pathType: 'Date',
        isPathConfigurable: true,
        sampleTime: 1000
      }
    },
    dateFormat: 'dd/MM/yyyy HH:mm:ss',
    dateTimezone: 'Atlantic/Azores',
    color: 'contrast',
    enableTimeout: false,
    dataTimeout: 5
  };

  private canvasMainRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private titleBitmap: HTMLCanvasElement | null = null;
  private titleBitmapText: string | null = null;
  private canvas = inject(CanvasService);


  private cssWidth = 0;
  private cssHeight = 0;
  protected dataValue = signal<string | null>(null);
  private _timeZoneGTM = "";
  private isDestroyed = false; // guard against callbacks after destroyed
  protected labelColor = signal<string>(undefined);
  private valueColor: string = undefined;
  private maxTextWidth = 0;
  private maxTextHeight = 0;

  protected displayName = computed(() => this.runtime.options()?.displayName);
  protected dateFormat = computed(() => this.runtime.options()?.dateFormat);
  protected dateTimezone = computed(() => this.runtime.options()?.dateTimezone);

  constructor() {
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      if (!cfg || !theme) return;
      untracked(() => {
        this.applyColors();
        const pathCfg = cfg.paths?.['gaugePath'];
        if (!pathCfg?.path) return; // wait for path
        this._timeZoneGTM = this.getGMTOffset(this.dateTimezone());
        // Subscribe once per config change
        this.streams.observe('gaugePath', pkt => {
          this.dataValue.set(pkt?.data?.value as string ?? null);
          this.drawWidget();
        });
      });
    });

    // React to theme / color changes
    effect(() => {
      const theme = this.theme();
      const cfg = this.runtime.options();
      if (!theme || !cfg) return;
      untracked(() => {
        this.applyColors();
        this.drawWidget();
      });
    });
  }

  ngAfterViewInit(): void {
    this.canvasElement = this.canvasMainRef().nativeElement;
    this.canvasCtx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true,
      onResize: (w, h) => {
        this.cssWidth = w;
        this.cssHeight = h;
        this.maxTextWidth = Math.floor(this.cssWidth * 0.85);
        this.maxTextHeight = Math.floor(this.cssHeight * 0.70);
        this.drawWidget();
      }
    });
    if (this.isDestroyed) return;
    this.cssHeight = Math.floor(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.floor(this.canvasElement.getBoundingClientRect().width);
    this.maxTextWidth = Math.floor(this.canvasElement.width * 0.85);
    this.maxTextHeight = Math.floor(this.canvasElement.height * 0.70);
    this.applyColors();
    this.drawWidget();
  }

  private getGMTOffset(timeZone: string): string {
    try {
      if (timeZone === 'System Timezone -') return '';
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'short'
      });
      const parts = formatter.formatToParts(new Date());
      const timeZonePart = parts.find(part => part.type === 'timeZoneName');
      return timeZonePart ? timeZonePart.value : 'GMT';
    } catch (error) {
      console.error(`Error getting GMT offset for timezone "${timeZone}":`, error);
      return 'GMT';
    }
  }

  private applyColors(): void {
    const cfg = this.runtime.options();
    const theme = this.theme();
    if (!cfg || !theme) return;
    this.labelColor.set(getColors(cfg.color, theme).dim);
    this.valueColor = getColors(cfg.color, theme).color;
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    try {
      this.canvas.unregisterCanvas(this.canvasElement);
    } catch { /* ignore */ }
  }
  /* ******************************************************************************************* */
  /*                                  Canvas                                                     */
  /* ******************************************************************************************* */
  private drawWidget(): void {
    if (!this.canvasCtx) return;
    // Only recreate the title bitmap if the title text or full canvas size changes.
    // Note: the offscreen bitmap returned by createTitleBitmap is backed by
    // device pixels (width/height === css * devicePixelRatio), so compare
    // against the full canvas device-pixel dimensions.
    if (!this.titleBitmap ||
      this.titleBitmap.width !== this.canvasElement.width ||
      this.titleBitmap.height !== this.canvasElement.height ||
      this.titleBitmapText !== `${this.displayName()}-${this.runtime.options().color}`
    ) {
      this.titleBitmap = this.canvas.createTitleBitmap(
        this.displayName(),
        this.labelColor(),
        'normal',
        this.cssWidth,
        this.cssHeight
      );
      this.titleBitmapText = `${this.displayName()}-${this.runtime.options().color}`;
    }

    this.canvas.clearCanvas(this.canvasCtx, this.cssWidth, this.cssHeight);

    // Draw the title bitmap at the top. Request an explicit target size in
    // CSS pixels to avoid any ambiguity with device-pixel intrinsic sizes.
    // Ensure canvas is not size 0
    if (this.titleBitmap && this.titleBitmap.width > 0 && this.titleBitmap.height > 0) {
      this.canvasCtx.drawImage(this.titleBitmap, 0, 0, this.cssWidth, this.cssHeight);
    }

    let valueText: string;

    const cur = this.dataValue();
    if (!cur || isNaN(Date.parse(cur))) {
      valueText = '--';
    } else {
      try {
        valueText = formatDate(cur, this.dateFormat(), 'en-US', this._timeZoneGTM);
      } catch (error) {
        valueText = error;
        console.log('[Date Time Widget]: ' + error);
      }
    }

    this.canvas.drawText(
      this.canvasCtx,
      valueText,
      Math.floor(this.cssWidth / 2),
      Math.floor(this.cssHeight / 2 * 1.15),
      this.maxTextWidth,
      this.maxTextHeight,
      'bold',
      this.valueColor
    );
  }
}
