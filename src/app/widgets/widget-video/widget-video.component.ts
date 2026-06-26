import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { IVideoWidgetConfig, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { ITheme } from '../../core/services/app-service';
import { resolveVideoSourceUrl } from './video-source.util';

/**
 * Video widget: plays a browser-playable video from a configured URL using the native `<video>`
 * element and its built-in controls. IP-camera streaming (via the SK Video gateway), ONVIF PTZ,
 * uploads, and telemetry snapshots are layered on in later updates.
 */
@Component({
  selector: 'widget-video',
  templateUrl: './widget-video.component.html',
  styleUrls: ['./widget-video.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetVideoComponent {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    video: {
      sourceKind: 'url',
      url: null,
      muted: true,
      autoplay: false,
      loop: false,
      objectFit: 'contain'
    }
  };

  protected readonly runtime = inject(WidgetRuntimeDirective);

  protected readonly videoConfig = computed<IVideoWidgetConfig | null>(
    () => this.runtime.options()?.video ?? null
  );
  protected readonly sourceUrl = computed<string | null>(
    () => resolveVideoSourceUrl(this.videoConfig(), window.location.origin)
  );
  protected readonly objectFit = computed(() => this.videoConfig()?.objectFit ?? 'contain');
  protected readonly muted = computed(() => this.videoConfig()?.muted ?? true);
  protected readonly autoplay = computed(() => this.videoConfig()?.autoplay ?? false);
  protected readonly loop = computed(() => this.videoConfig()?.loop ?? false);
}
