import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import {
  FormGroupDirective, ReactiveFormsModule, UntypedFormControl, UntypedFormGroup, Validators
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { mapPreset, type TVideoPreset } from '../../widgets/widget-video/playback-presets.util';
import { SignalKConnectionService } from '../../core/services/signalk-connection.service';
import { resolveSignalKPluginBaseUrl } from '../../core/utils/signalk-plugin-url.util';
import { CameraDiscoveryClient, DiscoveryRateLimitedError } from '../../widgets/widget-video/discovery-client';
import { CamerasResourceClient, type ISavedCamera } from '../../widgets/widget-video/cameras-resource-client';
import { CameraCredentialsClient, type ICredentialPresence } from '../../widgets/widget-video/camera-credentials-client';
import { CameraProbeClient, type ICameraProbeResult } from '../../widgets/widget-video/camera-probe-client';
import { VideoAssetsClient, VideoUploadError, type IVideoAsset } from '../../widgets/widget-video/video-assets-client';
import {
  CAMERA_SCHEMES, buildCameraRecord, candidateToFields, slugifyCameraId,
  type ICameraCandidate, type ICameraRecord
} from '../../widgets/widget-video/camera-record.util';

/**
 * Widget config sub-component for the Video widget. Binds to the widget config's nested `video`
 * FormGroup and lets the user pick a source (direct URL or a gateway camera) and set display options.
 *
 * Camera mode lists cameras saved on the Signal K server, scans the network to discover new ones, and
 * adds a camera (and optional credentials) through the sk-video plugin. Credentials are write-only
 * and live server-side; the widget config only stores the chosen camera id.
 */
@Component({
  selector: 'video-camera-setup',
  templateUrl: './video-camera-setup.component.html',
  styleUrls: ['./video-camera-setup.component.scss'],
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatButtonToggleModule, MatButtonModule, MatIconModule, MatTooltipModule,
    MatProgressSpinnerModule, MatSlideToggleModule
  ]
})
export class VideoCameraSetupComponent implements OnInit {
  readonly formGroupName = input.required<string>();
  private readonly rootFormGroup = inject(FormGroupDirective);
  private readonly connection = inject(SignalKConnectionService);
  private readonly discovery = inject(CameraDiscoveryClient);
  private readonly resources = inject(CamerasResourceClient);
  private readonly credentials = inject(CameraCredentialsClient);
  private readonly probe = inject(CameraProbeClient);
  private readonly assets = inject(VideoAssetsClient);

  protected videoGroup!: UntypedFormGroup;
  protected manualForm!: UntypedFormGroup;
  protected readonly schemes = CAMERA_SCHEMES;

  private readonly endpoint = toSignal(this.connection.serverServiceEndpoint$, { initialValue: null });
  private readonly pluginBaseUrl = computed(() =>
    resolveSignalKPluginBaseUrl('sk-video', this.endpoint()?.httpServiceUrl ?? null, this.connection.signalKURL?.url ?? null)
  );
  private readonly v2BaseUrl = computed(() => this.endpoint()?.httpServiceUrlV2 ?? null);

  protected readonly cameras = signal<ISavedCamera[]>([]);
  protected readonly candidates = signal<ICameraCandidate[]>([]);
  protected readonly scanning = signal(false);
  protected readonly scanMessage = signal<string | null>(null);
  protected readonly addError = signal<string | null>(null);
  protected readonly saving = signal(false);
  /** Whether the manual "Add a camera" form is expanded (auto-opens when no cameras are saved). */
  protected readonly manualOpen = signal(false);
  /** When set, the manual form is editing this saved camera id rather than adding a new one. */
  protected readonly editingId = signal<string | null>(null);
  /** Whether the camera being edited already has stored credentials (presence only, no secret). */
  protected readonly credentialPresence = signal<ICredentialPresence | null>(null);
  protected readonly clearingCredentials = signal(false);
  protected readonly testing = signal(false);
  protected readonly testResult = signal<ICameraProbeResult | null>(null);

  protected readonly videos = signal<IVideoAsset[]>([]);
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);

  ngOnInit(): void {
    const existing = this.rootFormGroup.control.get(this.formGroupName());
    if (existing instanceof UntypedFormGroup) {
      this.videoGroup = existing;
    } else {
      this.videoGroup = new UntypedFormGroup({});
      this.rootFormGroup.control.addControl(this.formGroupName(), this.videoGroup);
    }
    this.ensure('sourceKind', 'url');
    this.ensure('url', null);
    this.ensure('cameraId', null);
    this.ensure('fileAssetId', null);
    this.ensure('transport', 'auto');
    this.ensure('preset', 'balanced');
    this.ensure('muted', true);
    this.ensure('autoplay', false);
    this.ensure('loop', false);
    this.ensure('objectFit', 'contain');
    this.ensure('label', null);

    this.ensureGroup('snapshot', {
      embedTelemetry: true,
      embedLocation: true,
      defaultDestination: 'download'
    });

    this.manualForm = new UntypedFormGroup({
      name: new UntypedFormControl('', [Validators.required, Validators.maxLength(100)]),
      scheme: new UntypedFormControl('rtsp', Validators.required),
      // No colon: a host:port paste is split into the port field by normalizeHost().
      host: new UntypedFormControl('', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]+$/)]),
      port: new UntypedFormControl(null, [Validators.min(1), Validators.max(65535)]),
      path: new UntypedFormControl('', Validators.pattern(/^\/[^\s]*$/)),
      username: new UntypedFormControl(''),
      password: new UntypedFormControl('')
    });

    void this.refreshCameras();
    void this.refreshVideos();
  }

  /** Loads the videos uploaded to the server. */
  protected async refreshVideos(): Promise<void> {
    try {
      this.videos.set(await this.assets.list(this.pluginBaseUrl()));
    } catch {
      // leave the existing list
    }
  }

  /** Handles a chosen file from the upload input. */
  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file later
    if (file) {
      void this.uploadFile(file);
    }
  }

  private async uploadFile(file: File): Promise<void> {
    this.uploadError.set(null);
    this.uploading.set(true);
    try {
      const asset = await this.assets.upload(this.pluginBaseUrl(), file);
      await this.refreshVideos();
      this.videoGroup.get('fileAssetId')?.setValue(asset.id);
    } catch (err) {
      this.uploadError.set(
        err instanceof VideoUploadError
          ? err.message
          : 'Upload failed — is the SK Video plugin installed and enabled?'
      );
    } finally {
      this.uploading.set(false);
    }
  }

  /** Removes the currently selected uploaded video. */
  protected async removeVideo(): Promise<void> {
    const id = this.videoGroup.get('fileAssetId')?.value as string | null;
    if (!id) {
      return;
    }
    try {
      await this.assets.remove(this.pluginBaseUrl(), id);
      this.videoGroup.get('fileAssetId')?.setValue(null);
      await this.refreshVideos();
    } catch {
      this.uploadError.set('Could not remove the video.');
    }
  }

  /** Human-readable file size. */
  protected sizeLabel(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
  }

  /** Friendly label for a camera scheme, keeping the protocol name discoverable in parentheses. */
  protected schemeLabel(scheme: string): string {
    const labels: Record<string, string> = {
      rtsp: 'IP camera (RTSP)',
      rtsps: 'IP camera, secure (RTSPS)',
      rtmp: 'RTMP stream',
      http: 'Web camera (HTTP)',
      https: 'Web camera, secure (HTTPS)',
      onvif: 'ONVIF camera'
    };
    return labels[scheme] ?? scheme;
  }

  /** Currently selected source kind (defaults to 'url'). */
  protected get sourceKind(): string {
    return this.videoGroup?.get('sourceKind')?.value ?? 'url';
  }

  /** The saved camera currently chosen in the picker, if any. */
  protected get selectedCamera(): ISavedCamera | undefined {
    const id = this.videoGroup?.get('cameraId')?.value as string | null;
    return id ? this.cameras().find((c) => c.id === id) : undefined;
  }

  /** Plain-language hint for the currently selected quality/latency preset. */
  protected get presetHint(): string {
    return mapPreset((this.videoGroup?.get('preset')?.value as TVideoPreset) ?? 'balanced').hint;
  }

  /** Loads the cameras saved on the server. */
  protected async refreshCameras(): Promise<void> {
    try {
      this.cameras.set(await this.resources.list(this.v2BaseUrl()));
      // With no saved cameras, open the add form so the user isn't staring at an empty picker.
      if (this.cameras().length === 0) {
        this.manualOpen.set(true);
      }
    } catch {
      // leave the existing list; the picker simply shows what we have
    }
  }

  /** Pasting a host:port or a full camera URL into Address splits it across the right fields. */
  protected normalizeHost(): void {
    const raw = String(this.manualForm.get('host')?.value ?? '').trim();
    if (!raw) {
      return;
    }
    const url = raw.match(/^(rtsp|rtsps|rtmp|https?|onvif):\/\/(?:[^@/]+@)?([^:/]+)(?::(\d+))?(\/.*)?$/i);
    if (url) {
      this.manualForm.patchValue({
        scheme: url[1].toLowerCase(),
        host: url[2],
        port: url[3] ? Number(url[3]) : this.manualForm.get('port')?.value,
        path: url[4] ?? this.manualForm.get('path')?.value
      });
      return;
    }
    const hostPort = raw.match(/^([A-Za-z0-9._-]+):(\d+)$/);
    if (hostPort) {
      this.manualForm.patchValue({ host: hostPort[1], port: Number(hostPort[2]) });
    }
  }

  /** Probes the camera being entered, before saving, and shows whether it answers. */
  protected async testConnection(): Promise<void> {
    this.manualForm.markAllAsTouched();
    const fields = this.manualForm.value as Record<string, unknown>;
    const record = buildCameraRecord(fields);
    if (!record.valid || !record.value) {
      this.testResult.set({ ok: false, message: record.errors.join('. ') || 'Check the camera details.' });
      return;
    }
    this.testing.set(true);
    this.testResult.set(null);
    try {
      this.testResult.set(
        await this.probe.test(this.pluginBaseUrl(), {
          source: record.value.source,
          username: `${fields['username'] ?? ''}`.trim() || undefined,
          password: `${fields['password'] ?? ''}` || undefined,
        })
      );
    } catch {
      this.testResult.set({ ok: false, message: 'Couldn’t reach the SK Video plugin.' });
    } finally {
      this.testing.set(false);
    }
  }

  /** Scans the network for cameras through the plugin. */
  protected async scan(): Promise<void> {
    if (this.scanning()) {
      return;
    }
    this.scanning.set(true);
    this.scanMessage.set(null);
    this.candidates.set([]);
    try {
      const found = await this.discovery.scan(this.pluginBaseUrl());
      this.candidates.set(found);
      if (!found.length) {
        this.scanMessage.set('No cameras found on the network.');
      }
    } catch (err) {
      if (err instanceof DiscoveryRateLimitedError) {
        const wait = err.retryAfterSeconds ? ` Try again in ${err.retryAfterSeconds}s.` : '';
        this.scanMessage.set(`A scan is already running.${wait}`);
      } else {
        this.scanMessage.set('Scan failed — is the SK Video plugin installed and enabled?');
      }
    } finally {
      this.scanning.set(false);
    }
  }

  /** Seeds the manual form from a discovered camera. */
  protected useCandidate(candidate: ICameraCandidate): void {
    this.manualOpen.set(true); // reveal the prefilled form
    this.editingId.set(null); // a candidate is a NEW camera, not an edit
    this.manualForm.patchValue(candidateToFields(candidate));
    this.addError.set(null);
    this.testResult.set(null);
  }

  /** Opens the manual form pre-filled with the selected camera's details, in edit mode. */
  protected editSelectedCamera(): void {
    const cam = this.selectedCamera;
    if (!cam) {
      return;
    }
    this.editingId.set(cam.id);
    this.manualOpen.set(true);
    this.addError.set(null);
    this.testResult.set(null);
    this.credentialPresence.set(null);
    // Credentials are write-only and never read back, so the password fields start blank — the user
    // re-enters them only if they want to change them (see the credentials section).
    this.manualForm.reset({
      name: cam.name,
      scheme: cam.source.scheme,
      host: cam.source.host,
      port: cam.source.port ?? null,
      path: cam.source.path ?? '',
      username: '',
      password: ''
    });
    void this.refreshCredentialPresence(cam.id);
  }

  /** Looks up whether the camera already has stored credentials (presence only — never the values). */
  private async refreshCredentialPresence(id: string): Promise<void> {
    try {
      this.credentialPresence.set(await this.credentials.presence(this.pluginBaseUrl(), id));
    } catch {
      this.credentialPresence.set(null);
    }
  }

  /** Removes the stored credentials for the camera being edited. */
  protected async clearCredentials(): Promise<void> {
    const id = this.editingId();
    if (!id) {
      return;
    }
    this.clearingCredentials.set(true);
    try {
      await this.credentials.clear(this.pluginBaseUrl(), id);
      this.credentialPresence.set({ hasUsername: false, hasPassword: false });
      this.manualForm.patchValue({ username: '', password: '' });
    } catch {
      this.addError.set('Could not clear the saved credentials.');
    } finally {
      this.clearingCredentials.set(false);
    }
  }

  /** Leaves edit mode without saving, returning the form to a blank "add" state. */
  protected cancelEdit(): void {
    this.editingId.set(null);
    this.addError.set(null);
    this.testResult.set(null);
    this.credentialPresence.set(null);
    this.manualForm.reset({ scheme: 'rtsp', port: null });
    this.manualOpen.set(false);
  }

  /** Enables or disables the selected camera, persisting the change to the server. */
  protected async toggleEnabled(enabled: boolean): Promise<void> {
    const cam = this.selectedCamera;
    if (!cam) {
      return;
    }
    try {
      await this.resources.save(this.v2BaseUrl(), cam.id, {
        name: cam.name,
        enabled,
        source: cam.source
      });
      await this.refreshCameras();
    } catch {
      this.addError.set('Could not update the camera.');
    }
  }

  /** Validates and saves the manual camera (adding a new one, or updating the one being edited). */
  protected async addCamera(): Promise<void> {
    this.manualForm.markAllAsTouched();
    this.addError.set(null);
    const fields = this.manualForm.value as Record<string, unknown>;
    const result = buildCameraRecord(fields);
    if (!result.valid || !result.value) {
      this.addError.set(result.errors.join('. '));
      return;
    }
    const editing = this.editingId();
    const id = editing ?? this.uniqueId(slugifyCameraId(result.value.name));
    // Editing keeps the same id and must not flip a disabled camera back on, so preserve its state.
    const record: ICameraRecord = editing
      ? { ...result.value, enabled: this.cameras().find((c) => c.id === editing)?.enabled ?? true }
      : result.value;
    this.saving.set(true);
    try {
      await this.resources.save(this.v2BaseUrl(), id, record);
      const username = `${fields['username'] ?? ''}`.trim();
      const password = `${fields['password'] ?? ''}`;
      if (username || password) {
        await this.credentials.set(this.pluginBaseUrl(), id, { username, password });
      }
      await this.refreshCameras();
      this.videoGroup.get('cameraId')?.setValue(id);
      this.manualForm.reset({ scheme: 'rtsp', port: null });
      this.candidates.set([]);
      this.editingId.set(null);
      this.credentialPresence.set(null);
      if (editing) {
        this.manualOpen.set(false); // collapse back to the picker after a successful edit
      }
    } catch {
      this.addError.set('Could not save the camera. Check the SK Video plugin and your details.');
    } finally {
      this.saving.set(false);
    }
  }

  /** Removes the currently selected camera. */
  protected async removeSelected(): Promise<void> {
    const id = this.videoGroup.get('cameraId')?.value as string | null;
    if (!id) {
      return;
    }
    try {
      await this.resources.remove(this.v2BaseUrl(), id);
      this.videoGroup.get('cameraId')?.setValue(null);
      await this.refreshCameras();
    } catch {
      this.addError.set('Could not remove the camera.');
    }
  }

  /** Ensures the generated id doesn't collide with an existing camera. */
  private uniqueId(base: string): string {
    const taken = new Set(this.cameras().map((c) => c.id));
    if (!taken.has(base)) {
      return base;
    }
    let n = 2;
    while (taken.has(`${base}-${n}`)) {
      n++;
    }
    return `${base}-${n}`;
  }

  private ensure(name: string, defaultValue: unknown): void {
    if (!this.videoGroup.get(name)) {
      this.videoGroup.addControl(name, new UntypedFormControl(defaultValue));
    }
  }

  private ensureGroup(name: string, defaults: Record<string, unknown>): void {
    let group = this.videoGroup.get(name) as UntypedFormGroup | null;
    if (!(group instanceof UntypedFormGroup)) {
      group = new UntypedFormGroup({});
      this.videoGroup.addControl(name, group);
    }
    for (const [key, value] of Object.entries(defaults)) {
      if (!group.get(key)) {
        group.addControl(key, new UntypedFormControl(value));
      }
    }
  }
}
