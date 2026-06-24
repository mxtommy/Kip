import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ImageAssetService } from './image-asset.service';
import { SignalKConnectionService } from './signalk-connection.service';

function setup(httpServiceUrl: string | null, configuredUrl = '') {
  const http = { post: vi.fn(() => of({})), get: vi.fn(() => of([])), delete: vi.fn(() => of({ ok: true })) };
  const connection = {
    serverServiceEndpoint$: new BehaviorSubject<{ httpServiceUrl: string | null }>({ httpServiceUrl }),
    signalKURL: { url: configuredUrl }
  };
  TestBed.configureTestingModule({
    providers: [
      ImageAssetService,
      { provide: HttpClient, useValue: http },
      { provide: SignalKConnectionService, useValue: connection }
    ]
  });
  return { service: TestBed.inject(ImageAssetService), http };
}

describe('ImageAssetService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('becomes ready and builds variant URLs snapped to a container width', () => {
    const { service } = setup('http://host:3000/signalk/v1/api/');
    expect(service.ready).toBe(true);
    expect(service.urlFor('abc', 300, 1)).toBe('http://host:3000/plugins/kip/images/abc?w=320');
    expect(service.urlFor('abc', 320, 2)).toBe('http://host:3000/plugins/kip/images/abc?w=640');
    expect(service.urlFor(null, 300)).toBeNull();
  });

  it('is not ready and yields null URLs before an endpoint is known', () => {
    const { service } = setup(null);
    expect(service.ready).toBe(false);
    expect(service.urlFor('abc', 300)).toBeNull();
  });

  it('posts an upload as multipart FormData to the images endpoint', () => {
    const { service, http } = setup('http://host:3000/signalk/v1/api/');
    const file = new File([new Uint8Array([1, 2, 3])], 'map.png', { type: 'image/png' });
    service.upload(file).subscribe();
    expect(http.post).toHaveBeenCalledTimes(1);
    const [url, body, opts] = http.post.mock.calls[0] as unknown[];
    expect(url).toBe('http://host:3000/plugins/kip/images');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    expect(opts).toMatchObject({ reportProgress: true, observe: 'events' });
  });

  it('targets the right endpoints for list/delete/cache/purge', () => {
    const { service, http } = setup('http://host:3000/signalk/v1/api/');
    service.list().subscribe();
    expect(http.get).toHaveBeenCalledWith('http://host:3000/plugins/kip/images');
    service.delete('id-1').subscribe();
    expect(http.delete).toHaveBeenCalledWith('http://host:3000/plugins/kip/images/id-1');
    service.cacheStats().subscribe();
    expect(http.get).toHaveBeenCalledWith('http://host:3000/plugins/kip/images/cache');
    service.purgeCache().subscribe();
    expect(http.delete).toHaveBeenCalledWith('http://host:3000/plugins/kip/images/cache');
  });
});
