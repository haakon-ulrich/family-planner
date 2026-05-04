import { useVacuumRooms, useVacuumStatus, useClean, useDock, useStop } from '@web/features/vacuum/hooks';
import { useVacuumStore } from '@web/features/vacuum/store';

const VacuumControls = () => {
  const { data: status } = useVacuumStatus();
  const { data: rooms } = useVacuumRooms();
  const { selectedRoomId, setSelectedRoomId } = useVacuumStore();
  const clean = useClean();
  const dock = useDock();
  const stop = useStop();

  const state = status?.state;
  const isOffline = !state || state === 'offline' || state === 'error' || state === 'auth_required';
  const isActive = state === 'cleaning' || state === 'returning';
  const isActing = clean.isPending || dock.isPending || stop.isPending;
  const canStart = !isOffline && !isActive && !isActing && selectedRoomId !== null;

  const handleClean = () => {
    if (selectedRoomId === null) return;
    clean.mutate({ room_ids: [selectedRoomId], repeats: 1, fan_speed: 'balanced', mop_intensity: 'medium' });
  };

  return (
    <div className="px-5 pb-4 space-y-2">
      <select
        value={selectedRoomId ?? ''}
        onChange={(e) => setSelectedRoomId(e.target.value ? Number(e.target.value) : null)}
        disabled={isOffline}
        className="w-full bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 px-2.5 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <option value="">Raum auswählen …</option>
        {rooms?.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          onClick={handleClean}
          disabled={!canStart}
          className="flex-1 text-sm rounded px-3 py-1.5 bg-emerald-700 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-600 transition-colors"
        >
          Starten
        </button>
        <button
          onClick={() => dock.mutate()}
          disabled={isOffline || isActing}
          className="flex-1 text-sm rounded px-3 py-1.5 bg-slate-700 text-slate-200 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
        >
          Zur Basis
        </button>
        {isActive && (
          <button
            onClick={() => stop.mutate()}
            disabled={isActing}
            className="flex-1 text-sm rounded px-3 py-1.5 bg-red-800 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
          >
            Stopp
          </button>
        )}
      </div>
    </div>
  );
};

export default VacuumControls;
