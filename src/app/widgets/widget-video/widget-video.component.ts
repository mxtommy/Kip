import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IVideoWidgetConfig, IWidgetSvcConfig, TSnapshotDestination } from '../../core/interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { ITheme } from '../../core/services/app-service';
import { DataService } from '../../core/services/data.service';
import { resolveVideoSourceUrl } from './video-source.util';
import {
  canShareSnapshot, captureVideoFrameJpegDataUrl, downloadBlob, shareSnapshot
} from './snapshot-image.util';
import { composeSnapshot } from './snapshot.util';

/**
 * Video widget: plays a browser-playable video from a configured URL using the native `<video>`
 * element and its built-in controls, plus overlay controls for Picture-in-Picture, fullscreen, and
 * a telemetry-tagged snapshot. IP-camera streaming, ONVIF PTZ and uploads are layered on later.
 */
@Component({
  selector: 'widget-video',
  templateUrl: './widget-video.component.html',
  styleUrls: ['./widget-video.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule]
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
      objectFit: 'contain',
      snapshot: {
        embedTelemetry: true,
        embedLocation: true,
        defaultDestination: 'download'
      }
    }
  };

  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly data = inject(DataService);

  protected readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoEl');

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

  protected readonly snapshotError = signal<string | null>(null);
  protected readonly canPip = typeof document !== 'undefined' && !!document.pictureInPictureEnabled;
  protected readonly canFullscreen =
    typeof document !== 'undefined' && (!!document.fullscreenEnabled ||
      typeof (document.createElement('video') as unknown as { webkitEnterFullscreen?: unknown }).webkitEnterFullscreen === 'function');
  protected readonly canShare = canShareSnapshot();

  protected async takeSnapshot(destination?: TSnapshotDestination): Promise<void> {
    const video = this.videoRef()?.nativeElement;
    if (!video) {
      return;
    }
    const snap = this.videoConfig()?.snapshot;
    const dest = destination ?? snap?.defaultDestination ?? 'download';
    try {
      const jpegDataUrl = captureVideoFrameJpegDataUrl(video, 0.92);
      const result = composeSnapshot(jpegDataUrl, (path) => this.data.getPathObject(path), {
        now: new Date(),
        embedTelemetry: snap?.embedTelemetry ?? true,
        embedLocation: snap?.embedLocation ?? true,
        cameraName: this.runtime.options()?.displayName ?? null
      });
      if (dest === 'share' && this.canShare) {
        await shareSnapshot(result.blob, result.filename);
      } else {
        downloadBlob(result.blob, result.filename);
      }
      this.snapshotError.set(null);
    } catch (err) {
      // A tainted canvas (cross-origin source without CORS) throws here.
      const isSecurity = err instanceof DOMException && err.name === 'SecurityError';
      this.snapshotError.set(
        isSecurity
          ? 'Snapshot is not available for this source (cross-origin without CORS).'
          : 'Snapshot failed.'
      );
    }
  }

  protected async togglePip(): Promise<void> {
    const video = this.videoRef()?.nativeElement;
    if (!video) {
      return;
    }
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      /* user gesture / not allowed — ignore */
    }
  }

  protected async toggleFullscreen(): Promise<void> {
    const video = this.videoRef()?.nativeElement;
    if (!video) {
      return;
    }
    const iosVideo = video as unknown as { webkitEnterFullscreen?: () => void };
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (video.requestFullscreen) {
        await video.requestFullscreen();
      } else if (typeof iosVideo.webkitEnterFullscreen === 'function') {
        iosVideo.webkitEnterFullscreen();
      }
    } catch {
      /* ignore */
    }
  }
}
