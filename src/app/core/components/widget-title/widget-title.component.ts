import { AfterViewInit, Component, ElementRef, inject, input, OnChanges, SimpleChanges, viewChild } from '@angular/core';
import { CanvasService } from '../../services/canvas.service';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

@Component({
  selector: 'widget-title',
  imports: [NgxResizeObserverModule],
  templateUrl: './widget-title.component.html',
  styleUrl: './widget-title.component.scss'
})
export class WidgetTitleComponent implements AfterViewInit, OnChanges {
  protected text = input.required<string>();
  protected color = input.required<string>();
  protected canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private canvas = inject(CanvasService);
  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private isReady = false;

  constructor() {
  }

  ngAfterViewInit() {
    this.canvasElement = this.canvasRef().nativeElement;
    if (this.canvasElement) {
      this.canvasCtx = this.canvasElement.getContext('2d');
      // Set the initial canvas size based on its parent container
      this.canvas.setHighDPISize(this.canvasElement, this.canvasElement.parentElement.getBoundingClientRect());
    }
    this.isReady = true;
    this.drawTitle();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['text'] || changes['color']) {
      this.drawTitle();
    }
  }

  protected onResized(e: ResizeObserverEntry) {
    this.canvas.setHighDPISize(this.canvasElement, e.contentRect);
    this.drawTitle();
  }

  protected drawTitle() {
    if (!this.isReady) return;
    this.canvas.drawTitle(this.canvasCtx, this.text(), this.color(), 'normal', this.canvasElement.width, this.canvasElement.height);
  }
}
