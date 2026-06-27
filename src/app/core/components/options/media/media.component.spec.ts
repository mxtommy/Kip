import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsMediaComponent } from './media.component';
import { ToastService } from '../../../services/toast.service';
import { ImageAssetService } from '../../../services/image-asset.service';
import { DialogService } from '../../../services/dialog.service';

describe('SettingsMediaComponent', () => {
  let component: SettingsMediaComponent;
  let fixture: ComponentFixture<SettingsMediaComponent>;
  let toastMock: {
    show: ReturnType<typeof vi.fn>;
  };
  let imagesMock: {
    ready: boolean;
    cacheStats: ReturnType<typeof vi.fn>;
    purgeCache: ReturnType<typeof vi.fn>;
  };
  let dialogMock: {
    openConfirmationDialog: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    toastMock = {
      show: vi.fn()
    };
    imagesMock = {
      ready: true,
      cacheStats: vi.fn(() => of({ bytes: 1048576, files: 3 })),
      purgeCache: vi.fn(() => of({ ok: true }))
    };
    dialogMock = {
      openConfirmationDialog: vi.fn(() => of(true))
    };

    await TestBed.configureTestingModule({
      imports: [SettingsMediaComponent],
      providers: [
        { provide: ToastService, useValue: toastMock },
        { provide: ImageAssetService, useValue: imagesMock },
        { provide: DialogService, useValue: dialogMock }
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsMediaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('loads and formats the image cache size on init', () => {
    expect(imagesMock.cacheStats).toHaveBeenCalled();
    const api = component as unknown as { imageCacheDisplay: () => string };
    expect(api.imageCacheDisplay()).toBe('1.0 MB · 3 files');
  });

  it('shows Unavailable when the image service is not ready', () => {
    imagesMock.ready = false;
    component.refreshImageCache();
    const api = component as unknown as { imageCacheDisplay: () => string };
    expect(api.imageCacheDisplay()).toBe('Unavailable');
  });

  it('purges the image cache after confirmation and refreshes', () => {
    imagesMock.cacheStats.mockClear();
    component.purgeImageCache();

    expect(dialogMock.openConfirmationDialog).toHaveBeenCalled();
    expect(imagesMock.purgeCache).toHaveBeenCalled();
    expect(imagesMock.cacheStats).toHaveBeenCalled();
    expect(toastMock.show).toHaveBeenCalledWith('Image cache purged', 1000, true, 'success');
  });

  it('does not purge when the confirmation is declined', () => {
    dialogMock.openConfirmationDialog.mockReturnValueOnce(of(false));
    component.purgeImageCache();

    expect(imagesMock.purgeCache).not.toHaveBeenCalled();
  });
});
