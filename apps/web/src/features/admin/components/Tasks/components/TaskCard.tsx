import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Task, RecurrenceConfig } from '@shared/index';

const BUCKET_LABELS: Record<string, string> = {
  morning: 'Morgen',
  afternoon: 'Nachmittag',
  evening: 'Abend',
};

const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Mo', tue: 'Di', wed: 'Mi', thu: 'Do', fri: 'Fr', sat: 'Sa', sun: 'So',
};

const formatRecurrence = (cfg: RecurrenceConfig): string => {
  switch (cfg.kind) {
    case 'none': return 'Einmalig';
    case 'weekdays': return cfg.days.map((d) => WEEKDAY_LABELS[d]).join(', ');
    case 'every_n_days': return `Alle ${cfg.n} Tage`;
    case 'monthly':
      if (cfg.variant.type === 'day_of_month') return `${cfg.variant.day}. jeden Monats`;
      return `${cfg.variant.n}. ${WEEKDAY_LABELS[cfg.variant.weekday]} im Monat`;
  }
};

interface TaskCardProps {
  task: Task;
  memberName: string | undefined;
  memberColor: string | undefined;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

const TaskCard = ({ task, memberName, memberColor, onEdit, onDelete, isDeleting }: TaskCardProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = () => {
    if (confirmDelete) onDelete();
    else setConfirmDelete(true);
  };

  const icon = task.kind === 'single'
    ? (task.iconValue ?? '📋')
    : (task.steps?.[0]?.iconValue ?? '📋');

  return (
    <div className="flex items-center gap-3 px-3 py-3 bg-slate-800 rounded-lg border border-slate-700">
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-xl shrink-0">
        {icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-white text-sm truncate">{task.title}</span>
          {!task.active && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Inaktiv</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {memberName && memberColor ? (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: memberColor }} />
              {memberName}
            </span>
          ) : (
            <span className="text-xs text-slate-500">Haushalt</span>
          )}
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-xs text-slate-400">{BUCKET_LABELS[task.bucket]}</span>
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-xs text-slate-400">{formatRecurrence(task.recurrenceConfig)}</span>
        </div>
      </div>

      {/* Actions */}
      {confirmDelete ? (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-slate-300 hidden sm:inline">Wirklich löschen?</span>
          <button
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50"
            onClick={handleDeleteClick}
            disabled={isDeleting}
          >
            Löschen
          </button>
          <button
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-700 hover:bg-slate-600 transition-colors"
            onClick={() => setConfirmDelete(false)}
          >
            Abbrechen
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            onClick={onEdit}
            aria-label="Bearbeiten"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
            onClick={handleDeleteClick}
            aria-label="Löschen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskCard;
