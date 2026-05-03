import { AlertCircle, Bot, Home, Lock, Pause, RotateCcw, WifiOff, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useVacuumStatus } from '@web/features/vacuum';
import type { VacuumState } from '@web/features/vacuum';

type StateConfig = { Icon: LucideIcon; label: string; color: string };

const STATE_CONFIGS: Record<VacuumState, StateConfig> = {
  docked: { Icon: Home, label: 'Im Dock', color: 'text-emerald-400' },
  cleaning: { Icon: Zap, label: 'Reinigt', color: 'text-blue-400' },
  returning: { Icon: RotateCcw, label: 'Fährt zum Dock', color: 'text-amber-400' },
  idle: { Icon: Bot, label: 'Bereit', color: 'text-slate-400' },
  paused: { Icon: Pause, label: 'Pausiert', color: 'text-amber-400' },
  error: { Icon: AlertCircle, label: 'Fehler', color: 'text-red-400' },
  offline: { Icon: WifiOff, label: 'Offline', color: 'text-slate-500' },
  auth_required: { Icon: Lock, label: 'Einrichtung nötig', color: 'text-amber-400' },
};

const UNREACHABLE_CONFIG: StateConfig = {
  Icon: WifiOff,
  label: 'Nicht erreichbar',
  color: 'text-slate-500',
};

const batteryColor = (pct: number) => {
  if (pct >= 50) return 'text-emerald-400';
  if (pct >= 20) return 'text-amber-400';
  return 'text-red-400';
};

const VacuumWidget = () => {
  const { data, isLoading, isError } = useVacuumStatus();

  if (isLoading) return null;

  const { Icon, label, color } = !isError && data ? STATE_CONFIGS[data.state] : UNREACHABLE_CONFIG;

  return (
    <div className="border-t border-slate-700/50 px-5 py-4">
      <div className="flex items-center gap-2.5 mb-3">
        <Bot className="w-5 h-5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Staubsauger
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className={`text-sm font-medium ${color}`}>{label}</span>
        </div>

        {data?.battery !== null && data?.battery !== undefined && (
          <span className={`text-sm tabular-nums ${batteryColor(data.battery)}`}>
            {data.battery}%
          </span>
        )}
      </div>
    </div>
  );
};

export default VacuumWidget;
