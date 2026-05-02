import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTasks, fetchTask, createTask, updateTask, deleteTask } from '@web/features/tasks/api';
import type { FetchTasksParams } from '@web/features/tasks/api';
import type { CreateTask, UpdateTask } from '@shared/index';

export const TASKS_KEY = ['tasks'] as const;

const taskListKey = (params?: FetchTasksParams) =>
  params ? ([...TASKS_KEY, params] as const) : TASKS_KEY;

const taskKey = (id: string) => [...TASKS_KEY, id] as const;

export const useTasks = (params?: FetchTasksParams) =>
  useQuery({
    queryKey: taskListKey(params),
    queryFn: () => fetchTasks(params),
  });

export const useTask = (id: string) =>
  useQuery({
    queryKey: taskKey(id),
    queryFn: () => fetchTask(id),
  });

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTask) => createTask(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTask }) => updateTask(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
};
