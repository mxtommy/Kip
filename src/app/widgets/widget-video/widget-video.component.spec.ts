import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { WidgetVideoComponent } from './widget-video.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import type { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';

function setup(config: IWidgetSvcConfig) {
  const options = signal<IWidgetSvcConfig | undefined>(config);
  TestBed.configureTestingModule({
    imports: [WidgetVideoComponent],
    providers: [{ provide: WidgetRuntimeDirective, useValue: { options } }]
  });
  const fixture = TestBed.createComponent(WidgetVideoComponent);
  fixture.componentRef.setInput('id', 'test-id');
  fixture.componentRef.setInput('type', 'widget-video');
  fixture.componentRef.setInput('theme', null);
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

  it('renders a <video> bound to the configured URL', () => {
    const el: HTMLElement = setup({ video: { sourceKind: 'url', url: 'https://cam.example/clip.mp4' } }).nativeElement;
    const video = el.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('https://cam.example/clip.mp4');
    expect(el.querySelector('.video-widget__empty')).toBeNull();
  });

  it('does not play unsupported source kinds yet (no <video> for a manual/RTSP source)', () => {
    const el: HTMLElement = setup({ video: { sourceKind: 'manual', url: 'rtsp://cam/stream' } }).nativeElement;
    expect(el.querySelector('video')).toBeNull();
    expect(el.querySelector('.video-widget__empty')).not.toBeNull();
  });
});
