import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { WidgetVideoComponent } from './widget-video.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { DataService } from '../../core/services/data.service';
import { SignalKConnectionService } from '../../core/services/signalk-connection.service';
import { PtzClient } from './ptz-client';
import type { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';

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
    await Promise.resolve(); // let listPresets resolve
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
});
