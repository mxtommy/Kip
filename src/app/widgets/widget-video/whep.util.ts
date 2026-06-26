/** Minimal fetch signature so the WHEP exchange can be unit-tested with a fake. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  headers: { get(name: string): string | null };
}>;

export interface IWhepAnswer {
  answerSdp: string;
  /** The session resource URL to DELETE on teardown (from the Location header, resolved absolute). */
  resourceUrl: string;
}

/**
 * Performs the WHEP signaling exchange: POSTs the SDP offer and returns the SDP answer plus the
 * session resource URL (resolved from the Location header) used to end the session.
 */
export async function whepNegotiate(endpoint: string, offerSdp: string, fetchImpl: FetchLike): Promise<IWhepAnswer> {
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: offerSdp
  });
  if (!res.ok) {
    throw new Error(`WHEP negotiation failed: ${res.status}`);
  }
  const answerSdp = await res.text();
  const location = res.headers.get('Location');
  const resourceUrl = location ? new URL(location, endpoint).href : endpoint;
  return { answerSdp, resourceUrl };
}

/** Ends a WHEP session by DELETE-ing its resource URL (best-effort). */
export async function whepDelete(resourceUrl: string, fetchImpl: FetchLike): Promise<void> {
  await fetchImpl(resourceUrl, { method: 'DELETE' });
}
