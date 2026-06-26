import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked, viewChild
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import Hls from 'hls.js';
import { IVideoWidgetConfig, IWidgetSvcConfig, TSnapshotDestination } from '../../core/interfaces/widgets-interface';
import { toSignal } from '@angular/core/rxjs-interop';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { ITheme } from '../../core/services/app-service';
import { DataService } from '../../core/services/data.service';
import { SignalKConnectionService } from '../../core/services/signalk-connection.service';
import { resolveSignalKPluginBaseUrl } from '../../core/utils/signalk-plugin-url.util';
import { resolveVideoSourceUrl } from './video-source.util';
import { resolveGatewaySourceUrl } from './gateway-source.util';
import { PtzClient, type IPtzPreset } from './ptz-client';
import { VideoAssetsClient } from './video-assets-client';
import {
  IPlaybackCapabilities, selectPlaybackPipeline, TPlaybackPipeline
} from './playback-pipeline.util';
import { mapPreset } from './playback-presets.util';
import { whepDelete, whepNegotiate, type FetchLike } from './whep.util';
import { applyJitter, backoffDelayMs, DEFAULT_BACKOFF, shouldReconnect } from './reconnect.util';
import { evaluateFirstFrame } from './first-frame.util';
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
  private readonly connection = inject(SignalKConnectionService);
  private readonly ptz = inject(PtzClient);
  private readonly assets = inject(VideoAssetsClient);

  /** sk-video plugin base URL, tracked from the active server endpoint. */
  private readonly endpoint = toSignal(this.connection.serverServiceEndpoint$, { initialValue: null });
  protected readonly gatewayBaseUrl = computed<string | null>(() =>
    resolveSignalKPluginBaseUrl(
      'sk-video',
      this.endpoint()?.httpServiceUrl ?? null,
      this.connection.signalKURL?.url ?? null
    )
  );

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
  protected readonly sourceUrl = computed<string | null>(() => {
    const cfg = this.videoConfig();
    const kind = cfg?.sourceKind ?? 'url';
    if (kind === 'camera') {
      return resolveGatewaySourceUrl(cfg, this.gatewayBaseUrl());
    }
    if (kind === 'file') {
      return this.assets.playbackUrl(this.gatewayBaseUrl(), cfg?.fileAssetId ?? null);
    }
    return resolveVideoSourceUrl(cfg, window.location.origin);
  });
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
  protected readonly codecWarning = signal<string | null>(null);
  protected readonly canRetry = signal(false);
  /** Live pipelines are torn down while the page/dashboard is hidden to save decoders, battery and heat. */
  private readonly visible = signal(typeof document === 'undefined' || !document.hidden);
  private readonly reconnectNonce = signal(0);
  protected readonly canPip = typeof document !== 'undefined' && !!document.pictureInPictureEnabled;
  protected readonly canFullscreen =
    typeof document !== 'undefined' && (!!document.fullscreenEnabled ||
      typeof (document.createElement('video') as unknown as { webkitEnterFullscreen?: unknown }).webkitEnterFullscreen === 'function');
  protected readonly canShare = canShareSnapshot();

  /** PTZ controls are offered for a saved camera served through the gateway. */
  protected readonly showPtz = computed(
    () =>
      (this.videoConfig()?.sourceKind ?? 'url') === 'camera' &&
      !!this.gatewayBaseUrl() &&
      !!this.videoConfig()?.cameraId
  );
  protected readonly ptzPresets = signal<IPtzPreset[]>([]);
  protected readonly ptzError = signal<string | null>(null);
  /** Re-sent while a direction is held to defeat the gateway's auto-stop safety timeout. */
  private ptzKeepAlive: ReturnType<typeof setInterval> | null = null;
  private static readonly PTZ_KEEPALIVE_MS = 1200;

  private generation = 0;
  private hls: Hls | null = null;
  private pc: RTCPeerConnection | null = null;
  private whepResource: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private boundVideo: HTMLVideoElement | null = null;
  private firstFrameTimer: ReturnType<typeof setTimeout> | null = null;
  private rvfcHandle: number | null = null;
  private paintedFrame = false;
  private static readonly FIRST_FRAME_TIMEOUT_MS = 8000;

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

    // Load the camera's presets whenever a PTZ-capable camera source becomes active.
    effect(() => {
      const enabled = this.showPtz();
      const base = this.gatewayBaseUrl();
      const id = this.videoConfig()?.cameraId ?? null;
      untracked(() => {
        if (!enabled) {
          this.ptzPresets.set([]);
          return;
        }
        this.ptz
          .listPresets(base, id)
          .then((presets) => this.ptzPresets.set(presets))
          .catch(() => this.ptzPresets.set([]));
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
      this.stopPtzKeepAlive();
      this.dispose();
    });
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Successful playback resets the reconnect + first-frame state. */
  private readonly onPlaying = (): void => {
    this.reconnectAttempt = 0;
    this.canRetry.set(false);
    this.playbackError.set(null);
    this.paintedFrame = true;
    this.codecWarning.set(null);
    this.clearReconnectTimer();
    this.clearFirstFrameWatchdog();
  };

  /** Watches for a first painted frame; if none arrives while data is flowing, warns about the codec. */
  private startFirstFrameWatchdog(video: HTMLVideoElement, gen: number): void {
    this.clearFirstFrameWatchdog();
    this.paintedFrame = false;
    const rvfc = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    if (typeof rvfc.requestVideoFrameCallback === 'function') {
      this.rvfcHandle = rvfc.requestVideoFrameCallback(() => {
        if (this.generation === gen) {
          this.paintedFrame = true;
        }
      });
    }
    this.firstFrameTimer = setTimeout(() => {
      if (this.generation !== gen) {
        return;
      }
      const painted = this.paintedFrame || video.videoWidth > 0;
      const verdict = evaluateFirstFrame({ paintedFrame: painted, hasData: video.readyState >= 2, timedOut: true });
      if (verdict === 'no-decode') {
        this.codecWarning.set(
          'No picture — this device may not be able to decode this video (e.g. HEVC/H.265). Try a different stream or quality.'
        );
      }
    }, WidgetVideoComponent.FIRST_FRAME_TIMEOUT_MS);
  }

  private clearFirstFrameWatchdog(): void {
    if (this.firstFrameTimer) {
      clearTimeout(this.firstFrameTimer);
      this.firstFrameTimer = null;
    }
    if (this.rvfcHandle != null && this.boundVideo) {
      const v = this.boundVideo as HTMLVideoElement & { cancelVideoFrameCallback?: (h: number) => void };
      try { v.cancelVideoFrameCallback?.(this.rvfcHandle); } catch { /* ignore */ }
    }
    this.rvfcHandle = null;
  }

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

  /** Press-and-hold a direction: start moving and keep re-sending until released. */
  protected ptzStart(pan: number, tilt: number, zoom: number): void {
    this.stopPtzKeepAlive();
    const send = () => {
      void this.ptz
        .move(this.gatewayBaseUrl(), this.videoConfig()?.cameraId ?? null, { pan, tilt, zoom })
        .then(() => this.ptzError.set(null))
        .catch(() => this.ptzError.set('Camera move failed'));
    };
    send();
    this.ptzKeepAlive = setInterval(send, WidgetVideoComponent.PTZ_KEEPALIVE_MS);
  }

  /** Release: stop the keep-alive and command the camera to stop. */
  protected ptzStop(): void {
    if (!this.ptzKeepAlive) {
      return; // not currently moving — avoid spurious stop commands (e.g. pointerleave without press)
    }
    this.stopPtzKeepAlive();
    void this.ptz
      .stop(this.gatewayBaseUrl(), this.videoConfig()?.cameraId ?? null)
      .catch(() => undefined);
  }

  /** Recall a preset by token. */
  protected ptzGoto(token: string): void {
    void this.ptz
      .gotoPreset(this.gatewayBaseUrl(), this.videoConfig()?.cameraId ?? null, token)
      .then(() => this.ptzError.set(null))
      .catch(() => this.ptzError.set('Could not recall preset'));
  }

  private stopPtzKeepAlive(): void {
    if (this.ptzKeepAlive) {
      clearInterval(this.ptzKeepAlive);
      this.ptzKeepAlive = null;
    }
  }

  private dispose(): void {
    this.generation++;
    this.clearReconnectTimer();
    this.clearFirstFrameWatchdog();
    this.codecWarning.set(null);
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
    this.startFirstFrameWatchdog(video, gen);

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
    if (typeof RTCPeerConnection === 'undefined') {
      this.playbackError.set('WebRTC is not supported in this browser.');
      return;
    }
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
