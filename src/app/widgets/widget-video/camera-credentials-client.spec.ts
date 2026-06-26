import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraCredentialsClient, type CredentialsFetch } from './camera-credentials-client';

const BASE = 'http://boat.local:3000/plugins/sk-video/';

function res(status: number): Response {
  return { ok: status < 400, status } as unknown as Response;
}

describe('CameraCredentialsClient', () => {
  let client: CameraCredentialsClient;
  let fetchMock: ReturnType<typeof vi.fn<CredentialsFetch>>;

  beforeEach(() => {
    client = new CameraCredentialsClient();
    fetchMock = vi.fn<CredentialsFetch>().mockResolvedValue(res(204));
    client.fetchImpl = fetchMock;
  });

  it('POSTs credentials to the write-only endpoint', async () => {
    await client.set(BASE, 'foredeck', { username: 'admin', password: 'pw' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://boat.local:3000/plugins/sk-video/cameras/foredeck/credentials');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ username: 'admin', password: 'pw' });
  });

  it('rejects an unsafe id or missing server before any request', async () => {
    await expect(client.set(BASE, '../x', { username: 'a' })).rejects.toThrow(/invalid/i);
    await expect(client.set(null, 'foredeck', { username: 'a' })).rejects.toThrow(/not connected/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears credentials and tolerates a missing record', async () => {
    fetchMock.mockResolvedValueOnce(res(204));
    await client.clear(BASE, 'foredeck');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE');
    fetchMock.mockResolvedValueOnce(res(404));
    await expect(client.clear(BASE, 'gone')).resolves.toBeUndefined();
  });

  it('GETs credential presence and returns the booleans (never a secret)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ hasUsername: true, hasPassword: false })
    } as unknown as Response);
    const p = await client.presence(BASE, 'foredeck');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://boat.local:3000/plugins/sk-video/cameras/foredeck/credentials');
    expect(init?.method).toBe('GET');
    expect(p).toEqual({ hasUsername: true, hasPassword: false });
  });

  it('treats a missing presence endpoint (older plugin / 404) as nothing stored', async () => {
    fetchMock.mockResolvedValueOnce(res(404));
    expect(await client.presence(BASE, 'foredeck')).toEqual({
      hasUsername: false,
      hasPassword: false
    });
  });
});
