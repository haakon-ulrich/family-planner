import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskInstance, TaskStepInstance, UpsertTaskInstance, UpsertTaskStepInstance, PostponeTaskInstance } from '@shared/index';
import { fetchInstances, fetchStepInstances, upsertInstance, upsertStepInstance, postponeInstance } from '../api';

export const INSTANCES_KEY = ['instances'] as const;
export const STEP_INSTANCES_KEY = ['step-instances'] as const;

export const useInstances = (date: string) =>
  useQuery({
    queryKey: [...INSTANCES_KEY, date],
    queryFn: () => fetchInstances(date),
  });

export const useStepInstances = (date: string) =>
  useQuery({
    queryKey: [...STEP_INSTANCES_KEY, date],
    queryFn: () => fetchStepInstances(date),
  });

export const useUpsertInstance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertTaskInstance) => upsertInstance(data),
    onMutate: async (variables) => {
      const key = [...INSTANCES_KEY, variables.date] as const;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TaskInstance[]>(key);
      qc.setQueryData<TaskInstance[]>(key, (old = []) => {
        const idx = old.findIndex((i) => i.taskId === variables.taskId);
        const completedAt = variables.status === 'completed' ? new Date().toISOString() : null;
        if (idx >= 0) {
          const next = [...old];
          next[idx] = { ...next[idx], status: variables.status, completedAt };
          return next;
        }
        return [...old, { id: '', taskId: variables.taskId, date: variables.date, status: variables.status, completedAt, createdAt: new Date().toISOString() }];
      });
      return { previous, key };
    },
    onError: (_err, _variables, context) => {
      if (context) qc.setQueryData(context.key, context.previous);
    },
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: [...INSTANCES_KEY, variables.date] });
      qc.invalidateQueries({ queryKey: ['streaks'] });
    },
  });
};

export const usePostponeInstance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PostponeTaskInstance) => postponeInstance(data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: [...INSTANCES_KEY, variables.date] });
      qc.invalidateQueries({ queryKey: ['streaks'] });
    },
  });
};

export const useUpsertStepInstance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertTaskStepInstance) => upsertStepInstance(data),
    onMutate: async (variables) => {
      const key = [...STEP_INSTANCES_KEY, variables.date] as const;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TaskStepInstance[]>(key);
      qc.setQueryData<TaskStepInstance[]>(key, (old = []) => {
        const idx = old.findIndex((i) => i.taskStepId === variables.taskStepId);
        const completedAt = variables.status === 'completed' ? new Date().toISOString() : null;
        if (idx >= 0) {
          const next = [...old];
          next[idx] = { ...next[idx], status: variables.status, completedAt };
          return next;
        }
        return [...old, { id: '', taskStepId: variables.taskStepId, date: variables.date, status: variables.status, completedAt, createdAt: new Date().toISOString() }];
      });
      return { previous, key };
    },
    onError: (_err, _variables, context) => {
      if (context) qc.setQueryData(context.key, context.previous);
    },
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: [...STEP_INSTANCES_KEY, variables.date] });
      qc.invalidateQueries({ queryKey: ['streaks'] });
    },
  });
};
