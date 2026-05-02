import { useState } from 'react';
import { Pencil, Trash2, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FamilyMember } from '@shared/index';

interface MemberCardProps {
  member: FamilyMember;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

const MemberCard = ({ member, onEdit, onDelete, isDeleting }: MemberCardProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: member.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-3 bg-slate-800 rounded-lg border border-slate-700"
    >
      {/* Drag handle */}
      <button
        className="p-1 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
        aria-label="Verschieben"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Color monogram */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0"
        style={{ backgroundColor: `${member.color}33`, border: `2px solid ${member.color}`, color: member.color }}
      >
        {member.name.charAt(0).toUpperCase()}
      </div>

      {/* Name + color */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{member.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: member.color }} />
          <span className="text-xs text-slate-400">{member.color}</span>
        </div>
      </div>

      {/* Actions */}
      {confirmDelete ? (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-slate-300">Wirklich löschen?</span>
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

export default MemberCard;
