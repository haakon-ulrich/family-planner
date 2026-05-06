import { useMediaStore } from '@web/features/media/store';
import AlbumGrid from './components/AlbumGrid';
import ArtistList from './components/ArtistList';
import NowPlaying from './components/NowPlaying';

const MediaPage = () => {
  const selectedArtistId = useMediaStore((s) => s.selectedArtistId);

  return (
    <div className="flex h-full bg-slate-900 text-white">
      {/* Left 1/4 — artist list, scrolls independently */}
      <div className="w-1/4 shrink-0 border-r border-slate-700 overflow-y-auto">
        <ArtistList />
      </div>

      {/* Right 3/4 — now playing bar + album grid */}
      <div className="flex-1 flex flex-col min-w-0">
        <NowPlaying />
        <div className="flex-1 overflow-y-auto">
          {selectedArtistId === null ? (
            <div className="flex h-full items-center justify-center text-slate-500 text-lg">
              Hörspiel auswählen
            </div>
          ) : (
            <AlbumGrid artistId={selectedArtistId} />
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaPage;
