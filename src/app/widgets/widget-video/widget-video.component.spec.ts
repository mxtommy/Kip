import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { WidgetVideoComponent } from './widget-video.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { DataService } from '../../core/services/data.service';
import { SignalKConnectionService } from '../../core/services/signalk-connection.service';
import { PluginConfigClientService } from '../../core/services/plugin-config-client.service';
import { PtzClient } from './ptz-client';
import type { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';

// The global test stub reports the sk-video plugin as NOT installed (getPlugin -> not-found). These
// helpers override it for tests that need the plugin to look present/disabled.
function pluginAvailable() {
  return { getPlugin: vi.fn().mockResolvedValue({ ok: true, data: { state: { enabled: true } }, capabilities: {} }) };
}
function pluginDisabled() {
  return { getPlugin: vi.fn().mockResolvedValue({ ok: true, data: { state: { enabled: false } }, capabilities: {} }) };
}
function pluginNotFound() {
  return {
    getPlugin: vi.fn().mockResolvedValue({
      ok: false,
      error: { reason: 'not-found', statusCode: 404, message: 'not found' },
      capabilities: {}
    })
  };
}
/** Flush microtasks + a macrotask so the async plugin probe settles before asserting. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup(config: IWidgetSvcConfig) {
  const options = signal<IWidgetSvcConfig | undefined>(config);
  TestBed.configureTestingModule({
    imports: [WidgetVideoComponent],
    providers: [
      { provide: WidgetRuntimeDirective, useValue: { options } },
      { provide: DataService, useValue: { getPathObject: () => null } }
    ]
  });
  const fixture = TestBed.createComponent(WidgetVideoComponent);
  fixture.componentRef.setInput('id', 'test-id');
  fixture.componentRef.setInput('type', 'widget-video');
  fixture.componentRef.setInput('theme', null);
  fixture.detectChanges();
  // The <video> source is attached by an effect once the element is rendered; flush it.
  fixture.detectChanges();
  return fixture;
}

describe('WidgetVideoComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders the empty state when no source URL is configured', () => {
    const el: HTMLElement = setup({ video: { sourceKind: 'url', url: null } }).nativeElement;
    expect(el.querySelector('video')).toBeNull();
    expect(el.querySelector('.video-widget__empty')).not.toBeNull();
  });

  it('renders a <video> bound to the configured URL with a snapshot control', () => {
    const el: HTMLElement = setup({ video: { sourceKind: 'url', url: 'https://cam.example/clip.mp4' } }).nativeElement;
    const video = el.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('https://cam.example/clip.mp4');
    expect(el.querySelector('.video-widget__empty')).toBeNull();
    expect(el.querySelector('button[aria-label="Take snapshot"]')).not.toBeNull();
  });

  it('does not play unsupported source kinds yet (no <video> for a manual/RTSP source)', () => {
    const el: HTMLElement = setup({ video: { sourceKind: 'manual', url: 'rtsp://cam/stream' } }).nativeElement;
    expect(el.querySelector('video')).toBeNull();
    expect(el.querySelector('.video-widget__empty')).not.toBeNull();
  });

  it('resolves a camera source to the same-origin sk-video gateway URL', () => {
    const options = signal<IWidgetSvcConfig | undefined>({
      video: { sourceKind: 'camera', cameraId: 'foredeck', transport: 'auto' }
    });
    TestBed.configureTestingModule({
      imports: [WidgetVideoComponent],
      providers: [
        { provide: WidgetRuntimeDirective, useValue: { options } },
        { provide: DataService, useValue: { getPathObject: () => null } },
        {
          provide: SignalKConnectionService,
          useValue: {
            serverServiceEndpoint$: of({ httpServiceUrl: 'http://boat.local:3000/signalk/v1/api/' }),
            signalKURL: { url: null }
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(WidgetVideoComponent);
    fixture.componentRef.setInput('id', 'test-id');
    fixture.componentRef.setInput('type', 'widget-video');
    fixture.componentRef.setInput('theme', null);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { sourceUrl: () => string | null };
    expect(cmp.sourceUrl()).toBe(
      'http://boat.local:3000/plugins/sk-video/cameras/foredeck/stream.m3u8'
    );
  });

  it('resolves an uploaded file source to the same-origin video URL', () => {
    const options = signal<IWidgetSvcConfig | undefined>({
      video: { sourceKind: 'file', fileAssetId: 'v1' }
    });
    TestBed.configureTestingModule({
      imports: [WidgetVideoComponent],
      providers: [
        { provide: WidgetRuntimeDirective, useValue: { options } },
        { provide: DataService, useValue: { getPathObject: () => null } },
        {
          provide: SignalKConnectionService,
          useValue: {
            serverServiceEndpoint$: of({ httpServiceUrl: 'http://boat.local:3000/signalk/v1/api/' }),
            signalKURL: { url: null }
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(WidgetVideoComponent);
    fixture.componentRef.setInput('id', 'test-id');
    fixture.componentRef.setInput('type', 'widget-video');
    fixture.componentRef.setInput('theme', null);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { sourceUrl: () => string | null };
    expect(cmp.sourceUrl()).toBe('http://boat.local:3000/plugins/sk-video/videos/v1');
  });

  it('shows PTZ controls and loads presets for a camera source', async () => {
    const ptz = {
      listPresets: vi.fn().mockResolvedValue([{ name: 'Dock', token: 't1' }]),
      move: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      gotoPreset: vi.fn().mockResolvedValue(undefined)
    };
    // webrtc transport gives an active video pipeline in jsdom (HLS reports unsupported there).
    const options = signal<IWidgetSvcConfig | undefined>({
      video: { sourceKind: 'camera', cameraId: 'foredeck', transport: 'webrtc' }
    });
    TestBed.configureTestingModule({
      imports: [WidgetVideoComponent],
      providers: [
        { provide: WidgetRuntimeDirective, useValue: { options } },
        { provide: DataService, useValue: { getPathObject: () => null } },
        { provide: PtzClient, useValue: ptz },
        { provide: PluginConfigClientService, useValue: pluginAvailable() },
        {
          provide: SignalKConnectionService,
          useValue: {
            serverServiceEndpoint$: of({ httpServiceUrl: 'http://boat.local:3000/signalk/v1/api/' }),
            signalKURL: { url: null }
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(WidgetVideoComponent);
    fixture.componentRef.setInput('id', 'test-id');
    fixture.componentRef.setInput('type', 'widget-video');
    fixture.componentRef.setInput('theme', null);
    fixture.detectChanges();
    await flush(); // let the plugin probe + listPresets resolve
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('button[aria-label="Pan left"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Tilt up"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Zoom in"]')).not.toBeNull();
    expect(ptz.listPresets).toHaveBeenCalledWith('http://boat.local:3000/plugins/sk-video/', 'foredeck');
    expect(el.querySelector('button[aria-label="Camera presets"]')).not.toBeNull();

    const cmp = fixture.componentInstance as unknown as { ptzGoto: (t: string) => void };
    cmp.ptzGoto('t1');
    expect(ptz.gotoPreset).toHaveBeenCalledWith('http://boat.local:3000/plugins/sk-video/', 'foredeck', 't1');
  });

  it('PTZ keyboard: Tab does not pan, Enter does, and blur stops (runaway guard)', async () => {
    const ptz = {
      listPresets: vi.fn().mockResolvedValue([]),
      move: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      gotoPreset: vi.fn().mockResolvedValue(undefined)
    };
    const options = signal<IWidgetSvcConfig | undefined>({
      video: { sourceKind: 'camera', cameraId: 'foredeck', transport: 'webrtc' }
    });
    TestBed.configureTestingModule({
      imports: [WidgetVideoComponent],
      providers: [
        { provide: WidgetRuntimeDirective, useValue: { options } },
        { provide: DataService, useValue: { getPathObject: () => null } },
        { provide: PtzClient, useValue: ptz },
        { provide: PluginConfigClientService, useValue: pluginAvailable() },
        {
          provide: SignalKConnectionService,
          useValue: {
            serverServiceEndpoint$: of({ httpServiceUrl: 'http://boat.local:3000/signalk/v1/api/' }),
            signalKURL: { url: null }
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(WidgetVideoComponent);
    fixture.componentRef.setInput('id', 'test-id');
    fixture.componentRef.setInput('type', 'widget-video');
    fixture.componentRef.setInput('theme', null);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const base = 'http://boat.local:3000/plugins/sk-video/';
    const left = (fixture.nativeElement as HTMLElement).querySelector(
      'button[aria-label="Pan left"]'
    ) as HTMLButtonElement;
    expect(left).not.toBeNull();

    // The old bug: a bare (keydown) started a pan on ANY key, including Tab.
    left.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(ptz.move).not.toHaveBeenCalled();

    // Enter (or Space) starts the pan…
    left.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(ptz.move).toHaveBeenCalledWith(base, 'foredeck', { pan: -1, tilt: 0, zoom: 0 });

    // …and losing focus stops it even if keyup never arrives.
    left.dispatchEvent(new FocusEvent('blur'));
    expect(ptz.stop).toHaveBeenCalledWith(base, 'foredeck');
  });

  it('renders an optional title bar above the video', () => {
    const el: HTMLElement = setup({
      video: { sourceKind: 'url', url: 'https://cam.example/clip.mp4', label: 'Foredeck' }
    }).nativeElement;
    expect(el.querySelector('.video-widget__title')?.textContent?.trim()).toBe('Foredeck');
  });

  it('shows a connecting placeholder until the first frame arrives', () => {
    const el: HTMLElement = setup({
      video: { sourceKind: 'url', url: 'https://cam.example/clip.mp4' }
    }).nativeElement;
    expect(el.querySelector('.video-widget__connecting')).not.toBeNull();
  });

  function mountVideo(config: IWidgetSvcConfig, plugin?: { getPlugin: unknown }) {
    const options = signal<IWidgetSvcConfig | undefined>(config);
    TestBed.configureTestingModule({
      imports: [WidgetVideoComponent],
      providers: [
        { provide: WidgetRuntimeDirective, useValue: { options } },
        { provide: DataService, useValue: { getPathObject: () => null } },
        ...(plugin ? [{ provide: PluginConfigClientService, useValue: plugin }] : []),
        {
          provide: SignalKConnectionService,
          useValue: {
            serverServiceEndpoint$: of({ httpServiceUrl: 'http://boat.local:3000/signalk/v1/api/' }),
            signalKURL: { url: null }
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(WidgetVideoComponent);
    fixture.componentRef.setInput('id', 'test-id');
    fixture.componentRef.setInput('type', 'widget-video');
    fixture.componentRef.setInput('theme', null);
    fixture.detectChanges();
    return fixture;
  }

  it('tells the user to install the SK Video plugin for a camera source when it is not installed', async () => {
    const fixture = mountVideo(
      { video: { sourceKind: 'camera', cameraId: 'foredeck', transport: 'auto' } },
      pluginNotFound()
    );
    await flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const empty = el.querySelector('.video-widget__empty');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain('SK Video plugin');
    expect(el.querySelector('video')).toBeNull();
  });

  it('tells the user to install the SK Video plugin for an uploaded-file source when it is not installed', async () => {
    const fixture = mountVideo({ video: { sourceKind: 'file', fileAssetId: 'v1' } }, pluginNotFound());
    await flush();
    fixture.detectChanges();
    const empty = (fixture.nativeElement as HTMLElement).querySelector('.video-widget__empty');
    expect(empty?.textContent).toContain('SK Video plugin');
  });

  it('shows the plugin message when SK Video is installed but disabled', async () => {
    const fixture = mountVideo(
      { video: { sourceKind: 'camera', cameraId: 'foredeck', transport: 'auto' } },
      pluginDisabled()
    );
    await flush();
    fixture.detectChanges();
    const empty = (fixture.nativeElement as HTMLElement).querySelector('.video-widget__empty');
    expect(empty?.textContent).toContain('SK Video plugin');
  });

  it('does not show the plugin message for a URL source (no plugin needed)', async () => {
    const el: HTMLElement = setup({ video: { sourceKind: 'url', url: 'https://cam.example/clip.mp4' } }).nativeElement;
    await flush();
    expect(el.textContent).not.toContain('SK Video plugin required');
  });

  it('does not show the plugin message when SK Video is installed and enabled', async () => {
    const fixture = mountVideo(
      { video: { sourceKind: 'camera', cameraId: 'foredeck', transport: 'webrtc' } },
      pluginAvailable()
    );
    await flush();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('SK Video plugin required');
  });
});
