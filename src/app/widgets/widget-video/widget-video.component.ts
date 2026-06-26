import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked, viewChild
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import Hls from 'hls.js';
import { IVideoWidgetConfig, IWidgetSvcConfig, TSnapshotDestination } from '../../core/interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { ITheme } from '../../core/services/app-service';
import { DataService } from '../../core/services/data.service';
import { resolveVideoSourceUrl } from './video-source.util';
import {
  IPlaybackCapabilities, selectPlaybackPipeline, TPlaybackPipeline
} from './playback-pipeline.util';
import { mapPreset } from './playback-presets.util';
import { whepDelete, whepNegotiate, type FetchLike } from './whep.util';
import { applyJitter, backoffDelayMs, DEFAULT_BACKOFF, shouldReconnect } from './reconnect.util';
import {
  canShareSnapshot, captureVideoFrameJpegDataUrl, downloadBlob, shareSnapshot
} from './snapshot-image.util';
import { composeSnapshot } from './snapshot.util';

const fetchLike: FetchLike = (url, init) => fetch(url, init);

/**
 * Video widget. Plays a configured source through the right browser pipeline — a progressive file or
 * native HLS in `<video>`, HLS via hls.js, MJPEG in `<img>`, or low-latency WebRTC (WHEP) — with
 * quality/latency presets, native + overlay controls (PiP, fullscreen) and telemetry snapshots.
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
      transport: 'auto',
      preset: 'balanced',
      muted: true,
      autoplay: false,
      loop: false,
      objectFit: 'contain',
      snapshot: { embedTelemetry: true, embedLocation: true, defaultDestination: 'download' }
    }
  };

  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly data = inject(DataService);

  protected readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoEl');

  private readonly capabilities: IPlaybackCapabilities = {
    hasMediaSource: typeof window !== 'undefined' && 'MediaSource' in window,
    hlsJsSupported: Hls.isSupported(),
    nativeHls: (() => {
      const v = document.createElement('video');
      return !!v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl') !== '';
    })()
  };
  private readonly isWebkit =
    typeof navigator !== 'undefined' && /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

  protected readonly videoConfig = computed<IVideoWidgetConfig | null>(() => this.runtime.options()?.video ?? null);
  protected readonly sourceUrl = computed<string | null>(
    () => resolveVideoSourceUrl(this.videoConfig(), window.location.origin)
  );
  protected readonly pipeline = computed<TPlaybackPipeline | null>(() => {
    const cfg = this.videoConfig();
    const url = this.sourceUrl();
    if (!cfg || !url) {
      return null;
    }
    return selectPlaybackPipeline(cfg.transport ?? 'auto', url, this.capabilities);
  });
  private readonly presetTuning = computed(() => mapPreset(this.videoConfig()?.preset ?? 'balanced'));

  protected readonly isVideoPipeline = computed(() => {
    const p = this.pipeline();
    return p === 'file' || p === 'hls-native' || p === 'hls-hlsjs' || p === 'webrtc';
  });
  private readonly isLive = computed(() => {
    const p = this.pipeline();
    return p === 'hls-native' || p === 'hls-hlsjs' || p === 'webrtc' || p === 'mjpeg';
  });
  protected readonly objectFit = computed(() => this.videoConfig()?.objectFit ?? 'contain');
  protected readonly muted = computed(() => this.videoConfig()?.muted ?? true);
  protected readonly autoplay = computed(() => this.videoConfig()?.autoplay || this.isLive());
  protected readonly loop = computed(() => this.videoConfig()?.loop ?? false);
  protected readonly showMjpegWarning = computed(() => this.pipeline() === 'mjpeg' && this.isWebkit);

  protected readonly snapshotError = signal<string | null>(null);
  protected readonly playbackError = signal<string | null>(null);
  protected readonly canRetry = signal(false);
  /** Live pipelines are torn down while the page/dashboard is hidden to save decoders, battery and heat. */
  private readonly visible = signal(typeof document === 'undefined' || !document.hidden);
  private readonly reconnectNonce = signal(0);
  protected readonly canPip = typeof document !== 'undefined' && !!document.pictureInPictureEnabled;
  protected readonly canFullscreen =
    typeof document !== 'undefined' && (!!document.fullscreenEnabled ||
      typeof (document.createElement('video') as unknown as { webkitEnterFullscreen?: unknown }).webkitEnterFullscreen === 'function');
  protected readonly canShare = canShareSnapshot();

  private generation = 0;
  private hls: Hls | null = null;
  private pc: RTCPeerConnection | null = null;
  private whepResource: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private boundVideo: HTMLVideoElement | null = null;

  constructor() {
    // (Re)attach the right pipeline whenever the source, transport, preset or visibility changes — or
    // once the <video> element is rendered, or a reconnect is requested. A generation token prevents
    // stale async callbacks from resurrecting a torn-down pipeline.
    effect(() => {
      const url = this.sourceUrl();
      const pipe = this.pipeline();
      const tuning = this.presetTuning();
      const video = this.videoRef()?.nativeElement ?? null;
      const visible = this.visible();
      this.reconnectNonce();
      untracked(() => {
        // Tear down live pipelines while hidden; keep file playback (native <video> pauses itself).
        if (!visible && this.isLive()) {
          this.dispose();
          return;
        }
        void this.attach(url, pipe, tuning, video);
      });
    });

    const onVisibility = () => this.visible.set(!document.hidden);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    inject(DestroyRef).onDestroy(() => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      this.dispose();
    });
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Successful playback resets the reconnect state. */
  private readonly onPlaying = (): void => {
    this.reconnectAttempt = 0;
    this.canRetry.set(false);
    this.playbackError.set(null);
    this.clearReconnectTimer();
  };

  /** `<video>` error handling: terminal for files, reconnect for native HLS. */
  private readonly onError = (): void => {
    const pipe = this.pipeline();
    if (pipe === 'file') {
      this.playbackError.set('Could not load this video.');
    } else if (pipe === 'hls-native') {
      this.scheduleReconnect(this.generation);
    }
    // hls.js and WebRTC report errors through their own handlers.
  };

  /** Schedules a backed-off reconnect for a recoverable error, or surfaces a manual Retry. */
  private scheduleReconnect(gen: number): void {
    if (this.generation !== gen) {
      return;
    }
    this.reconnectAttempt++;
    if (!shouldReconnect(this.reconnectAttempt, DEFAULT_BACKOFF)) {
      this.canRetry.set(true);
      this.playbackError.set('Stream lost. Check the camera, then tap Retry.');
      return;
    }
    const delay = applyJitter(
      backoffDelayMs(this.reconnectAttempt, DEFAULT_BACKOFF),
      DEFAULT_BACKOFF.jitterRatio,
      Math.random
    );
    this.playbackError.set(`Reconnecting… (attempt ${this.reconnectAttempt})`);
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      if (this.generation === gen) {
        this.reconnectNonce.update(n => n + 1);
      }
    }, delay);
  }

  /** Manual retry after the automatic attempts are exhausted. */
  protected retry(): void {
    this.reconnectAttempt = 0;
    this.canRetry.set(false);
    this.playbackError.set(null);
    this.reconnectNonce.update(n => n + 1);
  }

  private dispose(): void {
    this.generation++;
    this.clearReconnectTimer();
    if (this.boundVideo) {
      this.boundVideo.removeEventListener('playing', this.onPlaying);
      this.boundVideo.removeEventListener('error', this.onError);
      this.boundVideo = null;
    }
    if (this.hls) {
      try { this.hls.destroy(); } catch { /* ignore */ }
      this.hls = null;
    }
    if (this.pc) {
      try {
        this.pc.getReceivers().forEach(r => r.track?.stop());
        this.pc.close();
      } catch { /* ignore */ }
      this.pc = null;
    }
    if (this.whepResource) {
      // Best-effort session teardown that survives navigation, so go2rtc doesn't leak the consumer
      // and keep the camera streaming.
      try { fetch(this.whepResource, { method: 'DELETE', keepalive: true }); } catch { /* ignore */ }
      this.whepResource = null;
    }
    const v = this.videoRef()?.nativeElement;
    if (v) {
      try { v.pause(); } catch { /* ignore */ }
      v.removeAttribute('src');
      v.srcObject = null;
      try { v.load(); } catch { /* ignore */ }
    }
  }

  private async attach(
    url: string | null,
    pipe: TPlaybackPipeline | null,
    tuning: ReturnType<typeof mapPreset>,
    video: HTMLVideoElement | null
  ): Promise<void> {
    this.dispose();
    this.playbackError.set(null);
    const gen = this.generation;
    if (!url || !pipe) {
      return;
    }
    if (pipe === 'unsupported') {
      this.playbackError.set('This stream type is not supported in this browser.');
      return;
    }
    if (pipe === 'mjpeg' || !video) {
      return; // MJPEG renders via <img>; other pipelines need the <video> element.
    }

    video.addEventListener('playing', this.onPlaying);
    video.addEventListener('error', this.onError);
    this.boundVideo = video;

    switch (pipe) {
      case 'file':
      case 'hls-native':
        video.src = url;
        break;
      case 'hls-hlsjs': {
        const hls = new Hls({
          lowLatencyMode: tuning.hls.lowLatencyMode,
          liveSyncDurationCount: tuning.hls.liveSyncDurationCount,
          maxLiveSyncPlaybackRate: tuning.hls.maxLiveSyncPlaybackRate,
          backBufferLength: tuning.hls.backBufferLength,
          maxBufferLength: tuning.hls.maxBufferLength
        });
        this.hls = hls;
        hls.on(Hls.Events.ERROR, (_e, errData) => {
          if (errData.fatal && this.generation === gen) {
            this.scheduleReconnect(gen);
          }
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        break;
      }
      case 'webrtc':
        await this.attachWhep(url, video, tuning.jitterBufferTargetMs, gen);
        break;
    }
  }

  private async attachWhep(endpoint: string, video: HTMLVideoElement, jitterMs: number, gen: number): Promise<void> {
    const pc = new RTCPeerConnection();
    this.pc = pc;
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.ontrack = (e) => {
      if (this.generation === gen) {
        video.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      }
    };
    pc.addEventListener('iceconnectionstatechange', () => {
      if (pc.iceConnectionState === 'failed' && this.generation === gen) {
        this.scheduleReconnect(gen);
      }
    });
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.waitForIceGathering(pc);
      if (this.generation !== gen) {
        return;
      }
      const { answerSdp, resourceUrl } = await whepNegotiate(endpoint, pc.localDescription?.sdp ?? offer.sdp ?? '', fetchLike);
      this.whepResource = resourceUrl;
      if (this.generation !== gen) {
        // Disposed mid-negotiation — release the session we just created.
        void whepDelete(resourceUrl, fetchLike).catch(() => undefined);
        return;
      }
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      for (const r of pc.getReceivers()) {
        try {
          (r as unknown as { jitterBufferTarget?: number }).jitterBufferTarget = jitterMs;
        } catch { /* unsupported (e.g. Safari) — ignore */ }
      }
    } catch {
      if (this.generation === gen) {
        this.playbackError.set('Could not connect to the WebRTC stream.');
      }
    }
  }

  private waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 2000): Promise<void> {
    if (pc.iceGatheringState === 'complete') {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const finish = () => {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      };
      const check = () => {
        if (pc.iceGatheringState === 'complete') {
          finish();
        }
      };
      pc.addEventListener('icegatheringstatechange', check);
      setTimeout(finish, timeoutMs);
    });
  }

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
    } catch { /* not allowed — ignore */ }
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
    } catch { /* ignore */ }
  }
}
