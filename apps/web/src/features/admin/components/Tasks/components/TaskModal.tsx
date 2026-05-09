import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Task, CreateTask, Bucket } from '@shared/index';
import { useMembers } from '@web/features/members';
import EmojiPicker from '@web/ui/EmojiPicker';
import RecurrencePicker, { type RecurrenceFields } from './RecurrencePicker';
import StepEditor, { type StepField } from './StepEditor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

interface TaskFormState {
  memberId: string; // '' = household / unassigned
  title: string;
  bucket: Bucket;
  kind: 'single' | 'multi';
  iconValue: string;
  dueByTime: string; // '' = none
  startDate: string;
  endDate: string; // '' = none
  carryOverIfIncomplete: boolean;
  postponable: boolean;
  active: boolean;
  steps: StepField[];
  recurrenceKind: RecurrenceFields['recurrenceKind'];
  weekdays: Weekday[];
  everyNDays: number;
  monthlyType: RecurrenceFields['monthlyType'];
  monthlyDay: number;
  monthlyNth: number;
  monthlyWeekday: Weekday;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const todayString = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD in local time

const defaultForm = (): TaskFormState => ({
  memberId: '',
  title: '',
  bucket: 'morning',
  kind: 'single',
  iconValue: '',
  dueByTime: '',
  startDate: todayString(),
  endDate: '',
  carryOverIfIncomplete: false,
  postponable: false,
  active: true,
  steps: [],
  recurrenceKind: 'none',
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  everyNDays: 2,
  monthlyType: 'day_of_month',
  monthlyDay: 1,
  monthlyNth: 1,
  monthlyWeekday: 'mon',
});

const formFromTask = (task: Task): TaskFormState => {
  const cfg = task.recurrenceConfig;
  return {
    memberId: task.memberId ?? '',
    title: task.title,
    bucket: task.bucket,
    kind: task.kind,
    iconValue: task.iconValue ?? '',
    dueByTime: task.dueByTime ?? '',
    startDate: task.startDate,
    endDate: task.endDate ?? '',
    carryOverIfIncomplete: task.carryOverIfIncomplete,
    postponable: task.postponable,
    active: task.active,
    steps: task.steps?.map((s) => ({ tempId: s.id, id: s.id, iconValue: s.iconValue })) ?? [],
    recurrenceKind: task.recurrenceKind,
    weekdays:
      cfg.kind === 'weekdays' ? (cfg.days as Weekday[]) : ['mon', 'tue', 'wed', 'thu', 'fri'],
    everyNDays: cfg.kind === 'every_n_days' ? cfg.n : 2,
    monthlyType: cfg.kind === 'monthly' ? cfg.variant.type : 'day_of_month',
    monthlyDay: cfg.kind === 'monthly' && cfg.variant.type === 'day_of_month' ? cfg.variant.day : 1,
    monthlyNth: cfg.kind === 'monthly' && cfg.variant.type === 'nth_weekday' ? cfg.variant.n : 1,
    monthlyWeekday:
      cfg.kind === 'monthly' && cfg.variant.type === 'nth_weekday'
        ? (cfg.variant.weekday as Weekday)
        : 'mon',
  };
};

const buildPayload = (form: TaskFormState): CreateTask => {
  const recurrenceConfig = (() => {
    switch (form.recurrenceKind) {
      case 'none':
        return { kind: 'none' as const };
      case 'weekdays':
        return { kind: 'weekdays' as const, days: form.weekdays };
      case 'every_n_days':
        return { kind: 'every_n_days' as const, n: form.everyNDays };
      case 'monthly':
        return form.monthlyType === 'day_of_month'
          ? {
              kind: 'monthly' as const,
              variant: { type: 'day_of_month' as const, day: form.monthlyDay },
            }
          : {
              kind: 'monthly' as const,
              variant: {
                type: 'nth_weekday' as const,
                n: form.monthlyNth,
                weekday: form.monthlyWeekday,
              },
            };
    }
  })();

  return {
    memberId: form.memberId || null,
    title: form.title.trim(),
    kind: form.kind,
    iconValue: form.kind === 'single' && form.iconValue ? form.iconValue : null,
    bucket: form.bucket,
    dueByTime: form.dueByTime || null,
    recurrenceKind: form.recurrenceKind,
    recurrenceConfig,
    startDate: form.startDate,
    endDate: form.endDate || null,
    carryOverIfIncomplete: form.carryOverIfIncomplete,
    postponable: form.postponable,
    active: form.active,
    steps:
      form.kind === 'multi'
        ? form.steps.map((s, i) => ({ ...(s.id ? { id: s.id } : {}), iconValue: s.iconValue, sortOrder: i }))
        : undefined,
  };
};

// ---------------------------------------------------------------------------
// Sub-component pieces
// ---------------------------------------------------------------------------

const inputCls =
  'w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors';
const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5';
const sectionCls = 'space-y-1.5';

const BUCKET_OPTIONS: { value: Bucket; label: string }[] = [
  { value: 'morning', label: 'Morgen' },
  { value: 'afternoon', label: 'Nachmittag' },
  { value: 'evening', label: 'Abend' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaskModalProps {
  task?: Task;
  onClose: () => void;
  onSave: (payload: CreateTask) => void;
  isSaving: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TaskModal = ({ task, onClose, onSave, isSaving }: TaskModalProps) => {
  const [form, setForm] = useState<TaskFormState>(defaultForm);
  const { data: members = [] } = useMembers();

  useEffect(() => {
    setForm(task ? formFromTask(task) : defaultForm());
  }, [task]);

  useEffect(() => {
    setForm((form) => {
      if (!form.memberId && members.length > 0) {
        return { ...form, memberId: members[0].id };
      }
      return form;
    });
  }, [members]);

  const set = <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const recurrenceFields: RecurrenceFields = {
    recurrenceKind: form.recurrenceKind,
    weekdays: form.weekdays,
    everyNDays: form.everyNDays,
    monthlyType: form.monthlyType,
    monthlyDay: form.monthlyDay,
    monthlyNth: form.monthlyNth,
    monthlyWeekday: form.monthlyWeekday,
  };

  const isValid =
    form.title.trim().length > 0 &&
    form.startDate.length === 10 &&
    (form.kind === 'single' || form.steps.length > 0);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSave(buildPayload(form));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-slate-800 rounded-t-2xl sm:rounded-xl border-t sm:border border-slate-700 shadow-xl flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-white">
            {task ? 'Aufgabe bearbeiten' : 'Aufgabe hinzufügen'}
          </h2>
          <button
            className="p-1 rounded text-slate-400 hover:text-white transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-5">
            {/* Title */}
            <div className={sectionCls}>
              <label className={labelCls}>Titel</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="z. B. Zähne putzen"
                className={inputCls}
                autoFocus
              />
            </div>

            {/* Member + Bucket */}
            <div className="grid grid-cols-2 gap-4">
              <div className={sectionCls}>
                <label className={labelCls}>Mitglied</label>
                <select
                  value={form.memberId}
                  onChange={(e) => set('memberId', e.target.value)}
                  className={inputCls}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={sectionCls}>
                <label className={labelCls}>Tagesabschnitt</label>
                <div className="flex flex-col gap-1">
                  {BUCKET_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set('bucket', value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        form.bucket === value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Kind toggle */}
            <div className={sectionCls}>
              <label className={labelCls}>Art</label>
              <div className="flex gap-2">
                {(['single', 'multi'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set('kind', k)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.kind === k
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {k === 'single' ? 'Einzeln' : 'Mehrstufig'}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon (single) or Steps (multi) */}
            {form.kind === 'single' ? (
              <div className={sectionCls}>
                <label className={labelCls}>Icon</label>
                <EmojiPicker value={form.iconValue} onChange={(v) => set('iconValue', v)} />
              </div>
            ) : (
              <div className={sectionCls}>
                <label className={labelCls}>Schritte</label>
                <StepEditor steps={form.steps} onChange={(s) => set('steps', s)} />
              </div>
            )}

            {/* Recurrence */}
            <div className={sectionCls}>
              <label className={labelCls}>Wiederholung</label>
              <RecurrencePicker
                fields={recurrenceFields}
                onChange={(updates) => setForm((f) => ({ ...f, ...updates }))}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className={sectionCls}>
                <label className={labelCls}>Startdatum</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className={sectionCls}>
                <label className={labelCls}>
                  Enddatum <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Due by time */}
            <div className={sectionCls}>
              <label className={labelCls}>
                Fälligkeit <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={form.dueByTime}
                onChange={(e) => set('dueByTime', e.target.value)}
                className={`${inputCls} w-36`}
              />
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.carryOverIfIncomplete}
                  onChange={(e) => set('carryOverIfIncomplete', e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-500"
                />
                <span className="text-sm text-slate-300">
                  Unerledigte Aufgabe auf nächsten Tag übertragen
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.postponable}
                  onChange={(e) => set('postponable', e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-500"
                />
                <span className="text-sm text-slate-300">
                  Aufgabe kann auf den nächsten Tag verschoben werden
                </span>
              </label>

              {task && (
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => set('active', e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-500"
                  />
                  <span className="text-sm text-slate-300">Aktiv</span>
                </label>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-700 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!isValid || isSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Wird gespeichert …' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
