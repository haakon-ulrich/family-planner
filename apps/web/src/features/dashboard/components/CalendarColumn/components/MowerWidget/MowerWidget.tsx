import { AlertCircle, BatteryFull, BatteryMedium, BatteryWarning, Home, Loader2, Pause, RotateCcw, WifiOff, Zap } from 'lucide-react';
import { useMowerStatus } from '@web/features/mower';
import type { MowerStatusValue } from '@web/features/mower';
import RobotMowerIcon from '@web/ui/RobotMowerIcon';

type StateConfig = { Icon: React.ComponentType<{ className?: string }>; label: string; color: string };

const STATE_CONFIGS: Record<MowerStatusValue, StateConfig> = {
  mowing:    { Icon: Zap,          label: 'Mäht',           color: 'text-green-400'   },
  charging:  { Icon: Zap,          label: 'Lädt',           color: 'text-amber-400'   },
  docked:    { Icon: Home,         label: 'Im Dock',        color: 'text-slate-400'   },
  paused:    { Icon: Pause,        label: 'Pausiert',       color: 'text-amber-400'   },
  returning: { Icon: RotateCcw,    label: 'Fährt zurück',   color: 'text-blue-400'    },
  error:     { Icon: AlertCircle,  label: 'Fehler',         color: 'text-red-400'     },
  unknown:   { Icon: Loader2,      label: 'Unbekannt',      color: 'text-slate-500'   },
};

const batteryColor = (pct: number) =>
  pct >= 50 ? 'text-emerald-400' : pct >= 20 ? 'text-amber-400' : 'text-red-400';

const BatteryIcon = (pct: number) =>
  pct >= 50 ? BatteryFull : pct >= 20 ? BatteryMedium : BatteryWarning;

const MowerWidget = () => {
  const { data, isLoading, isError } = useMowerStatus();

  const isUnavailable = isLoading || isError || !data || !data.connected;

  return (
    <div className="border-t border-slate-700/50 px-5 py-4">
      <div className="flex items-center gap-2.5 mb-3">
        <RobotMowerIcon className="w-5 h-5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Mähroboter
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
              const statusKey = data.status ?? 'unknown';
              const { Icon, label, color } = STATE_CONFIGS[statusKey];
              return (
                <>
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className={`text-sm font-medium ${color}`}>
                    {label}
                    {data.progress_percent !== null && data.progress_percent !== undefined && (
                      <span className="ml-1 text-slate-400 font-normal">
                        {data.progress_percent}%
                      </span>
                    )}
                  </span>
                </>
              );
            })()}
          </div>

          {data.battery_percent !== null && data.battery_percent !== undefined && (() => {
            const BatIcon = BatteryIcon(data.battery_percent!);
            const color = batteryColor(data.battery_percent!);
            return (
              <div className={`flex items-center gap-1 ${color}`}>
                <BatIcon className="w-4 h-4" />
                <span className="text-sm tabular-nums">{data.battery_percent}%</span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default MowerWidget;
