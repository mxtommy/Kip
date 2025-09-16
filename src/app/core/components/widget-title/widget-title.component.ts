import { AfterViewInit, Component, ElementRef, inject, input, OnChanges, SimpleChanges, viewChild, OnDestroy } from '@angular/core';
import { CanvasService } from '../../services/canvas.service';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

@Component({
  selector: 'widget-title',
  imports: [NgxResizeObserverModule],
  templateUrl: './widget-title.component.html',
  styleUrl: './widget-title.component.scss'
})
export class WidgetTitleComponent implements AfterViewInit, OnChanges, OnDestroy {
  protected text = input.required<string>();
  protected color = input.required<string>();
  protected canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private canvas = inject(CanvasService);
  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private isReady = false;
  private cssWidth = 0;
  private cssHeight = 0;

  constructor() {
  }

  ngAfterViewInit() {
    this.canvasElement = this.canvasRef().nativeElement;
    this.canvasCtx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true,
      onResize: (w, h) => {
        this.cssWidth = w;
        this.cssHeight = h;
        this.drawTitle();
      }
    });
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    this.isReady = true;
    this.drawTitle();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['text'] || changes['color']) {
      this.drawTitle();
    }
  }

  protected drawTitle() {
    if (!this.isReady) return;
    this.canvas.drawTitle(this.canvasCtx, this.text(), this.color(), 'normal', this.cssWidth, this.cssHeight);
  }

  ngOnDestroy(): void {
    try { this.canvas.unregisterCanvas(this.canvasElement); }
    catch { /* ignore */ }
    this.canvasCtx = null;
    this.canvasElement = null;
  }
}
