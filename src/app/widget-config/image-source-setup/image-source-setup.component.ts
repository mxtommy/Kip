import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { FormGroupDirective, ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ImageAssetService, IImageAsset } from '../../core/services/image-asset.service';
import { DialogService } from '../../core/services/dialog.service';
import { AppService } from '../../core/services/app-service';

type TGalleryStatus = 'loading' | 'loaded' | 'error';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXT = /\.(png|jpe?g|webp|gif|heic|heif|svg)$/i;
const ACCEPTED_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/svg+xml'
]);

/**
 * Widget config sub-component for the Image widget: upload a new image (with client-side size/type
 * guards + progress), pick/delete from the shared library, and set fit / alt text / background.
 * Binds to the widget config's nested `image` FormGroup (created if absent).
 */
@Component({
  selector: 'image-source-setup',
  templateUrl: './image-source-setup.component.html',
  styleUrls: ['./image-source-setup.component.scss'],
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatCheckboxModule, MatProgressBarModule, MatProgressSpinnerModule]
})
export class ImageSourceSetupComponent implements OnInit {
  readonly formGroupName = input.required<string>();
  readonly accept = 'image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,image/svg+xml';

  private readonly rootFormGroup = inject(FormGroupDirective);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(DialogService);
  private readonly app = inject(AppService);
  protected readonly images = inject(ImageAssetService);

  protected imageGroup!: UntypedFormGroup;
  protected readonly gallery = signal<IImageAsset[]>([]);
  /** Distinguishes a genuinely empty shared library from a failed load (so we don't tell the
   *  crew the library is empty when the server was simply unreachable). */
  protected readonly galleryStatus = signal<TGalleryStatus>('loading');
  protected readonly galleryError = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly uploadProgress = signal(0);
  protected readonly error = signal<string | null>(null);
  /** Screen-reader status line (upload progress / completion / deletion). */
  protected readonly liveStatus = signal('');
  /** Per-asset broken-thumbnail tracking (a variant can fail transiently). */
  protected readonly brokenThumbs = signal<Set<string>>(new Set());
  /** Source of truth for the gallery highlight; kept in sync with the imageId control so the
   *  highlight updates under zoneless change detection even when set from async callbacks. */
  protected readonly selectedId = signal<string | null>(null);
  private galleryRequestSeq = 0;

  ngOnInit(): void {
    const existing = this.rootFormGroup.control.get(this.formGroupName());
    if (existing instanceof UntypedFormGroup) {
      this.imageGroup = existing;
    } else {
      this.imageGroup = new UntypedFormGroup({});
      this.rootFormGroup.control.addControl(this.formGroupName(), this.imageGroup);
    }
    this.ensureControl('imageId', null);
    this.ensureControl('imageFit', 'contain');
    this.ensureControl('altText', '');
    this.ensureControl('backgroundColor', null);
    this.selectedId.set(this.imageIdControl.value ?? null);
    this.refreshGallery();
  }

  private ensureControl(name: string, defaultValue: unknown): void {
    if (!this.imageGroup.get(name)) {
      this.imageGroup.addControl(name, new UntypedFormControl(defaultValue));
    }
  }

  protected get imageIdControl(): UntypedFormControl { return this.imageGroup.get('imageId') as UntypedFormControl; }
  protected get imageFitControl(): UntypedFormControl { return this.imageGroup.get('imageFit') as UntypedFormControl; }
  protected get backgroundControl(): UntypedFormControl { return this.imageGroup.get('backgroundColor') as UntypedFormControl; }

  /** Client-side pre-check (the server is authoritative). Returns an error message or null. */
  validateFile(file: File): string | null {
    if (file.size > MAX_UPLOAD_BYTES) {
      return 'This image is larger than the 10 MB limit. Choose a smaller file.';
    }
    if (file.type && !ACCEPTED_TYPES.has(file.type) && !ACCEPTED_EXT.test(file.name)) {
      return "That image type isn't supported. Use JPG, PNG, WebP, GIF, HEIC/HEIF, or SVG.";
    }
    return null;
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file later
    if (!file) return;

    const validationError = this.validateFile(file);
    if (validationError) {
      this.error.set(validationError);
      return;
    }
    this.error.set(null);
    this.uploading.set(true);
    this.uploadProgress.set(0);
    this.liveStatus.set('Uploading image…');

    this.images.upload(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (httpEvent) => {
        if (httpEvent.type === HttpEventType.UploadProgress && httpEvent.total) {
          this.uploadProgress.set(Math.round((httpEvent.loaded / httpEvent.total) * 100));
        } else if (httpEvent.type === HttpEventType.Response) {
          this.uploading.set(false);
          this.liveStatus.set('Upload complete');
          const meta = httpEvent.body as IImageAsset | null;
          if (meta?.id) {
            this.selectImage(meta.id);
            this.refreshGallery();
          }
        }
      },
      error: (err: HttpErrorResponse) => {
        this.uploading.set(false);
        this.error.set(this.describeAssetError(err, 'upload'));
        this.liveStatus.set('Upload failed');
      }
    });
  }

  /** Maps an upload/delete HTTP error to plain, status-specific copy. The server is authoritative;
   *  serverMessage (when present) is preferred for the cases the server can describe. */
  private describeAssetError(err: HttpErrorResponse, verb: 'upload' | 'delete'): string {
    const serverMessage = (err?.error as { error?: string })?.error;
    switch (err?.status) {
      case 401: return `Sign in to the Signal K server to ${verb} images.`;
      case 403: return `Your Signal K account is read-only. Ask an administrator for read-write access to ${verb} images.`;
      case 413: return 'This image is larger than the 10 MB limit. Choose a smaller file.';
      case 415: return serverMessage ?? "That image type isn't supported, or the file couldn't be read.";
      default: return serverMessage ?? (verb === 'upload'
        ? "Couldn't upload the image. Check your Signal K server connection and try again."
        : 'Could not delete the image.');
    }
  }

  /** Maps a library-load failure so an unreachable server isn't shown as an empty library. */
  private describeListError(err: HttpErrorResponse): string {
    switch (err?.status) {
      case 401: return 'Sign in to the Signal K server to load the image library.';
      case 403: return "Your Signal K account doesn't have access to the image library.";
      case 404: return "The SK Image plugin isn't installed or enabled. Install it from the Signal K App Store, or enable it in the server's plugin settings.";
      default: return "Couldn't reach the Signal K server.";
    }
  }

  protected selectImage(id: string | null): void {
    this.imageIdControl.setValue(id);
    this.imageIdControl.markAsDirty();
    this.selectedId.set(id);
  }

  /** Confirms before deleting, because the image lives in the SHARED, boat-wide library — one tap
   *  would otherwise remove it from every display with no undo. */
  protected deleteImage(id: string, event: Event): void {
    event.stopPropagation();
    const name = this.gallery().find((a) => a.id === id)?.name ?? 'this image';
    this.dialog.openConfirmationDialog({
      title: 'Delete From Shared Library?',
      message: `Delete "${name}"? This removes it from every display on the boat and can't be undone.`,
      confirmBtnText: 'Delete',
      cancelBtnText: 'Cancel'
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      if (!confirmed) return;
      this.error.set(null);
      this.images.delete(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          if (this.selectedId() === id) this.selectImage(null);
          this.liveStatus.set('Image deleted');
          this.refreshGallery();
        },
        error: (err: HttpErrorResponse) => this.error.set(this.describeAssetError(err, 'delete'))
      });
    });
  }

  protected thumbUrl(id: string): string | null {
    return this.images.urlFor(id, 160);
  }

  /** Marks a thumbnail variant as failed to load (tile stays selectable — it may be valid at other sizes). */
  protected markThumbBroken(id: string): void {
    if (this.brokenThumbs().has(id)) return;
    this.brokenThumbs.set(new Set(this.brokenThumbs()).add(id));
  }

  protected refreshGallery(): void {
    const seq = ++this.galleryRequestSeq;
    this.galleryStatus.set('loading');
    this.images.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => {
        if (seq !== this.galleryRequestSeq) return;
        // Newest first so a just-uploaded image is easy to find.
        this.gallery.set([...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')));
        this.brokenThumbs.set(new Set());
        this.galleryStatus.set('loaded');
      },
      error: (err: HttpErrorResponse) => {
        if (seq !== this.galleryRequestSeq) return;
        this.galleryError.set(this.describeListError(err));
        this.galleryStatus.set('error');
      }
    });
  }

  protected get isTransparent(): boolean {
    return !this.backgroundControl?.value;
  }

  protected toggleTransparent(transparent: boolean): void {
    this.backgroundControl.setValue(transparent ? null : this.defaultOpaqueColor());
    this.backgroundControl.markAsDirty();
  }

  /** The opaque backing defaults to the active theme's card color, not a hardcoded pure black. */
  private defaultOpaqueColor(): string {
    return toHex(this.app.cssThemeColors?.cardColor ?? '') ?? '#000000';
  }

  protected setBackground(event: Event): void {
    this.backgroundControl.setValue((event.target as HTMLInputElement).value);
    this.backgroundControl.markAsDirty();
  }
}

/** Normalises a CSS color (hex or rgb/rgba) to the `#rrggbb` that `<input type="color">` accepts. */
function toHex(color: string): string | null {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const rgb = trimmed.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) {
    const hex = (n: string) => Math.min(255, Number(n)).toString(16).padStart(2, '0');
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
  }
  return null;
}
