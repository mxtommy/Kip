import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PtzClient, type PtzFetch } from './ptz-client';

const BASE = 'http://boat.local:3000/plugins/sk-video/';
const ID = 'foredeck';

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}
function status(code: number): Response {
  return { ok: code < 400, status: code, json: () => Promise.resolve({}) } as unknown as Response;
}

describe('PtzClient', () => {
  let client: PtzClient;
  let fetchMock: ReturnType<typeof vi.fn<PtzFetch>>;

  beforeEach(() => {
    client = new PtzClient();
    fetchMock = vi.fn<PtzFetch>().mockResolvedValue(status(204));
    client.fetchImpl = fetchMock;
  });

  it('POSTs a clamped move to the ptz endpoint', async () => {
    await client.move(BASE, ID, { pan: 2, tilt: -0.5 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://boat.local:3000/plugins/sk-video/cameras/foredeck/ptz');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ pan: 1, tilt: -0.5, zoom: 0 });
  });

  it('POSTs stop', async () => {
    await client.stop(BASE, ID);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://boat.local:3000/plugins/sk-video/cameras/foredeck/ptz/stop'
    );
  });

  it('POSTs a preset token', async () => {
    await client.gotoPreset(BASE, ID, 'preset-2');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://boat.local:3000/plugins/sk-video/cameras/foredeck/ptz/preset');
    expect(JSON.parse(init?.body as string)).toEqual({ token: 'preset-2' });
  });

  it('normalizes a name→token preset map into a sorted array', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ Dock: 'tok-1', Anchor: 'tok-2' }));
    const presets = await client.listPresets(BASE, ID);
    expect(presets).toEqual([
      { name: 'Anchor', token: 'tok-2' },
      { name: 'Dock', token: 'tok-1' }
    ]);
  });

  it('accepts an array of presets too', async () => {
    fetchMock.mockResolvedValueOnce(okJson([{ token: 't', name: 'Bow' }, { token: 'u' }]));
    const presets = await client.listPresets(BASE, ID);
    expect(presets).toEqual([
      { token: 't', name: 'Bow' },
      { token: 'u', name: 'u' }
    ]);
  });

  it('throws when the camera/base is unavailable (never calls fetch)', async () => {
    await expect(client.move(null, ID, { pan: 1 })).rejects.toThrow(/unavailable/i);
    await expect(client.move(BASE, '../x', { pan: 1 })).rejects.toThrow(/unavailable/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce(status(502));
    await expect(client.move(BASE, ID, { pan: 1 })).rejects.toThrow(/failed/i);
  });
});
