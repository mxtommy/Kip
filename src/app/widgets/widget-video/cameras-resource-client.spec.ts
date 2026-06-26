import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CamerasResourceClient, type ResourceFetch } from './cameras-resource-client';
import type { ICameraRecord } from './camera-record.util';

const V2 = 'http://boat.local:3000/signalk/v2/api';

function res(status: number, body?: unknown): Response {
  return { ok: status < 400, status, json: () => Promise.resolve(body) } as unknown as Response;
}

const record: ICameraRecord = {
  name: 'Foredeck',
  enabled: true,
  source: { scheme: 'rtsp', host: '10.0.0.5', port: 554, path: '/s1' }
};

describe('CamerasResourceClient', () => {
  let client: CamerasResourceClient;
  let fetchMock: ReturnType<typeof vi.fn<ResourceFetch>>;

  beforeEach(() => {
    client = new CamerasResourceClient();
    fetchMock = vi.fn<ResourceFetch>();
    client.fetchImpl = fetchMock;
  });

  it('lists cameras from the resource map, sorted by name', async () => {
    fetchMock.mockResolvedValue(
      res(200, {
        zulu: { name: 'Zulu', enabled: true, source: { scheme: 'rtsp', host: 'z' } },
        alpha: { name: 'Alpha', enabled: true, source: { scheme: 'rtsp', host: 'a' } }
      })
    );
    const list = await client.list(V2);
    expect(fetchMock.mock.calls[0][0]).toBe('http://boat.local:3000/signalk/v2/api/resources/cameras');
    expect(list.map((c) => c.id)).toEqual(['alpha', 'zulu']);
  });

  it('treats a 404 collection as empty', async () => {
    fetchMock.mockResolvedValue(res(404));
    expect(await client.list(V2)).toEqual([]);
  });

  it('PUTs a camera record to its id', async () => {
    fetchMock.mockResolvedValue(res(200));
    await client.save(V2, 'foredeck', record);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://boat.local:3000/signalk/v2/api/resources/cameras/foredeck');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual(record);
  });

  it('rejects an unsafe id before any request', async () => {
    await expect(client.save(V2, '../x', record)).rejects.toThrow(/invalid/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the server is not connected', async () => {
    await expect(client.list(null)).rejects.toThrow(/not connected/i);
  });

  it('deletes a camera and tolerates a missing one', async () => {
    fetchMock.mockResolvedValueOnce(res(200));
    await client.remove(V2, 'foredeck');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE');
    fetchMock.mockResolvedValueOnce(res(404));
    await expect(client.remove(V2, 'gone')).resolves.toBeUndefined();
  });
});
