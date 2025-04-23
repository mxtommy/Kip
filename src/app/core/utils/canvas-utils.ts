export class CanvasUtils {
  private static readonly defaultFont = 'Roboto';

  /**
   * Clears the canvas.
   */
  static clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.clearRect(0, 0, width, height);
  }

  /**
   * Draws text on the canvas with optimal font size.
   */
  static drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    fontWeight: string = 'normal',
    color: string = '#000',
    textAlign: CanvasTextAlign = 'center',
    textBaseline: CanvasTextBaseline = 'middle'
  ): void {
    const fontSize = this.calculateOptimalFontSize(ctx, text, maxWidth, maxHeight, fontWeight);
    ctx.font = `${fontWeight} ${fontSize}px ${this.defaultFont}`;
    ctx.fillStyle = color;
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;
    ctx.fillText(text, x, y, maxWidth);
  }

  /**
   * Calculates the optimal font size for a given text and canvas constraints.
   */
  static calculateOptimalFontSize(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxHeight: number,
    fontWeight: string = 'normal'
  ): number {
    let minFontSize = 1;
    let maxFontSize = maxHeight;
    let fontSize = maxFontSize;

    while (minFontSize <= maxFontSize) {
      fontSize = Math.floor((minFontSize + maxFontSize) / 2);
      ctx.font = `${fontWeight} ${fontSize}px ${this.defaultFont}`;
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
  static drawRectangle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }
}
