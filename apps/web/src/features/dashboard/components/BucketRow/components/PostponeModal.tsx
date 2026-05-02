import { createPortal } from 'react-dom';
import { CalendarClock } from 'lucide-react';

interface PostponeModalProps {
  taskTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const PostponeModal = ({ taskTitle, onConfirm, onCancel }: PostponeModalProps) => createPortal(
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
    <div className="relative bg-slate-800 rounded-2xl border border-slate-700 shadow-xl p-6 max-w-xs w-full flex flex-col items-center gap-4">
      <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center">
        <CalendarClock className="w-7 h-7 text-indigo-400" />
      </div>
      <div className="text-center">
        <p className="text-white font-semibold text-base">Auf morgen verschieben?</p>
        <p className="text-slate-400 text-sm mt-1 leading-snug">„{taskTitle}"</p>
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
        >
          Abbrechen
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
        >
          Verschieben
        </button>
      </div>
    </div>
  </div>,
  document.body,
);

export default PostponeModal;
