import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CanvasService {
  private readonly DEFAULT_FONT = 'Roboto';
  private readonly EDGE_BUFFER = 20;
  private scaleFactor = 1;

  constructor() {
    this.scaleFactor = window.devicePixelRatio || 1;
  }

  public setHighDPISize(canvas: HTMLCanvasElement, parentContainer: DOMRectReadOnly): void {
    canvas.width = Math.floor(parentContainer.width * this.scaleFactor);
    canvas.height = Math.floor(parentContainer.height * this.scaleFactor);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  public drawTitle(ctx: CanvasRenderingContext2D, text: string, color: string, fontWeight: string = 'normal', canvasWidth: number, canvasHeight: number): void {
    if (!ctx) return;

    const maxWidth = Math.floor(canvasWidth - 2 * this.EDGE_BUFFER);
    const maxHeight = Math.floor(canvasHeight * 0.1);
    const fontSize = this.calculateOptimalFontSize(ctx, text, maxWidth, maxHeight, fontWeight);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.font = `${fontWeight} ${fontSize}px ${this.DEFAULT_FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, this.EDGE_BUFFER, this.EDGE_BUFFER), maxWidth;
  }

  /**
   * Clears the canvas.
   */
  public clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.clearRect(0, 0, width, height);
  }

  /**
   * Draws text on the canvas with optimal font size.
   */
  public drawText(ctx: CanvasRenderingContext2D, text: string, x: number = this.EDGE_BUFFER, y: number = this.EDGE_BUFFER, maxWidth: number, maxHeight: number, fontWeight: string = 'normal', color: string = '#000', textAlign: CanvasTextAlign = 'center', textBaseline: CanvasTextBaseline = 'middle'): void {
    const fontSize = this.calculateOptimalFontSize(ctx, text, maxWidth, maxHeight, fontWeight);
    ctx.font = `${fontWeight} ${fontSize}px ${this.DEFAULT_FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;
    ctx.fillText(text, x, y, maxWidth);
  }

  /**
   * Calculates the optimal font size for a given text and canvas constraints.
   */
  public calculateOptimalFontSize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxHeight: number, fontWeight: string = 'normal'): number {
    let minFontSize = 1;
    let maxFontSize = maxHeight;
    let fontSize = maxFontSize;

    while (minFontSize <= maxFontSize) {
      fontSize = Math.floor((minFontSize + maxFontSize) / 2);
      ctx.font = `${fontWeight} ${fontSize}px ${this.DEFAULT_FONT}`;
      const measure = ctx.measureText(text).width;

      if (measure > maxWidth) {
        maxFontSize = fontSize - 1;
      } else {
        minFontSize = fontSize + 1;
      }
    }

    return maxFontSize;
  }

  /**
   * Draws a filled rectangle on the canvas.
   */
  public drawRectangle(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }
}
