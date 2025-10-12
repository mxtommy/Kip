import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, effect, inject, viewChild, signal, input, untracked } from '@angular/core';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { CanvasService } from '../../core/services/canvas.service';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { IPathUpdate } from '../../core/services/data.service';
import { ITheme } from '../../core/services/app-service';


@Component({
  selector: 'widget-text',
  templateUrl: './widget-text.component.html',
  styleUrls: ['./widget-text.component.scss'],
  imports: []
})
export class WidgetTextComponent implements AfterViewInit, OnInit, OnDestroy {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme|null>();
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Gauge Label',
    filterSelfPaths: true,
    paths: {
      "stringPath": {
        description: "String Data",
        path: null,
        source: null,
        pathType: "string",
        isPathConfigurable: true,
        sampleTime: 500
      }
    },
    color: 'contrast',
    enableTimeout: false,
    dataTimeout: 5
  };
  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly stream = inject(WidgetStreamsDirective);
  private readonly canvas = inject(CanvasService);

  private canvasMainRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private titleBitmap: HTMLCanvasElement | null = null;
  private titleBitmapText: string | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private dataValue: string | null = null;
  protected labelColor = signal<string>(undefined);
  private valueColor: string = undefined;
  private isDestroyed = false; // guard against callbacks after destroyed
  private streamRegistered = false;

  constructor() {
    effect(() => {
      const theme = this.theme();
      untracked(() => {
        const cfg = this.runtime?.options();
        if (!cfg) return;
        if (theme) {
          this.setColors();
          this.drawWidget();
        }
      });
    });

    effect(() => {
      const cfg = this.runtime?.options();
      if (!cfg) return;
      if (this.isDestroyed || !this.canvasCtx) return;
      untracked(() => {
        this.setColors();
        this.startWidget();
        this.drawWidget();
      });
    });
  }

  ngOnInit() {
    this.setColors();
  }

  ngAfterViewInit(): void {
    this.canvasElement = this.canvasMainRef().nativeElement;
    this.canvasCtx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true,
      onResize: (w, h) => {
        this.cssWidth = w;
        this.cssHeight = h;

        this.drawWidget();
      }
    });
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    if (this.isDestroyed) return;
    this.startWidget();
  }

  private startWidget(): void {
    this.dataValue = null;
    if (!this.streamRegistered) {
      const cfg = this.runtime?.options();
      if (cfg?.paths?.['stringPath']?.path) {
        this.stream.observe('stringPath', (newValue: IPathUpdate) => {
          this.dataValue = newValue.data.value as string;
          this.drawWidget();
        });
        this.streamRegistered = true;
      } else {
        this.drawWidget();
      }
    }
  }

  private setColors(): void {
    const cfg = this.runtime?.options();
    if (!cfg) return;
    this.labelColor.set(getColors(cfg.color, this.theme()).dim);
    this.valueColor = getColors(cfg.color, this.theme()).color;
  }

  // Runtime config updates are handled by Host2; effects above re-run on changes.

  ngOnDestroy() {
    this.isDestroyed = true;
    try { this.canvas.unregisterCanvas(this.canvasElement); }
    catch { /* ignore */ }
  }

  /* ******************************************************************************************* */
  /*                                  Canvas Drawing                                             */
  /* ******************************************************************************************* */
  drawWidget() {
    if (!this.canvasCtx) return;
    const titleHeight = Math.floor(this.cssHeight * 0.1);
    const cfg = this.runtime.options();
    const bgText = cfg.displayName + '|' + this.labelColor();

    if (!this.titleBitmap ||
        this.titleBitmap.width !== this.canvasElement.width ||
        this.titleBitmap.height !== this.canvasElement.height ||
        this.titleBitmapText !== bgText) {
      this.titleBitmap = this.canvas.createTitleBitmap(
        cfg.displayName,
        this.labelColor(),
        'normal',
        this.cssWidth,
        this.cssHeight
      );
      this.titleBitmapText = cfg.displayName + '|' + this.labelColor();
    }

    this.canvas.clearCanvas(this.canvasCtx, this.cssWidth, this.cssHeight);
    if (this.titleBitmap && this.titleBitmap.width > 0 && this.titleBitmap.height > 0) {
      this.canvasCtx.drawImage(this.titleBitmap, 0, 0, this.cssWidth, this.cssHeight);
    }

    const valueText = this.dataValue === null ? '--' : this.dataValue;
    const edge = this.canvas.EDGE_BUFFER || 10;
    const availableHeight = Math.max(0, this.cssHeight - titleHeight - 2 * edge);
    const maxWidth = Math.max(0, Math.floor(this.cssWidth - 2 * edge));
    const maxHeight = Math.max(0, Math.floor(availableHeight));
    const centerX = Math.floor(this.cssWidth / 2);
    const centerY = Math.floor(titleHeight + edge + availableHeight / 2);

    this.canvas.drawText(
      this.canvasCtx,
      valueText,
      centerX,
      centerY,
      maxWidth,
      maxHeight,
      'bold',
      this.valueColor,
      'center',
      'middle'
    );
  }
}
