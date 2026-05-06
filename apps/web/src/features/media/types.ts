export type Artist = {
  id: string;
  name: string;
  thumbnail_url: string;
};

export type Album = {
  browse_id: string;
  title: string;
  year: string | null;
  thumbnail_url: string;
  track_count: number | null;
};

export type MediaState = 'idle' | 'playing' | 'paused' | 'stopped' | 'error';

export type MediaStatus = {
  state: MediaState;
  album_title: string | null;
  device_name: string | null;
};
