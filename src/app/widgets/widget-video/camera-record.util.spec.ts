import { buildCameraRecord, candidateToFields, slugifyCameraId } from './camera-record.util';

describe('buildCameraRecord', () => {
  it('builds a normalized record from valid fields', () => {
    const r = buildCameraRecord({
      name: 'Foredeck',
      scheme: 'RTSP',
      host: '192.168.1.50',
      port: '554',
      path: '/stream1'
    });
    expect(r.valid).toBe(true);
    expect(r.value).toEqual({
      name: 'Foredeck',
      enabled: true,
      source: { scheme: 'rtsp', host: '192.168.1.50', port: 554, path: '/stream1' }
    });
  });

  it('omits an empty port and path', () => {
    const r = buildCameraRecord({ name: 'Cam', scheme: 'http', host: 'cam.local' });
    expect(r.value).toEqual({ name: 'Cam', enabled: true, source: { scheme: 'http', host: 'cam.local' } });
  });

  it('rejects a missing name, bad scheme, bad host, bad port and traversal path', () => {
    expect(buildCameraRecord({ scheme: 'rtsp', host: 'h' }).errors).toContain('Name is required');
    expect(buildCameraRecord({ name: 'n', scheme: 'exec', host: 'h' }).errors).toContain(
      'Choose a valid stream type'
    );
    expect(buildCameraRecord({ name: 'n', scheme: 'rtsp', host: 'a b' }).valid).toBe(false);
    expect(buildCameraRecord({ name: 'n', scheme: 'rtsp', host: 'h', port: 70000 }).valid).toBe(false);
    expect(buildCameraRecord({ name: 'n', scheme: 'rtsp', host: 'h', path: '/a/../b' }).valid).toBe(false);
    expect(buildCameraRecord({ name: 'n', scheme: 'rtsp', host: 'h', path: 'no-slash' }).valid).toBe(false);
  });
});

describe('slugifyCameraId', () => {
  it('produces a safe slug', () => {
    expect(slugifyCameraId('Fore Deck #1')).toBe('fore-deck-1');
    expect(slugifyCameraId('  -- ')).toBe('camera');
  });
});

describe('candidateToFields', () => {
  it('seeds the manual form from a discovered camera', () => {
    expect(candidateToFields({ name: 'Aft', host: '10.0.0.7', port: 554 })).toEqual({
      name: 'Aft',
      host: '10.0.0.7',
      port: 554,
      scheme: 'rtsp'
    });
  });
});
