import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAlbums, fetchArtists, fetchMediaStatus, postPause, postPlay, postResume, postStop } from '../api';

export const MEDIA_ARTISTS_KEY = ['media', 'artists'] as const;
export const mediaAlbumsKey = (artistId: string) => ['media', 'albums', artistId] as const;
export const MEDIA_STATUS_KEY = ['media', 'status'] as const;

export const useArtists = () =>
  useQuery({
    queryKey: MEDIA_ARTISTS_KEY,
    queryFn: fetchArtists,
    staleTime: Infinity,
  });

export const useAlbums = (artistId: string | null) =>
  useQuery({
    queryKey: mediaAlbumsKey(artistId ?? ''),
    queryFn: () => fetchAlbums(artistId!),
    enabled: artistId !== null,
    staleTime: 10 * 60 * 1000,
  });

export const useMediaStatus = () =>
  useQuery({
    queryKey: MEDIA_STATUS_KEY,
    queryFn: fetchMediaStatus,
    refetchInterval: 5_000,
  });

export const usePlay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (albumBrowseId: string) => postPlay(albumBrowseId),
    onSettled: () => qc.invalidateQueries({ queryKey: MEDIA_STATUS_KEY }),
  });
};

export const usePause = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postPause,
    onSettled: () => qc.invalidateQueries({ queryKey: MEDIA_STATUS_KEY }),
  });
};

export const useResume = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postResume,
    onSettled: () => qc.invalidateQueries({ queryKey: MEDIA_STATUS_KEY }),
  });
};

export const useStop = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postStop,
    onSettled: () => qc.invalidateQueries({ queryKey: MEDIA_STATUS_KEY }),
  });
};
