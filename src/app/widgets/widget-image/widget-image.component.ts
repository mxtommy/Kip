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

  protected readonly imageConfig = computed(() => this.runtime.options()?.image ?? null);
  protected readonly altText = computed(() => this.imageConfig()?.altText ?? '');
  protected readonly objectFit = computed(() => this.imageConfig()?.imageFit ?? 'contain');
  protected readonly background = computed(() => this.imageConfig()?.backgroundColor ?? 'transparent');

  protected readonly imageUrl = computed<string | null>(() => {
    const id = this.imageConfig()?.imageId;
    if (!id) return null;
    return this.images.urlFor(id, this.containerWidth());
  });

  protected onResize(event: IKipResizeEvent): void {
    this.containerWidth.set(Math.round(event.width));
  }
}
