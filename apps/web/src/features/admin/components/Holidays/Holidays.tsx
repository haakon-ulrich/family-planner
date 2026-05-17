import { useState } from 'react';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { useMembers } from '@web/features/members';
import { useSkippedDayRanges, useCreateSkippedDayRange, useDeleteSkippedDayRange } from '@web/features/skipped-days';
import type { SkippedDayRange } from '@shared/index';

const getTodayString = () => new Date().toLocaleDateString('sv');

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

const RangeRow = ({ range, memberName, onDelete, isDeleting }: {
  range: SkippedDayRange;
  memberName: string;
  onDelete: () => void;
  isDeleting: boolean;
}) => (
  <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-slate-800 border border-slate-700">
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-sm font-medium text-white">
        {formatDate(range.startDate)}
        {range.startDate !== range.endDate && ` – ${formatDate(range.endDate)}`}
      </span>
      <span className="text-xs text-slate-400">{memberName}</span>
    </div>
    <button
      onClick={onDelete}
      disabled={isDeleting}
      className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-40 transition-colors"
    >
      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  </div>
);

const Holidays = () => {
  const { data: members = [] } = useMembers();
  const { data: ranges = [], isLoading } = useSkippedDayRanges();
  const { mutate: create, isPending: isCreating } = useCreateSkippedDayRange();
  const { mutate: remove, variables: deletingId, isPending: isDeleting } = useDeleteSkippedDayRange();

  const today = getTodayString();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [memberId, setMemberId] = useState<string>('household');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => {
    if (startDate > endDate) {
      setError('Das Startdatum muss vor dem Enddatum liegen.');
      return;
    }
    setError(null);
    create(
      { memberId: memberId === 'household' ? null : memberId, startDate, endDate },
      { onSuccess: () => { setStartDate(today); setEndDate(today); setMemberId('household'); } },
    );
  };

  const getMemberName = (range: SkippedDayRange): string => {
    if (range.memberId === null) return 'Alle';
    return members.find((m) => m.id === range.memberId)?.name ?? '—';
  };

  const sorted = [...ranges].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Urlaub / freie Tage</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          An freien Tagen werden keine Aufgaben angezeigt und die Streak bleibt erhalten.
        </p>
      </div>

      <div className="space-y-6 max-w-lg">
        {/* Add new range */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-4">
          <h2 className="text-sm font-medium text-slate-300">Zeitraum hinzufügen</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Von</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setError(null); }}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Bis</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setError(null); }}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Für wen</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="household">Alle</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Hinzufügen
          </button>
        </div>

        {/* Existing ranges */}
        <div className="space-y-2">
          {isLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Lädt…
            </div>
          )}
          {!isLoading && sorted.length === 0 && (
            <p className="text-sm text-slate-500">Keine freien Tage konfiguriert.</p>
          )}
          {sorted.map((range) => (
            <RangeRow
              key={range.id}
              range={range}
              memberName={getMemberName(range)}
              onDelete={() => remove(range.id)}
              isDeleting={isDeleting && deletingId === range.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Holidays;
