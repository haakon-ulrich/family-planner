import { useState } from 'react';
import { Loader2, Music } from 'lucide-react';
import { useAlbums, usePlay } from '@web/features/media/hooks';
import { useMediaStore } from '@web/features/media/store';
import type { Album } from '@web/features/media/types';

interface CellProps {
  album: Album;
  isCellLoading: boolean;
  disabled: boolean;
  onPlay: (browseId: string) => void;
}

const AlbumCell = ({ album, isCellLoading, disabled, onPlay }: CellProps) => {
  const [imgError, setImgError] = useState(false);
  return (
    <button
      onClick={() => onPlay(album.browse_id)}
      disabled={disabled}
      className={[
        'flex flex-col gap-2 text-left rounded-lg transition-opacity',
        disabled && !isCellLoading ? 'opacity-40' : 'hover:opacity-80',
      ].join(' ')}
    >
      <div className="relative aspect-square">
        {album.thumbnail_url && !imgError ? (
          <img
            src={album.thumbnail_url}
            alt={album.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full rounded-lg object-cover"
          />
        ) : (
          <div className="w-full h-full rounded-lg bg-slate-700 flex items-center justify-center">
            <Music className="w-12 h-12 text-slate-500" />
          </div>
        )}
        {isCellLoading && (
          <div className="absolute inset-0 rounded-lg bg-black/60 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-white leading-tight line-clamp-2">{album.title}</p>
        {album.year && <p className="text-xs text-slate-400 mt-0.5">{album.year}</p>}
      </div>
    </button>
  );
};

interface Props {
  artistId: string;
}

const AlbumGrid = ({ artistId }: Props) => {
  const { data: albums, isLoading } = useAlbums(artistId);
  const play = usePlay();
  const loadingBrowseId = useMediaStore((s) => s.loadingAlbumBrowseId);
  const setLoadingAlbum = useMediaStore((s) => s.setLoadingAlbum);

  const handlePlay = async (browseId: string) => {
    setLoadingAlbum(browseId);
    try {
      await play.mutateAsync(browseId);
    } finally {
      setLoadingAlbum(null);
    }
  };

  const isAnyLoading = loadingBrowseId !== null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-10 p-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="aspect-square rounded-lg bg-slate-700 animate-pulse" />
            <div className="h-4 w-3/4 bg-slate-700 rounded animate-pulse" />
            <div className="h-3 w-1/3 bg-slate-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-10 p-6">
      {albums?.map((album) => (
        <AlbumCell
          key={album.browse_id}
          album={album}
          isCellLoading={loadingBrowseId === album.browse_id}
          disabled={isAnyLoading}
          onPlay={(id) => void handlePlay(id)}
        />
      ))}
    </div>
  );
};

export default AlbumGrid;
