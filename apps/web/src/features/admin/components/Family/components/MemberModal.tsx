import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { FamilyMember } from '@shared/index';

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6',
  '#ec4899', '#6b7280',
];

interface MemberFormState {
  name: string;
  color: string;
}

const defaultForm = (): MemberFormState => ({
  name: '',
  color: COLOR_PRESETS[0],
});

interface MemberModalProps {
  member?: FamilyMember;
  onClose: () => void;
  onSave: (form: MemberFormState) => void;
  isSaving: boolean;
}

const MemberModal = ({ member, onClose, onSave, isSaving }: MemberModalProps) => {
  const [form, setForm] = useState<MemberFormState>(defaultForm);

  useEffect(() => {
    setForm(member ? { name: member.name, color: member.color } : defaultForm());
  }, [member]);

  const isValid = form.name.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-md bg-slate-800 rounded-xl border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-white">
            {member ? 'Mitglied bearbeiten' : 'Mitglied hinzufügen'}
          </h2>
          <button
            className="p-1 rounded text-slate-400 hover:text-white transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Name with live monogram preview */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                style={{ backgroundColor: `${form.color}33`, border: `2px solid ${form.color}`, color: form.color }}
              >
                {form.name.charAt(0).toUpperCase() || '?'}
              </div>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="z. B. Mia"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                autoFocus
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Farbe</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    backgroundColor: color,
                    boxShadow: form.color === color ? `0 0 0 2px #1e293b, 0 0 0 4px ${color}` : undefined,
                  }}
                  onClick={() => setForm((f) => ({ ...f, color }))}
                  aria-label={color}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              onClick={onClose}
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

export default MemberModal;
