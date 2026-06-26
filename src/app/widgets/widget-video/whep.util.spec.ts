import { describe, it, expect, vi } from 'vitest';
import { whepNegotiate, whepDelete, type FetchLike } from './whep.util';

function fakeResponse(opts: { ok?: boolean; status?: number; body?: string; location?: string | null }) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 201,
    text: () => Promise.resolve(opts.body ?? ''),
    headers: { get: (n: string) => (n.toLowerCase() === 'location' ? (opts.location ?? null) : null) }
  };
}

describe('whepNegotiate', () => {
  it('POSTs the SDP offer and returns the answer + absolute resource URL', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(fakeResponse({ body: 'v=0...answer', location: '/whep/session/42' }));
    };

    const res = await whepNegotiate('https://gw.local/api/webrtc?src=cam', 'v=0...offer', fetchImpl);

    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.body).toBe('v=0...offer');
    expect((calls[0].init?.headers as Record<string, string>)['Content-Type']).toBe('application/sdp');
    expect(res.answerSdp).toBe('v=0...answer');
    // Location is relative → resolved against the endpoint origin.
    expect(res.resourceUrl).toBe('https://gw.local/whep/session/42');
  });

  it('falls back to the endpoint as the resource URL when no Location header is returned', async () => {
    const fetchImpl: FetchLike = () => Promise.resolve(fakeResponse({ body: 'answer', location: null }));
    const res = await whepNegotiate('https://gw.local/api/webrtc?src=cam', 'offer', fetchImpl);
    expect(res.resourceUrl).toBe('https://gw.local/api/webrtc?src=cam');
  });

  it('throws on a non-OK response', async () => {
    const fetchImpl: FetchLike = () => Promise.resolve(fakeResponse({ ok: false, status: 404, body: '' }));
    await expect(whepNegotiate('https://gw.local/whep', 'offer', fetchImpl)).rejects.toThrow(/404/);
  });
});

describe('whepDelete', () => {
  it('DELETEs the resource URL', async () => {
    const fetchImpl = vi.fn<FetchLike>(() => Promise.resolve(fakeResponse({ status: 200 })));
    await whepDelete('https://gw.local/whep/session/42', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('https://gw.local/whep/session/42', { method: 'DELETE' });
  });
});
