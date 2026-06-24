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
import { ImageAssetService, IImageAsset } from '../../core/services/image-asset.service';

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
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatCheckboxModule, MatProgressBarModule]
})
export class ImageSourceSetupComponent implements OnInit {
  readonly formGroupName = input.required<string>();
  readonly accept = 'image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,image/svg+xml';

  private readonly rootFormGroup = inject(FormGroupDirective);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly images = inject(ImageAssetService);

  protected imageGroup!: UntypedFormGroup;
  protected readonly gallery = signal<IImageAsset[]>([]);
  protected readonly uploading = signal(false);
  protected readonly uploadProgress = signal(0);
  protected readonly error = signal<string | null>(null);

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
    this.refreshGallery();
  }

  private ensureControl(name: string, defaultValue: unknown): void {
    if (!this.imageGroup.get(name)) {
      this.imageGroup.addControl(name, new UntypedFormControl(defaultValue));
    }
  }

  protected get imageIdControl(): UntypedFormControl { return this.imageGroup.get('imageId') as UntypedFormControl; }
  protected get backgroundControl(): UntypedFormControl { return this.imageGroup.get('backgroundColor') as UntypedFormControl; }
  protected get selectedId(): string | null { return this.imageIdControl?.value ?? null; }

  /** Client-side pre-check (the server is authoritative). Returns an error message or null. */
  validateFile(file: File): string | null {
    if (file.size > MAX_UPLOAD_BYTES) {
      return 'File exceeds the 10 MB limit';
    }
    if (file.type && !ACCEPTED_TYPES.has(file.type) && !ACCEPTED_EXT.test(file.name)) {
      return 'Unsupported image type';
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

    this.images.upload(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (httpEvent) => {
        if (httpEvent.type === HttpEventType.UploadProgress && httpEvent.total) {
          this.uploadProgress.set(Math.round((httpEvent.loaded / httpEvent.total) * 100));
        } else if (httpEvent.type === HttpEventType.Response) {
          this.uploading.set(false);
          const meta = httpEvent.body as IImageAsset | null;
          if (meta?.id) {
            this.selectImage(meta.id);
            this.refreshGallery();
          }
        }
      },
      error: (err: HttpErrorResponse) => {
        this.uploading.set(false);
        this.error.set(this.describeUploadError(err));
      }
    });
  }

  private describeUploadError(err: HttpErrorResponse): string {
    const serverMessage = (err?.error as { error?: string })?.error;
    switch (err?.status) {
      case 401: return 'You must be logged in to the Signal K server to upload images.';
      case 413: return 'File exceeds the 10 MB limit';
      case 415: return serverMessage ?? 'Unsupported or unreadable image';
      default: return serverMessage ?? 'Upload failed';
    }
  }

  protected selectImage(id: string | null): void {
    this.imageIdControl.setValue(id);
    this.imageIdControl.markAsDirty();
  }

  protected deleteImage(id: string, event: Event): void {
    event.stopPropagation();
    this.images.delete(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (this.selectedId === id) this.selectImage(null);
        this.refreshGallery();
      },
      error: () => this.error.set('Failed to delete image')
    });
  }

  protected thumbUrl(id: string): string | null {
    return this.images.urlFor(id, 160);
  }

  protected refreshGallery(): void {
    this.images.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.gallery.set(list),
      error: () => { /* listing is best-effort */ }
    });
  }

  protected get isTransparent(): boolean {
    return !this.backgroundControl?.value;
  }

  protected toggleTransparent(transparent: boolean): void {
    this.backgroundControl.setValue(transparent ? null : '#000000');
    this.backgroundControl.markAsDirty();
  }

  protected setBackground(event: Event): void {
    this.backgroundControl.setValue((event.target as HTMLInputElement).value);
    this.backgroundControl.markAsDirty();
  }
}
