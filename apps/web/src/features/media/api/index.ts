import type { Album, Artist, MediaStatus } from '../types';

const json = async <T>(res: Response): Promise<T> => {
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? 'Request failed');
  return body.data as T;
};

export const fetchArtists = (): Promise<Artist[]> =>
  fetch('/api/media/artists').then((r) => json<Artist[]>(r));

export const fetchAlbums = (artistId: string): Promise<Album[]> =>
  fetch(`/api/media/artists/${artistId}/albums`).then((r) => json<Album[]>(r));

export const fetchMediaStatus = (): Promise<MediaStatus> =>
  fetch('/api/media/status').then((r) => json<MediaStatus>(r));

export const postPlay = (albumBrowseId: string): Promise<{ ok: boolean; album_title: string; track_count: number }> =>
  fetch('/api/media/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ album_browse_id: albumBrowseId }),
  }).then((r) => json(r));

export const postPause = (): Promise<{ ok: boolean }> =>
  fetch('/api/media/pause', { method: 'POST' }).then((r) => json(r));

export const postResume = (): Promise<{ ok: boolean }> =>
  fetch('/api/media/resume', { method: 'POST' }).then((r) => json(r));

export const postStop = (): Promise<{ ok: boolean }> =>
  fetch('/api/media/stop', { method: 'POST' }).then((r) => json(r));

export const postSkip = (trackIndex: number): Promise<{ ok: boolean }> =>
  fetch('/api/media/skip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_index: trackIndex }),
  }).then((r) => json(r));
