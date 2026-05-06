import { useEffect, useState } from 'react';
import { Music, Pause, Play, Square } from 'lucide-react';
import { useMediaStatus, usePause, useResume, useStop } from '@web/features/media/hooks';

const MediaWidget = () => {
  const { data: status } = useMediaStatus();
  const pause = usePause();
  const resume = useResume();
  const stop = useStop();
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [status?.album_thumbnail_url]);

  if (!status || status.state === 'idle' || status.state === 'stopped') return null;

  const isPlaying = status.state === 'playing';
  const isPaused = status.state === 'paused';
  const isBusy = pause.isPending || resume.isPending || stop.isPending;

  const handlePlayPause = () => {
    if (isPlaying) void pause.mutateAsync();
    else if (isPaused) void resume.mutateAsync();
  };

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-700/50">
      {status.album_thumbnail_url && !imgError ? (
        <img
          src={status.album_thumbnail_url}
          alt={status.album_title ?? ''}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-10 h-10 rounded object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center shrink-0">
          <Music className="w-4 h-4 text-slate-500" />
        </div>
      )}

      <p className="flex-1 min-w-0 text-sm font-medium text-white truncate">
        {status.album_title ?? '—'}
      </p>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handlePlayPause}
          disabled={isBusy || (!isPlaying && !isPaused)}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-green-600 hover:bg-green-500 disabled:opacity-40 transition-colors"
        >
          {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
        </button>
        <button
          onClick={() => void stop.mutateAsync()}
          disabled={isBusy}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-colors"
        >
          <Square className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
};

export default MediaWidget;
