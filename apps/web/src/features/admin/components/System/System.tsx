import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { useSettings, useUpdateSettings } from '@web/features/admin/hooks';

const TIMEZONES: string[] = Intl.supportedValuesOf('timeZone');

const System = () => {
  const { data: settings, isLoading, isError } = useSettings();
  const { mutate: save, isPending, isSuccess, isError: isSaveError } = useUpdateSettings();

  const [timezone, setTimezone] = useState('Europe/Vienna');
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('21:00');
  const [quietEnd, setQuietEnd] = useState('07:00');

  useEffect(() => {
    if (!settings) return;
    setTimezone(settings.timezone);
    setQuietEnabled(settings.quietHoursStart !== null);
    setQuietStart(settings.quietHoursStart ?? '21:00');
    setQuietEnd(settings.quietHoursEnd ?? '07:00');
  }, [settings]);

  const isDirty =
    settings !== undefined &&
    (timezone !== settings.timezone ||
      quietEnabled !== (settings.quietHoursStart !== null) ||
      (quietEnabled && quietStart !== settings.quietHoursStart) ||
      (quietEnabled && quietEnd !== settings.quietHoursEnd));

  const handleSave = () => {
    save({
      timezone,
      quietHoursStart: quietEnabled ? quietStart : null,
      quietHoursEnd: quietEnabled ? quietEnd : null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Lädt…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-red-400 text-sm">
        Einstellungen konnten nicht geladen werden.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">System</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Zeitzone, Ruhezeiten und allgemeine Einstellungen.
        </p>
      </div>

      <div className="space-y-6 max-w-lg">
        {/* Timezone */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h2 className="text-sm font-medium text-slate-300 mb-3">Zeitzone</h2>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        {/* Quiet hours */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-medium text-slate-300">Ruhezeiten</h2>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-slate-400">
                {quietEnabled ? 'Aktiviert' : 'Deaktiviert'}
              </span>
              <input
                type="checkbox"
                checked={quietEnabled}
                onChange={(e) => setQuietEnabled(e.target.checked)}
                className="w-4 h-4 accent-indigo-500"
              />
            </label>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            In diesem Zeitraum werden keine Töne abgespielt.
          </p>
          <div
            className={`flex items-center gap-3 transition-opacity ${!quietEnabled ? 'opacity-40 pointer-events-none' : ''}`}
          >
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Von</label>
              <input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Bis</label>
              <input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!isDirty || isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Speichern
          </button>
          {isSuccess && !isDirty && (
            <span className="text-sm text-emerald-400">Gespeichert.</span>
          )}
          {isSaveError && (
            <span className="text-sm text-red-400">Fehler beim Speichern.</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default System;
