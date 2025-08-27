import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CanvasService {
  public readonly DEFAULT_FONT = 'Roboto';
  public readonly EDGE_BUFFER = 10;
  /** Enable verbose canvas diagnostics (dev only) */
  public debug = false;
  public scaleFactor = window.devicePixelRatio || 1;
  private fontsReadyPromise: Promise<FontFaceSet>;
  private sharedResizeObserver: ResizeObserver | null = null;
  private observedCanvases = new Map<HTMLCanvasElement, { autoRelease?: boolean }>();
  private dprMediaQuery: MediaQueryList | null = null;
  private resizeCallbacks = new WeakMap<HTMLCanvasElement, (w: number, h: number) => void>();

  constructor() {
    // Wait for font loading to complete
    this.fontsReadyPromise = document.fonts.ready;
  }

  /**
   * Register a canvas with the service so it is auto-resized for high-DPI.
   * The service will observe CSS size changes and window DPR changes. Callers
   * should unregister in ngOnDestroy. If `opts.autoRelease` is set, the canvas
   * will be released (cleared, removed from DOM) automatically on unregister.
   *
   * @param canvas The canvas element to observe and manage.
   * @param opts Optional behavior flags. If `autoRelease` is true (default),
   * the canvas will be released on unregister. If false, it will be retained
   * and need to be unregistered manually.
   */
  public registerCanvas(
    canvas: HTMLCanvasElement,
    opts: { autoRelease?: boolean, onResize?: (w: number, h: number) => void } = {}
  ): void {
    // Default autoRelease to true unless explicitly set false
    opts = { autoRelease: true, ...opts };
    if (!canvas) return;

    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // Store the callback for this canvas (if provided), wrapping to ignore zero-size
    if (opts.onResize) {
      const filteredResize = (w: number, h: number) => {
        if (w === 0 || h === 0) return;
        opts.onResize(w, h);
      };
      this.resizeCallbacks.set(canvas, filteredResize);
    }

    if (!this.sharedResizeObserver) {
      if (this.debug) {
        console.log('[CanvasService] Creating shared ResizeObserver for all canvases');
      }
      this.sharedResizeObserver = new ResizeObserver(entries => {
        if (this.debug) {
          console.log('[CanvasService] Shared ResizeObserver callback fired', entries.map(entry => {
            const target = entry.target as HTMLCanvasElement;
            const parent = target.parentElement;
            return {
              tag: target.tagName,
              id: target.id,
              class: target.className,
              parent: parent ? {
                tag: parent.tagName,
                class: parent.className,
                id: parent.id
              } : null,
              contentRect: entry.contentRect,
              style: { width: target.style.width, height: target.style.height },
              backingStore: { width: target.width, height: target.height }
            };
          }));
        }
        for (const entry of entries) {
          const target = entry.target as HTMLCanvasElement;
          if (this.debug) {
            const parent = target.parentElement;
            console.log('[CanvasService] Shared ResizeObserver entry (detailed)', {
              tag: target.tagName,
              id: target.id,
              class: target.className,
              parent: parent ? {
                tag: parent.tagName,
                class: parent.className,
                id: parent.id
              } : null,
              contentRect: entry.contentRect,
              style: { width: target.style.width, height: target.style.height },
              backingStore: { width: target.width, height: target.height }
            });
          }
          this.setHighDPISize(target, entry.contentRect);
          const cb = this.resizeCallbacks.get(target);
          if (cb) {
            cb(Math.round(entry.contentRect.width), Math.round(entry.contentRect.height));
          }
        }
      });
    }
    this.sharedResizeObserver.observe(canvas);
    if (this.debug) {
      console.log('[CanvasService] Started observing canvas (shared observer)', {
        tag: canvas.tagName,
        id: canvas.id,
        class: canvas.className,
        selector: canvas.getAttribute('ng-reflect-ng-if') || '',
        parent: canvas.parentElement ? {
          tag: canvas.parentElement.tagName,
          class: canvas.parentElement.className,
          id: canvas.parentElement.id
        } : null
      });
    }

    this.observedCanvases.set(canvas, opts || {});

    // Initial sizing and callback
    this.setHighDPISize(canvas, canvas.getBoundingClientRect());
    const cb = this.resizeCallbacks.get(canvas);
    if (cb) {
      const rect = canvas.getBoundingClientRect();
      cb(Math.round(rect.width), Math.round(rect.height));
    }
  }

  /**
   * Stop observing a canvas. If the canvas was registered with `autoRelease`,
   * it will be released (cleared and removed from the DOM) automatically.
   */
  public unregisterCanvas(canvas: HTMLCanvasElement): void {
    if (!canvas || !this.observedCanvases.has(canvas)) return;
    if (this.sharedResizeObserver) {
      this.sharedResizeObserver.unobserve(canvas);
      // Only disconnect if no canvases left
      if (this.observedCanvases.size <= 1) {
        this.sharedResizeObserver.disconnect();
        this.sharedResizeObserver = null;
        if (this.debug) {
          console.log('[CanvasService] Shared ResizeObserver disconnected (no canvases left)');
        }
      }
    }
    this.resizeCallbacks.delete(canvas);
    const opts = this.observedCanvases.get(canvas);
    if (opts?.autoRelease) {
      this.releaseCanvas(canvas, { clear: true, removeFromDom: true });
    }
    this.observedCanvases.delete(canvas);
    // If no canvases left, clean up DPR listener
    if (this.observedCanvases.size === 0) {
      this.cleanupDPRListener();
    }
  }

  // Called when the DPR/media-query indicates a potential device-pixel change.
  private onDPRChange = (): void => {
    const newDPR = window.devicePixelRatio || 1;
    if (newDPR === this.scaleFactor) return;
    this.scaleFactor = newDPR;
    this.observedCanvases.forEach((opts, canvas) => {
      try {
        this.setHighDPISize(canvas, canvas.getBoundingClientRect());
      } catch (err) {
        console.warn('[CanvasService] onDPRChange failed for canvas', err);
      }
    });
    // Recreate listener for the new DPR value
    this.cleanupDPRListener();
    this.setupDPRListener();
  };

  private setupDPRListener(): void {
    try {
      this.cleanupDPRListener();
      const query = `(resolution: ${window.devicePixelRatio || 1}dppx)`;
      this.dprMediaQuery = window.matchMedia(query);
      if (this.dprMediaQuery) {
        // Modern browsers support addEventListener on MediaQueryList. Older
        // browsers use addListener/removeListener. Use small helpers to keep
        // typing clean.
        const addListener = (mql: MediaQueryList, cb: EventListenerOrEventListenerObject) => {
          if ('addEventListener' in mql) {
            (mql as unknown as EventTarget).addEventListener('change', cb);
          } else if ('addListener' in mql) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (mql as any).addListener(cb);
          }
        };
        addListener(this.dprMediaQuery, this.onDPRChange as EventListener);
      }
    } catch (err) {
      console.warn('[CanvasService] setupDPRListener failed', err);
    }
  }

  private cleanupDPRListener(): void {
    if (!this.dprMediaQuery) return;
    try {
      const removeListener = (mql: MediaQueryList, cb: EventListenerOrEventListenerObject) => {
        if ('removeEventListener' in mql) {
          (mql as unknown as EventTarget).removeEventListener('change', cb);
        } else if ('removeListener' in mql) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (mql as any).removeListener(cb);
        }
      };
      removeListener(this.dprMediaQuery, this.onDPRChange as EventListener);
    } catch { /* ignore */ }
    this.dprMediaQuery = null;
  }

  /**
   * Sets the canvas size to match the parent container size, accounting for high DPI displays.
   * This method should be called whenever the parent container is resized.
   *
   * @param canvas The canvas element to resize.
   * @param parentContainer The bounding rectangle of the parent container to use as our max canvas size.
  *
  * Note: `parentContainer` dimensions are CSS pixels. This method will set the
  * canvas backing store to device pixels (canvas.width/height = css * devicePixelRatio)
  * and set the canvas.style width/height to the CSS size. After calling this,
  * drawing into the 2D context may require scaling (the service handles that
  * for offscreen canvases by calling `setTransform` or `scale`).
   */
  public setHighDPISize(canvas: HTMLCanvasElement, parentContainer: DOMRectReadOnly): void {
    const cssWidth = Math.floor(parentContainer.width);
    const cssHeight = Math.floor(parentContainer.height);

    canvas.width = Math.round(cssWidth * this.scaleFactor);
    canvas.height = Math.round(cssHeight * this.scaleFactor);

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    // Ensure the on-screen canvas 2D context is transformed so callers can
    // draw using CSS-pixel coordinates. This makes public APIs consistent: all
    // drawing functions and callers may use CSS pixels and rely on the service
    // to handle device-pixel scaling.
    try {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(this.scaleFactor, 0, 0, this.scaleFactor, 0, 0);
        // Optionally clear the canvas to avoid drawing artifacts from previous transforms
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } catch (err) {
      // Defensive: if transform fails, don't block — drawing will still work but
      // callers must be aware of device pixels.
      console.warn('[CanvasService] setHighDPISize: failed to set context transform', err);
    }
  }

  /**
   * Draws the widget title on the canvas with optimal font size.
   * Used by the widget title component to render the title text.
   *
   * @param ctx The canvas rendering context.
   * @param text Text to be drawn on the canvas.
   * @param color Text color.
   * @param fontWeight Font weight (e.g., 'normal', 'bold').
   * @param canvasWidth The width of the canvas in CSS pixels.
   * @param canvasHeight The height of the canvas in CSS pixels.
  *
  * Units: `canvasWidth`/`canvasHeight` are expected to be CSS pixels. If the
  * provided context has already been transformed for device pixels (e.g. via
  * `ctx.setTransform(scale,0,0,scale,0,0)`), this method writes coordinates
  * in CSS pixel units (the service avoids multiplying offsets by DPR).
   */
  public drawTitle(
    ctx: CanvasRenderingContext2D,
    text: string,
    color: string,
    fontWeight = 'normal',
    canvasWidth: number,
    canvasHeight: number,
    titleFraction = 0.1 // default for widgets
  ): void {
    if (!ctx) return;
    const runDraw = () => {
      // The service contract: canvasWidth/canvasHeight are CSS pixels.
      // Ensure the context is in CSS-pixel user-space while measuring/drawing.
      let restored = false;
      try {
        const maybeCtx = ctx as CanvasRenderingContext2D & { getTransform?: () => DOMMatrix };
        if (typeof maybeCtx.getTransform === 'function') {
          const m = maybeCtx.getTransform();
          const currentScale = (m && m.a) ? m.a : 1;
          if (Math.abs(currentScale - this.scaleFactor) > 1e-6) {
            ctx.save();
            ctx.setTransform(this.scaleFactor, 0, 0, this.scaleFactor, 0, 0);
            restored = true;
          }
        } else {
          // Best-effort when getTransform isn't available: set transform
          try { ctx.save(); ctx.setTransform(this.scaleFactor, 0, 0, this.scaleFactor, 0, 0); restored = true; } catch { /* ignore */ }
        }

        this.drawTitleInternal(ctx, text, color, fontWeight, canvasWidth, canvasHeight, titleFraction);

        if (restored) ctx.restore();
      } catch (err) {
        console.warn('[CanvasService] drawTitle failed', err);
        try { this.drawTitleInternal(ctx, text, color, fontWeight, canvasWidth, canvasHeight, titleFraction); } catch { /* ignore */ }
      }
    };

    if (document.fonts.status === 'loaded') {
      this.fontsReadyPromise.then(() => requestAnimationFrame(runDraw)).catch(() => requestAnimationFrame(runDraw));
    } else {
      // If fonts not ready, schedule draw once fonts settle (and still use RAF)
      this.fontsReadyPromise
        .then(() => requestAnimationFrame(runDraw))
        .catch((err) => {
          console.warn(`[CanvasService] Font readiness failed: ${err}`);
          requestAnimationFrame(runDraw);
        });
    }
  }

  private drawTitleInternal(
    ctx: CanvasRenderingContext2D,
    text: string,
    color: string,
    fontWeight = 'normal',
    canvasWidth: number,
    canvasHeight: number,
    titleFraction: number
  ): void {
    if (!ctx) return;

    const maxWidth = canvasWidth - 2 * this.EDGE_BUFFER;
    const maxHeight = Math.floor(canvasHeight * titleFraction);
    const fontSize = this.calculateOptimalFontSize(ctx, text, maxWidth, maxHeight, fontWeight);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.font = `${fontWeight} ${fontSize}px ${this.DEFAULT_FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, this.EDGE_BUFFER, this.EDGE_BUFFER, maxWidth);
  }

  /**
   * Clears the entire canvas.
   *
   * @param ctx The canvas rendering context.
   * @param width The width of the canvas.
   * @param height The height of the canvas.
   */
  public clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.clearRect(0, 0, width, height);
  }


  /**
   * Draws text on the canvas as large as possible with optimal font size.
   *
   * @param ctx The canvas rendering context.
   * @param text The text to be drawn on the canvas.
   * @param x The x-coordinate left/right margins of the text (default: this.EDGE_BUFFER).
   * @param y The y-coordinate top/bottom margins of the text (default: this.EDGE_BUFFER).
   * @param maxWidth The maximum width of the text.
   * @param maxHeight The maximum height of the text.
   * @param fontWeight The font weight (e.g., 'normal', 'bold').
   * @param color The color of the text.
   * @param textAlign The text alignment (e.g., 'left', 'center', 'right').
   * @param textBaseline The text baseline (e.g., 'top', 'middle', 'bottom').
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
    const runDraw = () => {
      // Force the context into CSS-pixel user-space for measurement and drawing.
      try {
        ctx.save();
        ctx.setTransform(this.scaleFactor, 0, 0, this.scaleFactor, 0, 0);
        this.drawTextInternal(ctx, text, x, y, maxWidth, maxHeight, fontWeight, color, textAlign, textBaseline);
      } finally {
        try { ctx.restore(); } catch { /* ignore */ }
      }
    };

    if (document.fonts.status === 'loaded') {
      runDraw();
    } else {
      this.fontsReadyPromise
        .then(runDraw)
        .catch((err) => {
          console.warn(`[Canvas Service] Font readiness failed: ${err}`);
          runDraw();
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
   * @param ctx The canvas rendering context.
   * @param text The text to be measured.
   * @param maxWidth The maximum width of the text.
   * @param maxHeight The maximum height of the text.
   * @param fontWeight The font weight (e.g., 'normal', 'bold').
   * @returns The optimal font size in pixels.
  *
  * Units: `maxWidth` and `maxHeight` should be provided in CSS pixels when the
  * context has been transformed to device pixels (service methods generally
  * ensure the context transform so callers may pass CSS units).
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
   * Creates an offscreen canvas bitmap containing a title, matching the widget-title visual proportion.
   * The title occupancy is determined by drawTitle's default titleFraction.
   * The bitmap is allocated at device-pixel size for sharpness.
   *
   * @param text The title text to render.
   * @param color The color of the text.
   * @param fontWeight The font weight (e.g., 'normal', 'bold').
   * @param cssWidth The width of the widget (CSS pixels).
   * @param cssHeight The height of the widget (CSS pixels).
   * @returns The offscreen canvas element containing the rendered title.
  *
  * Units/contract: `cssWidth`/`cssHeight` are CSS pixels. The returned
  * canvas is backed by a device-pixel-sized backing store (its `.width` and
  * `.height` equal `css * devicePixelRatio`). The offscreen context is scaled
  * so drawing functions receive CSS-pixel coordinates.
   */
  public createTitleBitmap(
    text: string,
    color: string,
    fontWeight: string,
    cssWidth: number,
    cssHeight: number,
    titleFraction = 0.1
  ): HTMLCanvasElement {
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.round(cssWidth * this.scaleFactor);
    offscreen.height = Math.round(cssHeight * this.scaleFactor);
    offscreen.style.width = `${cssWidth}px`;
    offscreen.style.height = `${cssHeight}px`;

    const offCtx = offscreen.getContext('2d');
    if (offCtx) {
      offCtx.setTransform(this.scaleFactor, 0, 0, this.scaleFactor, 0, 0);
      // Use provided titleFraction (defaults to 0.1) for consistent appearance.
      // receive a visible bitmap even if web fonts are still loading.
      this.drawTitleInternal(offCtx, text, color, fontWeight, cssWidth, cssHeight, titleFraction);
      // If fonts are not yet ready, schedule a re-render when they load so
      // the offscreen bitmap updates with correct metrics. Widgets that cache
      // the returned canvas should redraw when they detect the bitmap changed.
      if (document.fonts.status !== 'loaded') {
        document.fonts.ready.then(() => {
          try {
            // re-scale in case DPR changed
            offCtx.setTransform(this.scaleFactor, 0, 0, this.scaleFactor, 0, 0);
            this.drawTitleInternal(offCtx, text, color, fontWeight, cssWidth, cssHeight, titleFraction);
          } catch { /* ignore */ }
        }).catch(() => { /* ignore */ });
      }
    }
    return offscreen;
  }

  /**
   * Renders static elements into an offscreen bitmap for caching.
   * The drawFn receives the offscreen context and draws everything that doesn't change frequently.
   *
   * @remarks
   * Use this method to pre-render static layers (e.g., gauge backgrounds, units labels, or other decorations)
   * that do not change often. Cache the returned canvas and draw it as an image to improve widget performance.
   *
   * @param ctx The canvas rendering context (not used, for API consistency).
   * @param width The width of the bitmap (CSS pixels).
   * @param height The height of the bitmap (CSS pixels).
   * @param drawFn Function that draws static content on the context.
   * @returns The offscreen canvas element containing the rendered static layer.
  *
  * Units/contract: `width`/`height` are CSS pixels. The returned canvas uses
  * a device-pixel backing store (width/height multiplied by devicePixelRatio)
  * and its context is scaled so the `drawFn` can draw in CSS pixel units.
   */
  public renderStaticToBitmap(ctx: CanvasRenderingContext2D, width: number, height: number, drawFn: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
    const offscreen = document.createElement('canvas');
    offscreen.width = width * this.scaleFactor;
    offscreen.height = height * this.scaleFactor;
    const offCtx = offscreen.getContext('2d');
    if (offCtx) {
      offCtx.setTransform(this.scaleFactor, 0, 0, this.scaleFactor, 0, 0);
      drawFn(offCtx);
    }
    return offscreen;
  }

  /**
   * Draws a rectangle on the canvas.
   *
   * @param ctx The canvas rendering context.
   * @param x The x-coordinate of the rectangle.
   * @param y The y-coordinate of the rectangle.
   * @param width The width of the rectangle.
   * @param height The height of the rectangle.
   * @param color The color of the rectangle.
   */
  public drawRectangle(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  /**
   * Proactively release a canvas backing store to reduce GPU/system memory pressure.
   * Steps:
   *  1. Optionally clear the current contents (default: true).
   *  2. Reset width/height to 0 (this drops the backing store allocations in browsers).
   *  3. Optionally remove the element from the DOM (default: true).
   *
   * @param canvas The canvas element.
   * @param opts Optional behavior flags. `removeFromDom` and `clear` both default to true.
   */
  public releaseCanvas(
    canvas: HTMLCanvasElement | undefined | null,
    opts: {
      removeFromDom?: boolean; // physically detach from its parent
      clear?: boolean;         // clear contents before resize (default true)
    } = { removeFromDom: true, clear: true }
  ): void {
    if (!canvas) return;
    const { removeFromDom = true, clear = true } = opts;
    try {
      const ctx = canvas.getContext('2d');
      if (clear && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      // Reset size to release backing store
      canvas.width = 0;
      canvas.height = 0;
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
