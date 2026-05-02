type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type RecurrenceKind = 'none' | 'weekdays' | 'every_n_days' | 'monthly';
type MonthlyType = 'day_of_month' | 'nth_weekday';

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 'mon', label: 'Mo' },
  { value: 'tue', label: 'Di' },
  { value: 'wed', label: 'Mi' },
  { value: 'thu', label: 'Do' },
  { value: 'fri', label: 'Fr' },
  { value: 'sat', label: 'Sa' },
  { value: 'sun', label: 'So' },
];

const WEEKDAY_FULL: Record<Weekday, string> = {
  mon: 'Montag', tue: 'Dienstag', wed: 'Mittwoch', thu: 'Donnerstag',
  fri: 'Freitag', sat: 'Samstag', sun: 'Sonntag',
};

const KIND_LABELS: Record<RecurrenceKind, string> = {
  none: 'Einmalig',
  weekdays: 'Wochentage',
  every_n_days: 'Alle N Tage',
  monthly: 'Monatlich',
};

export interface RecurrenceFields {
  recurrenceKind: RecurrenceKind;
  weekdays: Weekday[];
  everyNDays: number;
  monthlyType: MonthlyType;
  monthlyDay: number;
  monthlyNth: number;
  monthlyWeekday: Weekday;
}

interface RecurrencePickerProps {
  fields: RecurrenceFields;
  onChange: (updates: Partial<RecurrenceFields>) => void;
}

const inputCls = 'bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors';

const RecurrencePicker = ({ fields, onChange }: RecurrencePickerProps) => {
  const toggleWeekday = (day: Weekday) => {
    const next = fields.weekdays.includes(day)
      ? fields.weekdays.filter((d) => d !== day)
      : [...fields.weekdays, day];
    if (next.length > 0) onChange({ weekdays: next });
  };

  return (
    <div className="space-y-3">
      {/* Kind selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {(Object.keys(KIND_LABELS) as RecurrenceKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onChange({ recurrenceKind: kind })}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              fields.recurrenceKind === kind
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {KIND_LABELS[kind]}
          </button>
        ))}
      </div>

      {/* Weekdays config */}
      {fields.recurrenceKind === 'weekdays' && (
        <div className="flex gap-1.5 flex-wrap">
          {WEEKDAYS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleWeekday(value)}
              className={`w-9 h-9 rounded-lg text-xs font-semibold transition-colors ${
                fields.weekdays.includes(value)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Every N days config */}
      {fields.recurrenceKind === 'every_n_days' && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Alle</span>
          <input
            type="number"
            min={1}
            max={365}
            value={fields.everyNDays}
            onChange={(e) => onChange({ everyNDays: Math.max(1, Number(e.target.value)) })}
            className={`${inputCls} w-20`}
          />
          <span className="text-sm text-slate-400">Tage</span>
        </div>
      )}

      {/* Monthly config */}
      {fields.recurrenceKind === 'monthly' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {(['day_of_month', 'nth_weekday'] as MonthlyType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ monthlyType: t })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  fields.monthlyType === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {t === 'day_of_month' ? 'Tag des Monats' : 'Wochentag'}
              </button>
            ))}
          </div>

          {fields.monthlyType === 'day_of_month' && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Am</span>
              <input
                type="number"
                min={1}
                max={31}
                value={fields.monthlyDay}
                onChange={(e) => onChange({ monthlyDay: Math.min(31, Math.max(1, Number(e.target.value))) })}
                className={`${inputCls} w-20`}
              />
              <span className="text-sm text-slate-400">. des Monats</span>
            </div>
          )}

          {fields.monthlyType === 'nth_weekday' && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-slate-400">Am</span>
              <input
                type="number"
                min={1}
                max={5}
                value={fields.monthlyNth}
                onChange={(e) => onChange({ monthlyNth: Math.min(5, Math.max(1, Number(e.target.value))) })}
                className={`${inputCls} w-16`}
              />
              <select
                value={fields.monthlyWeekday}
                onChange={(e) => onChange({ monthlyWeekday: e.target.value as Weekday })}
                className={inputCls}
              >
                {WEEKDAYS.map(({ value }) => (
                  <option key={value} value={value}>{WEEKDAY_FULL[value]}</option>
                ))}
              </select>
              <span className="text-sm text-slate-400">im Monat</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecurrencePicker;
