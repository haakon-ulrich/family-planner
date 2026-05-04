import { AlertCircle, BatteryFull, BatteryMedium, BatteryWarning, Droplet, Droplets, Home, Pause, RotateCcw, Trash2, Waves, Wind, WifiOff, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useVacuumStatus, useVacuumRooms, useClean, useDock, useStop } from '@web/features/vacuum/hooks';
import { useVacuumStore } from '@web/features/vacuum/store';
import type { FanSpeed, MopIntensity, VacuumState } from '@web/features/vacuum/api';

import RobotVacuumIcon from '@web/ui/RobotVacuumIcon';

// ── State config ─────────────────────────────────────────────────────────────

type IconComponent = React.ComponentType<{ className?: string }>;

const STATE_CONFIG: Record<VacuumState, { Icon: LucideIcon | IconComponent; label: string; color: string }> = {
  docked:        { Icon: Home,             label: 'Im Dock',           color: 'text-emerald-400' },
  cleaning:      { Icon: Zap,              label: 'Reinigt',           color: 'text-blue-400'    },
  returning:     { Icon: RotateCcw,        label: 'Fährt zur Basis',   color: 'text-amber-400'   },
  idle:          { Icon: RobotVacuumIcon,  label: 'Bereit',            color: 'text-slate-400'   },
  paused:        { Icon: Pause,            label: 'Pausiert',          color: 'text-amber-400'   },
  error:         { Icon: AlertCircle,      label: 'Fehler',            color: 'text-red-400'     },
  offline:       { Icon: WifiOff,          label: 'Offline',           color: 'text-slate-500'   },
  auth_required: { Icon: RobotVacuumIcon,  label: 'Einrichtung nötig', color: 'text-amber-400'   },
  washing_mop:   { Icon: Waves,            label: 'Wäscht Mopp',       color: 'text-cyan-400'    },
  drying_mop:    { Icon: Wind,             label: 'Trocknet Mopp',     color: 'text-sky-300'     },
  emptying_bin:  { Icon: Trash2,           label: 'Leert Behälter',    color: 'text-slate-400'   },
};

const batteryColor = (pct: number) =>
  pct >= 50 ? 'text-emerald-400' : pct >= 20 ? 'text-amber-400' : 'text-red-400';

const BatteryIcon = (pct: number) =>
  pct >= 50 ? BatteryFull : pct >= 20 ? BatteryMedium : BatteryWarning;

// ── Slider options ────────────────────────────────────────────────────────────

const FAN_OPTIONS: { value: FanSpeed; label: string }[] = [
  { value: 'quiet',    label: 'Leise'  },
  { value: 'balanced', label: 'Normal' },
  { value: 'turbo',    label: 'Turbo'  },
  { value: 'max',      label: 'Max'    },
  { value: 'max_plus', label: 'Max+'   },
];

const MOP_OPTIONS: { value: MopIntensity; label: string }[] = [
  { value: 'off',      label: 'Aus'    },
  { value: 'slight',   label: 'Min'    },
  { value: 'low',      label: 'Niedrig'},
  { value: 'medium',   label: 'Mittel' },
  { value: 'moderate', label: 'Stark'  },
  { value: 'high',     label: 'Hoch'   },
  { value: 'extreme',  label: 'Max'    },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
    {children}
  </p>
);

const DiscreteSlider = <T extends string>({
  options,
  value,
  onChange,
  disabled,
  LeftIcon,
  RightIcon,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  LeftIcon: LucideIcon;
  RightIcon: LucideIcon;
}) => {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <LeftIcon className="w-4 h-4 flex-none text-slate-500" />
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={options.length - 1}
            step={1}
            value={idx}
            disabled={disabled}
            onChange={(e) => onChange(options[Number(e.target.value)].value)}
            className="w-full accent-indigo-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          />
          {/* Tick dots aligned under each stop; px-[7px] offsets for thumb half-width */}
          <div className="flex justify-between px-1.75 -mt-0.5">
            {options.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i <= idx ? 'bg-indigo-500' : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
        </div>
        <RightIcon className="w-4 h-4 flex-none text-slate-400" />
      </div>
      <p className="text-center text-xs text-slate-400">{options[idx].label}</p>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const VacuumControlPanel = () => {
  const { data: status } = useVacuumStatus();
  const { data: rooms }  = useVacuumRooms();
  const { selectedRoomIds, toggleRoomId, fanSpeed, setFanSpeed, mopIntensity, setMopIntensity } =
    useVacuumStore();
  const clean = useClean();
  const dock  = useDock();
  const stop  = useStop();

  const state     = status?.state ?? 'offline';
  const isActive  = state === 'cleaning' || state === 'returning';
  const isOffline = state === 'error' || state === 'offline' || state === 'auth_required';
  const isActing  = clean.isPending || dock.isPending || stop.isPending;
  const canStart  = !isOffline && !isActive && !isActing && selectedRoomIds.length > 0;

  const { Icon, label, color } = STATE_CONFIG[state];

  const handleClean = () => {
    if (selectedRoomIds.length === 0) return;
    clean.mutate({ room_ids: selectedRoomIds, repeats: 1, fan_speed: fanSpeed, mop_intensity: mopIntensity });
  };

  return (
    <div className="flex-2 flex flex-col border-l border-slate-700/40 min-w-0 overflow-hidden">

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-8 pt-8 pb-4 space-y-7">

        {/* Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Icon className={`w-5 h-5 ${color}`} />
            <span className={`text-base font-semibold ${color}`}>{label}</span>
          </div>
          {status?.battery != null && (() => {
            const BatIcon = BatteryIcon(status.battery);
            const color   = batteryColor(status.battery);
            return (
              <div className={`flex items-center gap-1 ${color}`}>
                <BatIcon className="w-4 h-4" />
                <span className="text-sm tabular-nums font-medium">{status.battery}%</span>
              </div>
            );
          })()}
        </div>

        {/* Rooms */}
        <div>
          <SectionLabel>Räume</SectionLabel>
          {rooms && rooms.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {rooms.map((room) => {
                const active = selectedRoomIds.includes(room.id);
                return (
                  <button
                    key={room.id}
                    onClick={() => toggleRoomId(room.id)}
                    disabled={isOffline || isActive}
                    className={[
                      'px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white',
                    ].join(' ')}
                  >
                    {room.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Keine Räume verfügbar</p>
          )}
        </div>

        {/* Fan speed */}
        <div>
          <SectionLabel>Saugleistung</SectionLabel>
          <DiscreteSlider
            options={FAN_OPTIONS}
            value={fanSpeed}
            onChange={setFanSpeed}
            disabled={isOffline}
            LeftIcon={Wind}
            RightIcon={Zap}
          />
        </div>

        {/* Mop intensity */}
        <div>
          <SectionLabel>Wischintensität</SectionLabel>
          <DiscreteSlider
            options={MOP_OPTIONS}
            value={mopIntensity}
            onChange={setMopIntensity}
            disabled={isOffline}
            LeftIcon={Droplet}
            RightIcon={Droplets}
          />
        </div>

      </div>

      {/* Action buttons */}
      <div className="flex-none px-8 pb-8 pt-4 space-y-2.5">
        <button
          onClick={handleClean}
          disabled={!canStart}
          className="w-full py-3 rounded-xl bg-emerald-700 text-white text-sm font-semibold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-600 transition-colors"
        >
          {selectedRoomIds.length > 1
            ? `Starten (${selectedRoomIds.length} Räume)`
            : 'Starten'}
        </button>
        <div className="flex gap-2.5">
          <button
            onClick={() => dock.mutate()}
            disabled={isOffline || isActing}
            className="flex-1 py-2.5 rounded-xl bg-slate-700/60 text-slate-300 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 hover:text-white transition-colors"
          >
            Zur Basis
          </button>
          {isActive && (
            <button
              onClick={() => stop.mutate()}
              disabled={isActing}
              className="flex-1 py-2.5 rounded-xl bg-red-900/70 text-red-200 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-800 transition-colors"
            >
              Stopp
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default VacuumControlPanel;
