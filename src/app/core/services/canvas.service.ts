import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CanvasService {
  public readonly DEFAULT_FONT = 'Roboto';
  public readonly EDGE_BUFFER = 10;
  public scaleFactor = window.devicePixelRatio || 1;
  private fontsReadyPromise: Promise<FontFaceSet>;

  constructor() {
    // Wait for font loading to complete
    this.fontsReadyPromise = document.fonts.ready;
  }

  /**
   * @description
   * Sets the canvas size to match the parent container size, accounting for high DPI displays.
   * This method should be called whenever the parent container is resized.
   *
   * @param {HTMLCanvasElement} canvas - The canvas element to resize.
   * @param {DOMRectReadOnly} parentContainer - The bounding rectangle of the parent container
   * to use as our max canvas size.
   * @memberof CanvasService
   */
  public setHighDPISize(canvas: HTMLCanvasElement, parentContainer: DOMRectReadOnly): void {
    const cssWidth = Math.floor(parentContainer.width);
    const cssHeight = Math.floor(parentContainer.height);

    canvas.width = cssWidth * this.scaleFactor;
    canvas.height = cssHeight * this.scaleFactor;

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }

  /**
   * This method draws widget title on the canvas with optimal font size.
   * It is used by the widget title component to render the title text.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text Text to be drawn on the canvas.
   * @param {string} color Text color.
   * @param {string} [fontWeight='normal'] Font weight (e.g., 'normal', 'bold').
   * @param {number} canvasWidth The width of the canvas.
   * @param {number} canvasHeight The height of the canvas.
   * @return {*}  {void}
   * @memberof CanvasService
   */
  public drawTitle(ctx: CanvasRenderingContext2D, text: string, color: string, fontWeight = 'normal', canvasWidth: number, canvasHeight: number): void {
    if (!ctx) return;

    this.fontsReadyPromise
      .then(() => {
        requestAnimationFrame(() => {
          this.drawTitleInternal(ctx, text, color, fontWeight, canvasWidth, canvasHeight);
        });
      })
      .catch((err) => {
        console.warn(`[Canvas Service] Font readiness failed: ${err}`);
        this.drawTitleInternal(ctx, text, color, fontWeight, canvasWidth, canvasHeight);
      });
  }

  private drawTitleInternal(ctx: CanvasRenderingContext2D, text: string, color: string, fontWeight = 'normal', canvasWidth: number, canvasHeight: number): void {
    if (!ctx) return;

    const maxWidth = canvasWidth - 2 * this.EDGE_BUFFER;
    const maxHeight = Math.floor(canvasHeight * 0.1);
    const fontSize = this.calculateOptimalFontSize(ctx, text, maxWidth, maxHeight, fontWeight);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.font = `${fontWeight} ${fontSize}px ${this.DEFAULT_FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, this.EDGE_BUFFER * this.scaleFactor, this.EDGE_BUFFER * this.scaleFactor, maxWidth);
  }

  /**
   * Clears the entire canvas.
   * @param {CanvasRenderingContext2D} ctx The canvas rendering context.
   * @param {number} width The width of the canvas.
   * @param {number} height The height of the canvas.
   * @return {*}  {void}
   * @memberof CanvasService
   */
  public clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.clearRect(0, 0, width, height);
  }

  /**
   * Draws text on the canvas as large as possible with optimal font size.
   * @param {CanvasRenderingContext2D} ctx The canvas rendering context.
   * @param {string} text The text to be drawn on the canvas.
   * @param {number} [x=this.EDGE_BUFFER] The x-coordinate left/right margins of the text.
   * @param {number} [y=this.EDGE_BUFFER] The y-coordinate top/bottom margins of the text.
   * @param {number} maxWidth The maximum width of the text.
   * @param {number} maxHeight The maximum height of the text.
   * @param {string} [fontWeight='normal'] The font weight (e.g., 'normal', 'bold').
   * @param {string} [color='#000'] The color of the text.
   * @param {CanvasTextAlign} [textAlign='center'] The text alignment (e.g., 'left', 'center', 'right').
   * @param {CanvasTextBaseline} [textBaseline='middle'] The text baseline (e.g., 'top', 'middle', 'bottom').
   * @return {*}  {void}
   * @memberof CanvasService
   */
  public drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number = this.EDGE_BUFFER,
    y: number = this.EDGE_BUFFER,
    maxWidth: number,
    maxHeight: number,
    fontWeight = 'normal',
    color = '#000',
    textAlign: CanvasTextAlign = 'center',
    textBaseline: CanvasTextBaseline = 'middle'
  ): void {
    if (!ctx) return;

    if (document.fonts.status === 'loaded') {
      this.drawTextInternal(ctx, text, x, y, maxWidth, maxHeight, fontWeight, color, textAlign, textBaseline);
    } else {
      this.fontsReadyPromise
        .then(() => {
          this.drawTextInternal(ctx, text, x, y, maxWidth, maxHeight, fontWeight, color, textAlign, textBaseline);
        })
        .catch((err) => {
          console.warn(`[Canvas Service] Font readiness failed: ${err}`);
          this.drawTextInternal(ctx, text, x, y, maxWidth, maxHeight, fontWeight, color, textAlign, textBaseline);
        });
    }
  }

  /**
   * Draws text on the canvas with optimal font size.
   */
  private drawTextInternal(ctx: CanvasRenderingContext2D, text: string, x: number = this.EDGE_BUFFER, y: number = this.EDGE_BUFFER, maxWidth: number, maxHeight: number, fontWeight = 'normal', color = '#000', textAlign: CanvasTextAlign = 'center', textBaseline: CanvasTextBaseline = 'middle'): void {
    const fontSize = this.calculateOptimalFontSize(ctx, text, maxWidth, maxHeight, fontWeight);
    ctx.font = `${fontWeight} ${fontSize}px ${this.DEFAULT_FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;
    ctx.fillText(text, x, y, maxWidth);
  }

  /**
   * Calculates the optimal font size for the given text to fit within the specified width and height.
   * Uses binary search to find the maximum font size that fits within the constraints.
   *
   * @param {CanvasRenderingContext2D} ctx The canvas rendering context.
   * @param {string} text The text to be measured.
   * @param {number} maxWidth The maximum width of the text.
   * @param {number} maxHeight The maximum height of the text.
   * @param {string} [fontWeight='normal'] The font weight (e.g., 'normal', 'bold').
   * @return {*}  {number} The optimal font size in pixels.
   * @memberof CanvasService
   */
  public calculateOptimalFontSize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxHeight: number, fontWeight = 'normal'): number {
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
   * Draws a rectangle on the canvas.
   * @param {CanvasRenderingContext2D} ctx The canvas rendering context.
   * @param {number} x The x-coordinate of the rectangle.
   * @param {number} y The y-coordinate of the rectangle.
   * @param {number} width The width of the rectangle.
   * @param {number} height The height of the rectangle.
   * @param {string} color The color of the rectangle.
   * @return {*}  {void}
   * @memberof CanvasService
   */
  public drawRectangle(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  /**
   * Proactively release a canvas backing store to reduce GPU/system memory pressure.
   * Steps:
   *  1. Optionally clear the current contents.
   *  2. Reset width/height to 0 (this drops the backing store allocations in browsers).
   *  3. Optionally remove the element from the DOM (if caller is certain it's not reused).
   *  4. Null out any expando properties the app may have attached (defensive – caller passes keys).
   *
   * @param canvas The canvas element.
   * @param opts Optional behavior flags.
   */
  public releaseCanvas(
    canvas: HTMLCanvasElement | undefined | null,
    opts: {
      removeFromDom?: boolean; // physically detach from its parent
      clear?: boolean;         // clear contents before resize (default true)
      expandoKeys?: string[];  // property names to delete off the element (if any)
    } = {}
  ): void {
    if (!canvas) return;
    const { removeFromDom = false, clear = true, expandoKeys = [] } = opts;
    try {
      const ctx = canvas.getContext('2d');
      if (clear && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      // Reset size to release backing store
      canvas.width = 0;
      canvas.height = 0;
      // Remove expando / custom references if any
      expandoKeys.forEach(k => {
        try { delete (canvas as unknown as Record<string, unknown>)[k]; } catch { /* ignore */ }
      });
      if (removeFromDom && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    } catch (err) {
      console.warn('[CanvasService] releaseCanvas failed', err);
    }
  }

  /**
   * Convenience helper to release multiple canvases with same options.
  * Iterates the list and calls {@link CanvasService.releaseCanvas | releaseCanvas} for each element.
  * @see {@link CanvasService.releaseCanvas}
   */
  public releaseCanvases(canvases: (HTMLCanvasElement | undefined | null)[], opts?: Parameters<CanvasService['releaseCanvas']>[1]): void {
    canvases.forEach(c => this.releaseCanvas(c, opts));
  }
}
