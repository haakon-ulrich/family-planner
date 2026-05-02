import { useState } from 'react';
import { ListTodo, Plus } from 'lucide-react';
import type { Task, CreateTask } from '@shared/index';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@web/features/tasks';
import { useMembers } from '@web/features/members';
import TaskCard from './components/TaskCard';
import TaskModal from './components/TaskModal';

const Tasks = () => {
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const { data: members = [] } = useMembers();
  const { data: tasks = [], isLoading } = useTasks();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const memberMap = new Map(members.map((m) => [m.id, m]));

  const filtered = filterMemberId === null
    ? tasks
    : filterMemberId === ''
      ? tasks.filter((t) => !t.memberId)
      : tasks.filter((t) => t.memberId === filterMemberId);

  const openCreate = () => {
    setEditingTask(undefined);
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditingTask(undefined);
  };

  const handleSave = (payload: CreateTask) => {
    if (editingTask) {
      updateTask.mutate(
        { id: editingTask.id, data: payload },
        { onSuccess: handleClose },
      );
    } else {
      createTask.mutate(payload, { onSuccess: handleClose });
    }
  };

  const isSaving = createTask.isPending || updateTask.isPending;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Aufgaben</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Aufgaben erstellen, bearbeiten und Wiederholungen festlegen.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Aufgabe hinzufügen
        </button>
      </div>

      {/* Member filter tabs */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        <button
          onClick={() => setFilterMemberId(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterMemberId === null
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Alle
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => setFilterMemberId(m.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterMemberId === m.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: m.color }}
            />
            {m.name}
          </button>
        ))}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-800 rounded-lg border border-slate-700 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <ListTodo className="w-10 h-10 mb-3" />
          <p className="text-sm">Keine Aufgaben gefunden.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const member = task.memberId ? memberMap.get(task.memberId) : undefined;
            return (
              <TaskCard
                key={task.id}
                task={task}
                memberName={member?.name}
                memberColor={member?.color}
                onEdit={() => openEdit(task)}
                onDelete={() => deleteTask.mutate(task.id)}
                isDeleting={deleteTask.isPending && deleteTask.variables === task.id}
              />
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <TaskModal
          task={editingTask}
          onClose={handleClose}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </div>
  );
};

export default Tasks;
