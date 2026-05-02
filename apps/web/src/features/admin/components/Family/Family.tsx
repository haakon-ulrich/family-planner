import { useState } from 'react';
import { Users, Plus, Loader2 } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { FamilyMember } from '@shared/index';
import { useMembers, useCreateMember, useUpdateMember, useDeleteMember, useReorderMembers } from '@web/features/members';
import MemberCard from './components/MemberCard';
import MemberModal from './components/MemberModal';

interface MemberFormState {
  name: string;
  color: string;
}

const Family = () => {
  const { data: members, isLoading, isError } = useMembers();
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();
  const reorderMembers = useReorderMembers();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | undefined>(undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const openCreate = () => {
    setEditingMember(undefined);
    setModalOpen(true);
  };

  const openEdit = (member: FamilyMember) => {
    setEditingMember(member);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingMember(undefined);
  };

  const handleSave = (form: MemberFormState) => {
    if (editingMember) {
      updateMember.mutate(
        { id: editingMember.id, data: { name: form.name, color: form.color } },
        { onSuccess: closeModal },
      );
    } else {
      createMember.mutate(
        { name: form.name, color: form.color, sortOrder: members?.length ?? 0 },
        { onSuccess: closeModal },
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !members) return;

    const oldIndex = members.findIndex((m) => m.id === active.id);
    const newIndex = members.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(members, oldIndex, newIndex);
    reorderMembers.mutate(reordered.map((m) => m.id));
  };

  const isSaving = createMember.isPending || updateMember.isPending;

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white">Familie</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Familienmitglieder verwalten und Farbe festlegen.
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4" />
            Mitglied hinzufügen
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-red-400">Fehler beim Laden der Familienmitglieder.</p>
          </div>
        )}

        {!isLoading && !isError && members?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Users className="w-10 h-10 mb-3" />
            <p className="text-sm">Noch keine Familienmitglieder angelegt.</p>
          </div>
        )}

        {members && members.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={members.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 max-w-lg">
                {members.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    onEdit={() => openEdit(member)}
                    onDelete={() => deleteMember.mutate(member.id)}
                    isDeleting={deleteMember.isPending && deleteMember.variables === member.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {modalOpen && (
        <MemberModal
          member={editingMember}
          onClose={closeModal}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </>
  );
};

export default Family;
