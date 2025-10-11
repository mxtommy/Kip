import { AfterViewInit, Component, effect, ElementRef, inject, OnDestroy, viewChild, signal, untracked, input } from '@angular/core';
import { CanvasService } from '../../core/services/canvas.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';

@Component({
  selector: 'widget-label',
  templateUrl: './widget-label.component.html',
  styleUrl: './widget-label.component.scss'
})
export class WidgetLabelComponent implements AfterViewInit, OnDestroy {
  // Functional inputs
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Runtime directive
  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly canvas = inject(CanvasService);

  // Static default config (legacy parity)
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Static Label',
    color: 'green',
    bgColor: 'grey',
    noColor: false,
    noBgColor: true
  };

  // Canvas refs/state
  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private maxTextWidth = 0;
  private maxTextHeight = 0;
  private disposed = false;

  // Palette colors
  protected fgColor = signal<string>('');
  protected bgColor = signal<string>('');

  constructor() {
    // Theme & config effect
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      if (!cfg || !theme) return;
      untracked(() => {
        this.fgColor.set(this.mapColor(cfg.color, theme));
        this.bgColor.set(this.mapColor(cfg.bgColor ?? 'grey', theme));
        this.draw();
      });
    });

    // React to displayName changes specifically
    effect(() => {
      const name = this.runtime.options()?.displayName;
      untracked(() => {
        if (name !== undefined) this.draw();
      });
    });
  }

  private mapColor(colorName: string, theme: ITheme): string {
    switch (colorName) {
      case 'contrast': return theme.contrast;
      case 'blue': return theme.blue;
      case 'green': return theme.green;
      case 'pink': return theme.pink;
      case 'orange': return theme.orange;
      case 'purple': return theme.purple;
      case 'grey': return theme.grey;
      case 'yellow': return theme.yellow;
      default: return theme.contrast;
    }
  }

  ngAfterViewInit(): void {
    this.canvasElement = this.canvasRef().nativeElement;
    this.ctx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true,
      onResize: (w, h) => {
        this.cssWidth = w;
        this.cssHeight = h;
        this.draw();
      }
    });
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    this.draw();
  }

  private draw(): void {
    if (!this.ctx || !this.canvasElement) return;
    const cfg = this.runtime.options();
    if (!cfg) return;
    this.canvas.clearCanvas(this.ctx, this.cssWidth, this.cssHeight);
    if (!cfg.noBgColor) {
      this.canvas.drawRectangle(this.ctx, 0, 0, this.canvasElement.width, this.canvasElement.height, this.bgColor());
    }
    const name = cfg.displayName || '';
    this.canvas.drawText(
      this.ctx,
      name,
      Math.floor(this.cssWidth / 2),
      Math.floor(this.cssHeight / 2 + 10),
      this.cssWidth - 40,
      this.cssHeight - 40,
      'bold',
      this.fgColor()
    );
  }

  ngOnDestroy(): void {
    this.disposed = true;
    try {
      if (this.canvasElement) this.canvas.unregisterCanvas(this.canvasElement);
    } catch {
      /* ignore */
    }
  }
}
