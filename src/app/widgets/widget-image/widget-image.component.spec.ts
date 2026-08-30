import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { signal } from '@angular/core';
import { WidgetImageComponent } from './widget-image.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { ImageAssetService } from '../../core/services/image-asset.service';
import type { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import type { ITheme } from '../../core/services/app-service';

describe('WidgetImageComponent', () => {
  let fixture: ComponentFixture<WidgetImageComponent>;
  let component: WidgetImageComponent;
  const options = signal<IWidgetSvcConfig | undefined>(undefined);

  const runtimeMock = { options };
  const imagesMock = {
    urlFor: (id: string | null | undefined, w?: number | null) =>
      id ? `http://host/plugins/sk-image/images/${id}?w=${w || 2560}` : null
  };

  beforeEach(async () => {
    options.set({ image: { imageId: null, imageFit: 'contain', altText: '', backgroundColor: null } });
    await TestBed.configureTestingModule({
      imports: [WidgetImageComponent],
      providers: [
        { provide: WidgetRuntimeDirective, useValue: runtimeMock },
        { provide: ImageAssetService, useValue: imagesMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WidgetImageComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'w1');
    fixture.componentRef.setInput('type', 'widget-image');
    fixture.componentRef.setInput('theme', {} as ITheme);
  });

  const api = () => component as unknown as {
    imageUrl: () => string | null;
    background: () => string;
    objectFit: () => string;
  };

  it('shows the empty state when no image is selected', () => {
    fixture.detectChanges();
    expect(api().imageUrl()).toBeNull();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.image-widget-empty')).toBeTruthy();
    expect(el.querySelector('img')).toBeFalsy();
  });

  it('renders the configured image via the asset service URL with the chosen object-fit', () => {
    options.set({ image: { imageId: 'img-1', imageFit: 'cover', altText: 'Safety map', backgroundColor: '#000' } });
    fixture.detectChanges();
    const img = (fixture.nativeElement as HTMLElement).querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toContain('/plugins/sk-image/images/img-1?w=');
    expect(img!.getAttribute('alt')).toBe('Safety map');
    expect(img!.style.objectFit).toBe('cover');
  });

  it('requests a small variant before the first measurement, then the measured width', () => {
    options.set({ image: { imageId: 'img-1', imageFit: 'contain', altText: '', backgroundColor: null } });
    fixture.detectChanges();
    // Unmeasured (container width 0): must not fetch the largest (2560) variant on first paint.
    expect(api().imageUrl()).not.toContain('w=2560');

    (component as unknown as { onResize: (e: { width: number; height: number }) => void })
      .onResize({ width: 640, height: 480 });
    expect(api().imageUrl()).toContain('w=640');
  });

  it('defaults to a transparent background and contain fit, and reflects a configured color', () => {
    fixture.detectChanges();
    expect(api().background()).toBe('transparent');
    expect(api().objectFit()).toBe('contain');
    options.set({ image: { imageId: 'x', backgroundColor: '#123456' } });
    expect(api().background()).toBe('#123456');
  });
});
