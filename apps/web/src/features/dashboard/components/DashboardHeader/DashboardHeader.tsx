import { ChevronLeft, ChevronRight, Flame, Settings, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { parseISO } from 'date-fns';
import { useHouseholdStreak } from '@web/features/streaks';
import { useDashboardStore } from '@web/features/dashboard/store';
import Clock from './components/Clock';

interface DashboardHeaderProps {
  date: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const todayString = () => new Date().toLocaleDateString('sv');

const formatDate = (date: string): string =>
  parseISO(date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

const DashboardHeader = ({ date, onPrev, onNext, onToday }: DashboardHeaderProps) => {
  const { data: householdStreak } = useHouseholdStreak();
  const streak = householdStreak?.currentStreak ?? 0;
  const isToday = date === todayString();
  const isMuted = useDashboardStore((s) => s.isMuted);
  const toggleMuted = useDashboardStore((s) => s.toggleMuted);

  return (
    <header className="flex-none flex items-center justify-between px-3 sm:px-6 py-3 bg-slate-800 border-b border-slate-700/60">
      <div className="flex items-center gap-4 shrink-0">
        <Clock />
        <button
          onClick={onPrev}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center sm:gap-8 gap-0.5 min-w-0">
        <button
          onClick={onToday}
          disabled={isToday}
          className="text-base sm:text-xl font-semibold tracking-tight disabled:cursor-default hover:text-indigo-300 disabled:hover:text-white transition-colors cursor-pointer"
        >
          {formatDate(date)}
        </button>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 text-amber-400">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Familien-Streak: {streak}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={onNext}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        <button
          onClick={toggleMuted}
          className="p-2 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
          title={isMuted ? 'Ton einschalten' : 'Ton ausschalten'}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-slate-500" />
          ) : (
            <Volume2 className="w-5 h-5 text-slate-400 hover:text-white" />
          )}
        </button>
        <Link
          to="/admin"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <Settings className="w-5 h-5" />
        </Link>
      </div>
    </header>
  );
};

export default DashboardHeader;
