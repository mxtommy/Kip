import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UntypedFormControl, UntypedFormGroup, FormGroupDirective } from '@angular/forms';
import { HttpEventType, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ImageSourceSetupComponent } from './image-source-setup.component';
import { ImageAssetService, IImageAsset } from '../../core/services/image-asset.service';
import { DialogService } from '../../core/services/dialog.service';
import { AppService } from '../../core/services/app-service';

describe('ImageSourceSetupComponent', () => {
  let fixture: ComponentFixture<ImageSourceSetupComponent>;
  let component: ImageSourceSetupComponent;
  let formGroup: UntypedFormGroup;

  const sampleList: IImageAsset[] = [
    { id: 'img-1', name: 'a.png', format: 'png', width: 100, height: 80, bytes: 1234, animated: false, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'img-2', name: 'b.svg', format: 'svg', width: 0, height: 0, bytes: 500, animated: false, createdAt: '2026-01-02T00:00:00Z' }
  ];

  const imagesMock = {
    list: vi.fn(() => of(sampleList)),
    upload: vi.fn(() => of({ type: HttpEventType.Response, body: { id: 'uploaded-1' } })),
    delete: vi.fn(() => of(undefined)),
    urlFor: vi.fn((id: string, w?: number) => `http://host/plugins/kip/images/${id}?w=${w}`)
  };
  const dialogMock = { openConfirmationDialog: vi.fn(() => of(true)) };
  const appMock = { cssThemeColors: { cardColor: '#1e1e1e' } };

  const api = () => component as unknown as {
    imageGroup: UntypedFormGroup;
    gallery: () => IImageAsset[];
    galleryStatus: () => 'loading' | 'loaded' | 'error';
    galleryError: () => string | null;
    error: () => string | null;
    uploading: () => boolean;
    validateFile: (file: File) => string | null;
    selectImage: (id: string | null) => void;
    selectedId: () => string | null;
    deleteImage: (id: string, event: Event) => void;
    onFileSelected: (event: Event) => void;
    toggleTransparent: (v: boolean) => void;
    isTransparent: boolean;
  };

  const fileOf = (name: string, type: string, size: number): File => {
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  const buildWith = async (imageGroup: UntypedFormGroup) => {
    formGroup = new UntypedFormGroup({ image: imageGroup });
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ImageSourceSetupComponent],
      providers: [
        { provide: FormGroupDirective, useValue: { control: formGroup } },
        { provide: ImageAssetService, useValue: imagesMock },
        { provide: DialogService, useValue: dialogMock },
        { provide: AppService, useValue: appMock }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ImageSourceSetupComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('formGroupName', 'image');
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensures the imageId/imageFit/altText/backgroundColor controls exist when the group is empty', async () => {
    await buildWith(new UntypedFormGroup({}));
    const group = api().imageGroup;
    expect(group.get('imageId')).toBeTruthy();
    expect(group.get('imageFit')!.value).toBe('contain');
    expect(group.get('altText')!.value).toBe('');
    expect(group.get('backgroundColor')!.value).toBeNull();
  });

  it('preserves saved control values when reopening', async () => {
    await buildWith(new UntypedFormGroup({
      imageId: new UntypedFormControl('img-2'),
      imageFit: new UntypedFormControl('cover'),
      altText: new UntypedFormControl('Map'),
      backgroundColor: new UntypedFormControl('#112233')
    }));
    const group = api().imageGroup;
    expect(group.get('imageId')!.value).toBe('img-2');
    expect(group.get('imageFit')!.value).toBe('cover');
    expect(group.get('backgroundColor')!.value).toBe('#112233');
  });

  it('loads the shared library into the gallery on init, newest first', async () => {
    await buildWith(new UntypedFormGroup({}));
    expect(imagesMock.list).toHaveBeenCalled();
    // Sorted by createdAt descending so a just-uploaded image is easy to find.
    expect(api().gallery().map(a => a.id)).toEqual(['img-2', 'img-1']);
  });

  it('rejects files over the 10 MB limit', async () => {
    await buildWith(new UntypedFormGroup({}));
    const big = fileOf('big.png', 'image/png', 10 * 1024 * 1024 + 1);
    expect(api().validateFile(big)).toContain('10 MB');
  });

  it('rejects unsupported types that also lack a known extension', async () => {
    await buildWith(new UntypedFormGroup({}));
    const bad = fileOf('note.txt', 'text/plain', 100);
    expect(api().validateFile(bad)).toContain("isn't supported");
  });

  it('accepts a valid image within limits', async () => {
    await buildWith(new UntypedFormGroup({}));
    const ok = fileOf('photo.webp', 'image/webp', 2 * 1024 * 1024);
    expect(api().validateFile(ok)).toBeNull();
  });

  it('accepts a HEIC file by extension even when the browser reports no type', async () => {
    await buildWith(new UntypedFormGroup({}));
    const heic = fileOf('IMG_0001.HEIC', '', 1024);
    expect(api().validateFile(heic)).toBeNull();
  });

  it('selecting a gallery image sets the imageId control, the highlight signal, and marks it dirty', async () => {
    await buildWith(new UntypedFormGroup({}));
    api().selectImage('img-1');
    const control = api().imageGroup.get('imageId')!;
    expect(control.value).toBe('img-1');
    expect(control.dirty).toBe(true);
    expect(api().selectedId()).toBe('img-1');
  });

  it('initializes the highlight signal from a saved imageId', async () => {
    await buildWith(new UntypedFormGroup({ imageId: new UntypedFormControl('img-2') }));
    expect(api().selectedId()).toBe('img-2');
  });

  it('sets the selected image id from a successful upload response', async () => {
    await buildWith(new UntypedFormGroup({}));
    const input = document.createElement('input');
    input.type = 'file';
    const file = fileOf('new.png', 'image/png', 1024);
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    api().onFileSelected({ target: input } as unknown as Event);
    expect(imagesMock.upload).toHaveBeenCalledWith(file);
    expect(api().imageGroup.get('imageId')!.value).toBe('uploaded-1');
    expect(api().uploading()).toBe(false);
  });

  it('surfaces a login error message when the server returns 401', async () => {
    imagesMock.upload.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));
    await buildWith(new UntypedFormGroup({}));
    const input = document.createElement('input');
    input.type = 'file';
    const file = fileOf('new.png', 'image/png', 1024);
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    api().onFileSelected({ target: input } as unknown as Event);
    expect(api().error()).toContain('Sign in');
  });

  it('confirms before deleting, then clears the selection on success', async () => {
    dialogMock.openConfirmationDialog.mockReturnValueOnce(of(true));
    await buildWith(new UntypedFormGroup({ imageId: new UntypedFormControl('img-1') }));
    api().deleteImage('img-1', { stopPropagation: vi.fn() } as unknown as Event);
    expect(dialogMock.openConfirmationDialog).toHaveBeenCalled();
    expect(imagesMock.delete).toHaveBeenCalledWith('img-1');
    expect(api().imageGroup.get('imageId')!.value).toBeNull();
  });

  it('does NOT delete when the confirmation is declined', async () => {
    dialogMock.openConfirmationDialog.mockReturnValueOnce(of(false));
    await buildWith(new UntypedFormGroup({ imageId: new UntypedFormControl('img-1') }));
    api().deleteImage('img-1', { stopPropagation: vi.fn() } as unknown as Event);
    expect(imagesMock.delete).not.toHaveBeenCalled();
    expect(api().imageGroup.get('imageId')!.value).toBe('img-1');
  });

  it('maps a 401 delete failure to a Sign in message', async () => {
    dialogMock.openConfirmationDialog.mockReturnValueOnce(of(true));
    imagesMock.delete.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));
    await buildWith(new UntypedFormGroup({ imageId: new UntypedFormControl('img-1') }));
    api().deleteImage('img-1', { stopPropagation: vi.fn() } as unknown as Event);
    expect(api().error()).toContain('Sign in');
  });

  it('shows an error (not an empty library) when the list request fails', async () => {
    imagesMock.list.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    await buildWith(new UntypedFormGroup({}));
    expect(api().galleryStatus()).toBe('error');
    expect(api().galleryError()).toBeTruthy();
  });

  it('toggles a transparent background on and off, seeding the opaque color from the theme', async () => {
    await buildWith(new UntypedFormGroup({}));
    expect(api().isTransparent).toBe(true);
    api().toggleTransparent(false);
    expect(api().imageGroup.get('backgroundColor')!.value).toBe('#1e1e1e');
    api().toggleTransparent(true);
    expect(api().imageGroup.get('backgroundColor')!.value).toBeNull();
  });
});
