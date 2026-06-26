import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoAssetsClient, VideoUploadError, type AssetsFetch } from './video-assets-client';

const BASE = 'http://boat.local:3000/plugins/sk-video/';

function res(status: number, body?: unknown): Response {
  return { ok: status < 400, status, json: () => Promise.resolve(body) } as unknown as Response;
}

const asset = { id: 'v1', name: 'clip.mp4', contentType: 'video/mp4', size: 100, createdAt: 1 };

describe('VideoAssetsClient', () => {
  let client: VideoAssetsClient;
  let fetchMock: ReturnType<typeof vi.fn<AssetsFetch>>;

  beforeEach(() => {
    client = new VideoAssetsClient();
    fetchMock = vi.fn<AssetsFetch>();
    client.fetchImpl = fetchMock;
  });

  it('lists videos', async () => {
    fetchMock.mockResolvedValue(res(200, { videos: [asset] }));
    expect(await client.list(BASE)).toEqual([asset]);
    expect(fetchMock.mock.calls[0][0]).toBe('http://boat.local:3000/plugins/sk-video/videos');
  });

  it('uploads a file with its name and content type', async () => {
    fetchMock.mockResolvedValue(res(201, asset));
    const file = new File([new Uint8Array([1, 2, 3])], 'My Clip.mp4', { type: 'video/mp4' });
    const result = await client.upload(BASE, file);
    expect(result).toEqual(asset);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://boat.local:3000/plugins/sk-video/videos');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['X-Filename']).toBe('My%20Clip.mp4');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('video/mp4');
    expect(init?.body).toBe(file);
  });

  it('maps 413/415 to friendly upload errors', async () => {
    const file = new File([new Uint8Array([1])], 'x.mp4');
    fetchMock.mockResolvedValueOnce(res(413));
    await expect(client.upload(BASE, file)).rejects.toThrow(/too large|storage/i);
    fetchMock.mockResolvedValueOnce(res(415));
    await expect(client.upload(BASE, file)).rejects.toBeInstanceOf(VideoUploadError);
  });

  it('builds a same-origin playback URL and rejects unsafe ids', () => {
    expect(client.playbackUrl(BASE, 'v1')).toBe('http://boat.local:3000/plugins/sk-video/videos/v1');
    expect(client.playbackUrl(BASE, '../x')).toBeNull();
    expect(client.playbackUrl(null, 'v1')).toBeNull();
  });

  it('deletes a video and tolerates a missing one', async () => {
    fetchMock.mockResolvedValueOnce(res(204));
    await client.remove(BASE, 'v1');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE');
    fetchMock.mockResolvedValueOnce(res(404));
    await expect(client.remove(BASE, 'gone')).resolves.toBeUndefined();
  });
});
