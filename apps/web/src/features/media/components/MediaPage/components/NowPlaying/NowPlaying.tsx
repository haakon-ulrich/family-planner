import { useEffect, useRef, useState } from 'react';
import { Music, Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react';
import { useMediaStatus, usePause, useResume, useSkip, useStop } from '@web/features/media/hooks';

const NowPlaying = () => {
  const { data: status } = useMediaStatus();
  const pause = usePause();
  const resume = useResume();
  const stop = useStop();
  const skip = useSkip();
  const [imgError, setImgError] = useState(false);
  const [pendingTrackIndex, setPendingTrackIndex] = useState<number | null>(null);
  const skipRef = useRef(skip);
  skipRef.current = skip;

  useEffect(() => {
    setImgError(false);
  }, [status?.album_thumbnail_url]);

  // Fire the debounced skip API call 350 ms after the last tap. Only resets
  // pendingTrackIndex when the server has caught up to the value we sent.
  useEffect(() => {
    if (pendingTrackIndex === null) return;
    const capturedIndex = pendingTrackIndex;
    const timer = setTimeout(() => {
      skipRef.current.mutate(capturedIndex, {
        onSettled: () =>
          setPendingTrackIndex((current) => (current === capturedIndex ? null : current)),
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [pendingTrackIndex]);

  if (!status || status.state === 'idle' || status.state === 'stopped') return null;

  const isPlaying = status.state === 'playing';
  const isPaused = status.state === 'paused';
  const isBusy = pause.isPending || resume.isPending || stop.isPending;

  const trackCount = status.track_count ?? 0;
  const displayedIndex = pendingTrackIndex ?? status.track_index ?? 0;
  const canSkipBack = displayedIndex > 0;
  const canSkipForward = trackCount > 0 && displayedIndex < trackCount - 1;

  const handleSkipBack = () => {
    if (!canSkipBack) return;
    setPendingTrackIndex(displayedIndex - 1);
  };

  const handleSkipForward = () => {
    if (!canSkipForward) return;
    setPendingTrackIndex(displayedIndex + 1);
  };

  const handlePlayPause = () => {
    if (isPlaying) void pause.mutateAsync();
    else if (isPaused) void resume.mutateAsync();
  };

  return (
    <div className="flex items-center gap-5 px-6 py-5 bg-slate-800 border-b border-slate-700 shrink-0">
      {status.album_thumbnail_url && !imgError ? (
        <img
          src={status.album_thumbnail_url}
          alt={status.album_title ?? ''}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-20 h-20 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="w-20 h-20 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
          <Music className="w-8 h-8 text-slate-500" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-white text-lg font-semibold leading-tight truncate">
          {status.album_title ?? '—'}
        </p>
        {trackCount > 0 ? (
          <p className="text-slate-400 text-sm mt-1">
            Track {displayedIndex + 1} / {trackCount}
          </p>
        ) : (
          status.device_name && (
            <p className="text-slate-400 text-sm mt-1 truncate">{status.device_name}</p>
          )
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleSkipBack}
          disabled={isBusy || !canSkipBack}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 transition-colors"
        >
          <SkipBack className="w-6 h-6 text-white" />
        </button>
        <button
          onClick={handlePlayPause}
          disabled={isBusy || (!isPlaying && !isPaused)}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-green-600 hover:bg-green-500 disabled:opacity-40 transition-colors"
        >
          {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white" />}
        </button>
        <button
          onClick={handleSkipForward}
          disabled={isBusy || !canSkipForward}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 transition-colors"
        >
          <SkipForward className="w-6 h-6 text-white" />
        </button>
        <button
          onClick={() => void stop.mutateAsync()}
          disabled={isBusy}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-colors"
        >
          <Square className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );
};

export default NowPlaying;
