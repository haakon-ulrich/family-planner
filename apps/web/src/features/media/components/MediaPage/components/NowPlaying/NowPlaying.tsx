import { useState } from 'react';
import { Music, Pause, Play, Square } from 'lucide-react';
import { useMediaStatus, usePause, useResume, useStop } from '@web/features/media/hooks';

const NowPlaying = () => {
  const { data: status } = useMediaStatus();
  const pause = usePause();
  const resume = useResume();
  const stop = useStop();
  const [imgError, setImgError] = useState(false);

  if (!status || status.state === 'idle' || status.state === 'stopped') return null;

  const isPlaying = status.state === 'playing';
  const isPaused = status.state === 'paused';
  const isBusy = pause.isPending || resume.isPending || stop.isPending;

  const handlePlayPause = () => {
    if (isPlaying) void pause.mutateAsync();
    else if (isPaused) void resume.mutateAsync();
  };

  return (
    <div className="flex items-center gap-4 px-6 py-4 bg-slate-800 border-b border-slate-700 shrink-0">
      {status.album_thumbnail_url && !imgError ? (
        <img
          src={status.album_thumbnail_url}
          alt={status.album_title ?? ''}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-14 h-14 rounded object-cover shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded bg-slate-700 flex items-center justify-center shrink-0">
          <Music className="w-6 h-6 text-slate-500" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-white font-medium leading-tight truncate">
          {status.album_title ?? '—'}
        </p>
        {status.device_name && (
          <p className="text-slate-400 text-sm mt-0.5 truncate">{status.device_name}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handlePlayPause}
          disabled={isBusy || (!isPlaying && !isPaused)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 transition-colors"
        >
          {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
        </button>
        <button
          onClick={() => void stop.mutateAsync()}
          disabled={isBusy}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 transition-colors"
        >
          <Square className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
};

export default NowPlaying;
