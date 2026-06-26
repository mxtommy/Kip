import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraDiscoveryClient, DiscoveryRateLimitedError, type DiscoveryFetch } from './discovery-client';

const BASE = 'http://boat.local:3000/plugins/sk-video/';

function res(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status < 400,
    status,
    headers: { get: (k: string) => headers[k] ?? null },
    json: () => Promise.resolve(body)
  } as unknown as Response;
}

describe('CameraDiscoveryClient', () => {
  let client: CameraDiscoveryClient;
  let fetchMock: ReturnType<typeof vi.fn<DiscoveryFetch>>;

  beforeEach(() => {
    client = new CameraDiscoveryClient();
    fetchMock = vi.fn<DiscoveryFetch>();
    client.fetchImpl = fetchMock;
  });

  it('GETs the discover endpoint and returns the candidates', async () => {
    fetchMock.mockResolvedValue(res(200, { cameras: [{ name: 'Aft', host: '10.0.0.7' }] }));
    const found = await client.scan(BASE);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://boat.local:3000/plugins/sk-video/cameras/discover'
    );
    expect(found).toEqual([{ name: 'Aft', host: '10.0.0.7' }]);
  });

  it('returns an empty array when the body has no cameras', async () => {
    fetchMock.mockResolvedValue(res(200, {}));
    expect(await client.scan(BASE)).toEqual([]);
  });

  it('throws a rate-limited error with the retry hint on 429', async () => {
    fetchMock.mockResolvedValue(res(429, {}, { 'Retry-After': '8' }));
    await expect(client.scan(BASE)).rejects.toBeInstanceOf(DiscoveryRateLimitedError);
    try {
      await client.scan(BASE);
    } catch (e) {
      expect((e as DiscoveryRateLimitedError).retryAfterSeconds).toBe(8);
    }
  });

  it('throws when the plugin base is unavailable (no fetch)', async () => {
    await expect(client.scan(null)).rejects.toThrow(/unavailable/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
