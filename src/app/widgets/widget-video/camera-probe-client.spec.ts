import { describe, it, expect, vi } from 'vitest';
import { CameraProbeClient } from './camera-probe-client';
import type { ICameraSource } from './camera-record.util';

const BASE = 'http://boat.local:3000/plugins/sk-video/';
const SOURCE: ICameraSource = { scheme: 'rtsp', host: 'cam.local', port: 554, path: '/s1' };

describe('CameraProbeClient', () => {
  it('POSTs the source to cameras/test and returns the result', async () => {
    const client = new CameraProbeClient();
    const fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, codec: 'h264', message: 'Reachable — 1280×720 H264' }),
    });
    client.fetchImpl = fetchImpl as never;

    const result = await client.test(BASE, { source: SOURCE, username: 'admin', password: 'pw' });

    expect(result).toEqual({ ok: true, codec: 'h264', message: 'Reachable — 1280×720 H264' });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://boat.local:3000/plugins/sk-video/cameras/test');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ source: SOURCE, username: 'admin', password: 'pw' });
  });

  it('returns a safe default when the response is not a result object', async () => {
    const client = new CameraProbeClient();
    client.fetchImpl = vi.fn().mockResolvedValue({ json: async () => null }) as never;
    const result = await client.test(BASE, { source: SOURCE });
    expect(result.ok).toBe(false);
  });

  it('throws when the plugin base url is missing', async () => {
    const client = new CameraProbeClient();
    await expect(client.test(null, { source: SOURCE })).rejects.toThrow();
  });
});
