import { Plus, Trash2 } from 'lucide-react';
import EmojiPicker from '@web/ui/EmojiPicker';

export interface StepField {
  tempId: string;  // React key only — not sent to the server
  id?: string;     // DB id; present for existing steps, absent for newly added ones
  iconValue: string;
}

interface StepEditorProps {
  steps: StepField[];
  onChange: (steps: StepField[]) => void;
}

const randomId = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

const StepEditor = ({ steps, onChange }: StepEditorProps) => {
  const addStep = () =>
    onChange([...steps, { tempId: randomId(), iconValue: '' }]);

  const updateStep = (tempId: string, iconValue: string) =>
    onChange(steps.map((s) => (s.tempId === tempId ? { ...s, iconValue } : s)));

  const removeStep = (tempId: string) =>
    onChange(steps.filter((s) => s.tempId !== tempId));

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={step.tempId} className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-5 text-right shrink-0">{i + 1}.</span>
          <EmojiPicker
            value={step.iconValue}
            onChange={(v) => updateStep(step.tempId, v)}
          />
          <button
            type="button"
            onClick={() => removeStep(step.tempId)}
            className="p-1.5 rounded text-slate-500 hover:text-red-400 transition-colors shrink-0"
            aria-label="Schritt entfernen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addStep}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 transition-colors w-full"
      >
        <Plus className="w-4 h-4" />
        Schritt hinzufügen
      </button>

      {steps.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-1">
          Mindestens ein Schritt erforderlich.
        </p>
      )}
    </div>
  );
};

export default StepEditor;
