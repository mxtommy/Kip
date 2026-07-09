import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { KipResizeObserverDirective, IKipResizeEvent } from '../../core/directives/kip-resize-observer.directive';
import { ImageAssetService } from '../../core/services/image-asset.service';
import { ITheme } from '../../core/services/app-service';

/**
 * Displays a user-uploaded image asset (stored on the Signal K server) scaled to fit the widget
 * while preserving aspect ratio (object-fit), over a configurable background (transparent by default).
 * Requests a variant matched to the container width so a small widget doesn't fetch a full-res image.
 */
@Component({
  selector: 'widget-image',
  templateUrl: './widget-image.component.html',
  styleUrls: ['./widget-image.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KipResizeObserverDirective]
})
export class WidgetImageComponent {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly images = inject(ImageAssetService);

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    image: { imageId: null, imageFit: 'contain', altText: '', backgroundColor: null }
  };

  private readonly containerWidth = signal<number>(0);
  /** True when the <img> fails to load (e.g. the shared image was deleted from another display, or
   *  the server is briefly unreachable). Self-clears: the <img> stays mounted, so a later successful
   *  (load) — including after the URL changes on resize — resets it. */
  protected readonly loadFailed = signal(false);

  protected readonly imageConfig = computed(() => this.runtime.options()?.image ?? null);
  protected readonly altText = computed(() => this.imageConfig()?.altText ?? '');
  protected readonly objectFit = computed(() => this.imageConfig()?.imageFit ?? 'contain');
  protected readonly background = computed(() => this.imageConfig()?.backgroundColor ?? 'transparent');

  protected readonly imageUrl = computed<string | null>(() => {
    const id = this.imageConfig()?.imageId;
    if (!id) return null;
    // Before the first ResizeObserver measurement the width is 0. Request the SMALLEST variant then
    // (width 1 snaps up to the smallest allow-listed width) rather than letting an unknown width
    // default to the largest — a full-res fetch on first paint would be immediately superseded once
    // the real container width is known. The tiny first request is cheap and upgrades on resize.
    return this.images.urlFor(id, this.containerWidth() || 1);
  });

  protected onResize(event: IKipResizeEvent): void {
    this.containerWidth.set(Math.round(event.width));
  }
}
