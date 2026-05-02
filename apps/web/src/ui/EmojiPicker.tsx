import { useEffect, useRef, useState } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  placeholder?: string;
}

interface EmojiSelectEvent {
  native: string;
}

const EmojiPicker = ({ value, onChange, placeholder = '?' }: EmojiPickerProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (e: EmojiSelectEvent) => {
    onChange(e.native);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 flex items-center justify-center text-xl transition-colors shrink-0"
        aria-label="Emoji auswählen"
      >
        {value || placeholder}
      </button>

      {open && (
        <div className="absolute z-50 top-12 left-0">
          <Picker
            data={data}
            onEmojiSelect={handleSelect}
            locale="de"
            theme="dark"
            previewPosition="none"
            skinTonePosition="none"
            maxFrequentRows={2}
          />
        </div>
      )}
    </div>
  );
};

export default EmojiPicker;
