import { AlertCircle, BatteryFull, BatteryMedium, BatteryWarning, Home, Pause, RotateCcw, WifiOff, Zap } from 'lucide-react';
import { useVacuumStatus } from '@web/features/vacuum';
import type { VacuumState } from '@web/features/vacuum';
import RobotVacuumIcon from '@web/ui/RobotVacuumIcon';

type StateConfig = { Icon: React.ComponentType<{ className?: string }>; label: string; color: string };

const STATE_CONFIGS: Record<VacuumState, StateConfig> = {
  docked:        { Icon: Home,             label: 'Im Dock',           color: 'text-emerald-400' },
  cleaning:      { Icon: Zap,              label: 'Reinigt',           color: 'text-blue-400'    },
  returning:     { Icon: RotateCcw,        label: 'Fährt zum Dock',    color: 'text-amber-400'   },
  idle:          { Icon: RobotVacuumIcon,  label: 'Bereit',            color: 'text-slate-400'   },
  paused:        { Icon: Pause,            label: 'Pausiert',          color: 'text-amber-400'   },
  error:         { Icon: AlertCircle,      label: 'Fehler',            color: 'text-red-400'     },
  offline:       { Icon: WifiOff,          label: 'Offline',           color: 'text-slate-500'   },
  auth_required: { Icon: RobotVacuumIcon,  label: 'Einrichtung nötig', color: 'text-amber-400'   },
};

const batteryColor = (pct: number) =>
  pct >= 50 ? 'text-emerald-400' : pct >= 20 ? 'text-amber-400' : 'text-red-400';

const BatteryIcon = (pct: number) =>
  pct >= 50 ? BatteryFull : pct >= 20 ? BatteryMedium : BatteryWarning;

const VacuumWidget = () => {
  const { data, isLoading, isError } = useVacuumStatus();

  const isUnavailable =
    isLoading ||
    isError ||
    !data ||
    data.state === 'offline' ||
    data.state === 'auth_required';

  return (
    <div className="border-t border-slate-700/50 px-5 py-4">
      <div className="flex items-center gap-2.5 mb-3">
        <RobotVacuumIcon className="w-5 h-5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Staubsauger
        </span>
      </div>

      {isUnavailable ? (
        <div className="flex items-center gap-2 text-slate-500">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span className="text-sm">Nicht verfügbar</span>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(() => {
              const { Icon, label, color } = STATE_CONFIGS[data.state];
              return (
                <>
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className={`text-sm font-medium ${color}`}>{label}</span>
                </>
              );
            })()}
          </div>

          {data.battery !== null && data.battery !== undefined && (() => {
            const BatIcon = BatteryIcon(data.battery);
            const color   = batteryColor(data.battery);
            return (
              <div className={`flex items-center gap-1 ${color}`}>
                <BatIcon className="w-4 h-4" />
                <span className="text-sm tabular-nums">{data.battery}%</span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default VacuumWidget;
