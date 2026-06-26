import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Component } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { VideoCameraSetupComponent } from './video-camera-setup.component';
import { SignalKConnectionService } from '../../core/services/signalk-connection.service';
import { CameraDiscoveryClient } from '../../widgets/widget-video/discovery-client';
import { CamerasResourceClient } from '../../widgets/widget-video/cameras-resource-client';
import { CameraCredentialsClient } from '../../widgets/widget-video/camera-credentials-client';
import { PtzClient } from '../../widgets/widget-video/ptz-client';
import { VideoAssetsClient } from '../../widgets/widget-video/video-assets-client';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, VideoCameraSetupComponent],
  template: `<form [formGroup]="root"><video-camera-setup [formGroupName]="groupName" /></form>`
})
class HostComponent {
  // Start with an empty group so we exercise the control-ensuring path.
  root = new UntypedFormGroup({ video: new UntypedFormGroup({}) });
  groupName = 'video';
}

describe('VideoCameraSetupComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let videoGroup: UntypedFormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    videoGroup = fixture.componentInstance.root.get('video') as UntypedFormGroup;
  });

  it('ensures default controls and renders the source + URL fields', () => {
    fixture.detectChanges();
    expect(videoGroup.get('sourceKind')?.value).toBe('url');
    expect(videoGroup.get('objectFit')?.value).toBe('contain');
    expect(videoGroup.get('muted')?.value).toBe(true);
    expect(videoGroup.get('autoplay')?.value).toBe(false);
    expect(videoGroup.get('loop')?.value).toBe(false);

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('mat-button-toggle-group')).not.toBeNull();
    expect(el.querySelector('input[type="url"]')).not.toBeNull();
  });

  it('binds the URL control to the input', () => {
    fixture.detectChanges();
    videoGroup.get('url')?.setValue('https://cam.example/v.mp4');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="url"]') as HTMLInputElement;
    expect(input.value).toBe('https://cam.example/v.mp4');
  });

  it('ensures transport + quality preset defaults and renders the preset control', () => {
    fixture.detectChanges();
    expect(videoGroup.get('transport')?.value).toBe('auto');
    expect(videoGroup.get('preset')?.value).toBe('balanced');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Quality');
    expect(text).toContain('Docking');
  });

  it('ensures the nested snapshot group with privacy + destination defaults', () => {
    fixture.detectChanges();
    const snapshot = videoGroup.get('snapshot') as UntypedFormGroup;
    expect(snapshot).toBeTruthy();
    expect(snapshot.get('embedLocation')?.value).toBe(true);
    expect(snapshot.get('embedTelemetry')?.value).toBe(true);
    expect(snapshot.get('defaultDestination')?.value).toBe('download');
    expect(fixture.nativeElement.querySelector('[formgroupname="snapshot"]')).not.toBeNull();
  });
});

describe('VideoCameraSetupComponent — camera mode', () => {
  const resources = {
    list: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined)
  };
  const discovery = { scan: vi.fn() };
  const creds = {
    set: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    presence: vi.fn().mockResolvedValue({ hasUsername: false, hasPassword: false })
  };
  const ptz = { move: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined) };

  let fixture: ComponentFixture<HostComponent>;
  let videoGroup: UntypedFormGroup;
  let cmp: { cameras: () => unknown[]; candidates: () => unknown[]; manualForm: UntypedFormGroup;
    addCamera: () => Promise<void>; scan: () => Promise<void> };

  beforeEach(async () => {
    resources.list.mockResolvedValue([
      { id: 'foredeck', name: 'Foredeck', enabled: true, source: { scheme: 'rtsp', host: '10.0.0.5' } }
    ]);
    discovery.scan.mockResolvedValue([{ name: 'Aft', host: '10.0.0.7' }]);
    resources.save.mockClear();
    creds.set.mockClear();
    creds.clear.mockClear();
    creds.presence.mockClear();
    creds.presence.mockResolvedValue({ hasUsername: false, hasPassword: false });
    ptz.move.mockClear();
    ptz.move.mockResolvedValue(undefined);
    ptz.stop.mockClear();

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: CamerasResourceClient, useValue: resources },
        { provide: CameraDiscoveryClient, useValue: discovery },
        { provide: CameraCredentialsClient, useValue: creds },
        { provide: PtzClient, useValue: ptz },
        {
          provide: SignalKConnectionService,
          useValue: {
            serverServiceEndpoint$: of({
              httpServiceUrl: 'http://h:3000/signalk/v1/api/',
              httpServiceUrlV2: 'http://h:3000/signalk/v2/api'
            }),
            signalKURL: { url: null }
          }
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    videoGroup = fixture.componentInstance.root.get('video') as UntypedFormGroup;
    fixture.detectChanges(); // ngOnInit
    videoGroup.get('sourceKind')?.setValue('camera');
    await Promise.resolve(); // refreshCameras
    fixture.detectChanges();
    cmp = fixture.debugElement.query(By.directive(VideoCameraSetupComponent))
      .componentInstance as typeof cmp;
  });

  it('shows the camera UI and lists saved cameras', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Scan network');
    // With saved cameras the manual form starts collapsed behind an "Add a camera" toggle.
    expect(text).toContain('Add a camera');
    expect(cmp.cameras()).toHaveLength(1);
    expect(videoGroup.get('cameraId')).toBeTruthy();
  });

  it('scans the network and lists candidates', async () => {
    await cmp.scan();
    expect(discovery.scan).toHaveBeenCalledWith('http://h:3000/plugins/sk-video/');
    expect(cmp.candidates()).toEqual([{ name: 'Aft', host: '10.0.0.7' }]);
  });

  it('labels a discovered candidate ONVIF when it advertises an ONVIF endpoint, else RTSP', () => {
    const c = cmp as unknown as { candidateProtocol: (cand: unknown) => string };
    expect(
      c.candidateProtocol({ name: 'A', host: '1.2.3.4', onvifUrl: 'http://1.2.3.4/onvif/device' })
    ).toBe('ONVIF');
    expect(c.candidateProtocol({ name: 'B', host: '1.2.3.5' })).toBe('RTSP');
  });

  it('splits a pasted host:port across the Address and Port fields', () => {
    cmp.manualForm.patchValue({ host: '192.168.1.50:8554', port: null });
    (cmp as unknown as { normalizeHost: () => void }).normalizeHost();
    expect(cmp.manualForm.get('host')?.value).toBe('192.168.1.50');
    expect(cmp.manualForm.get('port')?.value).toBe(8554);
  });

  it('decomposes a pasted full camera URL into scheme/host/port/path', () => {
    cmp.manualForm.patchValue({ host: 'rtsp://cam.local:554/stream1', scheme: 'rtsp', port: null, path: '' });
    (cmp as unknown as { normalizeHost: () => void }).normalizeHost();
    expect(cmp.manualForm.get('host')?.value).toBe('cam.local');
    expect(cmp.manualForm.get('port')?.value).toBe(554);
    expect(cmp.manualForm.get('path')?.value).toBe('/stream1');
  });

  it('saves a manual camera and selects it, with credentials', async () => {
    cmp.manualForm.patchValue({
      name: 'Bow Cam', scheme: 'rtsp', host: '10.0.0.9', port: 554, path: '/s1',
      username: 'admin', password: 'pw'
    });
    await cmp.addCamera();
    expect(resources.save).toHaveBeenCalledWith('http://h:3000/signalk/v2/api', 'bow-cam', {
      name: 'Bow Cam',
      enabled: true,
      source: { scheme: 'rtsp', host: '10.0.0.9', port: 554, path: '/s1' }
    });
    expect(creds.set).toHaveBeenCalledWith('http://h:3000/plugins/sk-video/', 'bow-cam', {
      username: 'admin',
      password: 'pw'
    });
    expect(videoGroup.get('cameraId')?.value).toBe('bow-cam');
  });

  it('does not save an invalid manual camera', async () => {
    cmp.manualForm.patchValue({ name: '', scheme: 'rtsp', host: '10.0.0.9' });
    await cmp.addCamera();
    expect(resources.save).not.toHaveBeenCalled();
  });

  it('loads the selected camera into the form for editing and saves back to the same id', async () => {
    videoGroup.get('cameraId')?.setValue('foredeck');
    const c = cmp as unknown as {
      editSelectedCamera: () => void;
      editingId: () => string | null;
    };
    c.editSelectedCamera();
    expect(c.editingId()).toBe('foredeck');
    expect(cmp.manualForm.get('name')?.value).toBe('Foredeck');
    expect(cmp.manualForm.get('host')?.value).toBe('10.0.0.5');

    cmp.manualForm.patchValue({ host: '10.0.0.99' });
    await cmp.addCamera();
    // Editing updates the SAME id (no new slug) and never generates a duplicate.
    expect(resources.save).toHaveBeenCalledWith('http://h:3000/signalk/v2/api', 'foredeck', {
      name: 'Foredeck',
      enabled: true,
      source: { scheme: 'rtsp', host: '10.0.0.99' }
    });
    expect(c.editingId()).toBeNull();
  });

  it('disables the selected camera via the enable toggle, preserving its source', async () => {
    videoGroup.get('cameraId')?.setValue('foredeck');
    await (cmp as unknown as { toggleEnabled: (enabled: boolean) => Promise<void> }).toggleEnabled(
      false
    );
    expect(resources.save).toHaveBeenCalledWith('http://h:3000/signalk/v2/api', 'foredeck', {
      name: 'Foredeck',
      enabled: false,
      source: { scheme: 'rtsp', host: '10.0.0.5' }
    });
  });

  it('looks up stored-credential presence when editing a camera', async () => {
    creds.presence.mockResolvedValue({ hasUsername: true, hasPassword: true });
    videoGroup.get('cameraId')?.setValue('foredeck');
    const c = cmp as unknown as {
      editSelectedCamera: () => void;
      credentialPresence: () => { hasUsername: boolean; hasPassword: boolean } | null;
    };
    c.editSelectedCamera();
    await Promise.resolve();
    await Promise.resolve();
    expect(creds.presence).toHaveBeenCalledWith('http://h:3000/plugins/sk-video/', 'foredeck');
    expect(c.credentialPresence()).toEqual({ hasUsername: true, hasPassword: true });
  });

  it('clears stored credentials for the camera being edited', async () => {
    creds.presence.mockResolvedValue({ hasUsername: true, hasPassword: true });
    videoGroup.get('cameraId')?.setValue('foredeck');
    const c = cmp as unknown as {
      editSelectedCamera: () => void;
      clearCredentials: () => Promise<void>;
      credentialPresence: () => { hasUsername: boolean; hasPassword: boolean } | null;
    };
    c.editSelectedCamera();
    await Promise.resolve();
    await c.clearCredentials();
    expect(creds.clear).toHaveBeenCalledWith('http://h:3000/plugins/sk-video/', 'foredeck');
    expect(c.credentialPresence()).toEqual({ hasUsername: false, hasPassword: false });
  });

  it('nudges the selected camera through the PTZ proxy on press and stops on release', async () => {
    videoGroup.get('cameraId')?.setValue('foredeck');
    const c = cmp as unknown as {
      startNudge: (pan: number, tilt: number, event?: Event) => Promise<void>;
      stopNudge: () => Promise<void>;
    };
    await c.startNudge(0.5, 0);
    expect(ptz.move).toHaveBeenCalledWith('http://h:3000/plugins/sk-video/', 'foredeck', {
      pan: 0.5,
      tilt: 0,
      zoom: 0
    });
    await c.stopNudge();
    expect(ptz.stop).toHaveBeenCalledWith('http://h:3000/plugins/sk-video/', 'foredeck');
  });

  it('does not send a PTZ command when no camera is selected', async () => {
    videoGroup.get('cameraId')?.setValue(null);
    await (
      cmp as unknown as { startNudge: (p: number, t: number) => Promise<void> }
    ).startNudge(0.5, 0);
    expect(ptz.move).not.toHaveBeenCalled();
  });

  it('shows a message when the camera rejects a PTZ command (no PTZ support)', async () => {
    ptz.move.mockRejectedValueOnce(new Error('PTZ command failed (502)'));
    videoGroup.get('cameraId')?.setValue('foredeck');
    const c = cmp as unknown as {
      startNudge: (p: number, t: number) => Promise<void>;
      ptzTestError: () => string | null;
    };
    await c.startNudge(0.5, 0);
    expect(c.ptzTestError()).toMatch(/PTZ/i);
  });
});

describe('VideoCameraSetupComponent — upload mode', () => {
  const assets = {
    list: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined)
  };

  let fixture: ComponentFixture<HostComponent>;
  let videoGroup: UntypedFormGroup;
  let cmp: { videos: () => unknown[]; uploadFile: (f: File) => Promise<void> };

  beforeEach(async () => {
    assets.list.mockResolvedValue([
      { id: 'v1', name: 'clip.mp4', contentType: 'video/mp4', size: 5 * 1024 * 1024, createdAt: 1 }
    ]);
    assets.upload.mockResolvedValue({ id: 'v2', name: 'new.mp4', contentType: 'video/mp4', size: 1, createdAt: 2 });

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: VideoAssetsClient, useValue: assets },
        {
          provide: SignalKConnectionService,
          useValue: {
            serverServiceEndpoint$: of({
              httpServiceUrl: 'http://h:3000/signalk/v1/api/',
              httpServiceUrlV2: 'http://h:3000/signalk/v2/api'
            }),
            signalKURL: { url: null }
          }
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    videoGroup = fixture.componentInstance.root.get('video') as UntypedFormGroup;
    fixture.detectChanges();
    videoGroup.get('sourceKind')?.setValue('file');
    await Promise.resolve();
    fixture.detectChanges();
    cmp = fixture.debugElement.query(By.directive(VideoCameraSetupComponent)).componentInstance as typeof cmp;
  });

  it('shows the upload UI and lists uploaded videos', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Upload a video');
    expect(cmp.videos()).toHaveLength(1);
    expect(videoGroup.get('fileAssetId')).toBeTruthy();
  });

  it('uploads a file and selects it', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'movie.mp4', { type: 'video/mp4' });
    await (cmp as unknown as { uploadFile: (f: File) => Promise<void> }).uploadFile(file);
    expect(assets.upload).toHaveBeenCalledWith('http://h:3000/plugins/sk-video/', file);
    expect(videoGroup.get('fileAssetId')?.value).toBe('v2');
  });
});
