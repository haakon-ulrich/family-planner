import { useState } from 'react';
import { Music } from 'lucide-react';
import { useArtists } from '@web/features/media/hooks';
import { useMediaStore } from '@web/features/media/store';
import type { Artist } from '@web/features/media/types';

interface RowProps {
  artist: Artist;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const ArtistRow = ({ artist, isSelected, onSelect }: RowProps) => {
  const [imgError, setImgError] = useState(false);
  return (
    <button
      onClick={() => onSelect(artist.id)}
      className={[
        'flex items-center gap-3 px-4 py-3 w-full text-left transition-colors rounded-l-2xl',
        isSelected
          ? 'bg-slate-700 text-white'
          : 'text-slate-300 hover:bg-slate-700/60 hover:text-white',
      ].join(' ')}
    >
      {artist.thumbnail_url && !imgError ? (
        <img
          src={artist.thumbnail_url}
          alt={artist.name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-24 h-24 rounded object-cover shrink-0"
        />
      ) : (
        <div className="w-24 h-24 rounded bg-slate-700 flex items-center justify-center shrink-0">
          <Music className="w-8 h-8 text-slate-500" />
        </div>
      )}
      <span className="text-lg font-medium leading-tight">{artist.name}</span>
    </button>
  );
};

const ArtistList = () => {
  const { data: artists, isLoading } = useArtists();
  const selectedArtistId = useMediaStore((s) => s.selectedArtistId);
  const setSelectedArtist = useMediaStore((s) => s.setSelectedArtist);

  if (isLoading) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="w-24 h-24 rounded bg-slate-700 animate-pulse shrink-0" />
            <div className="h-5 w-32 bg-slate-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col pt-6 pl-6">
      {artists
        ?.sort((a, b) => a.name.localeCompare(b.name))
        .map((artist) => (
          <ArtistRow
            key={artist.id}
            artist={artist}
            isSelected={selectedArtistId === artist.id}
            onSelect={setSelectedArtist}
          />
        ))}
    </div>
  );
};

export default ArtistList;
