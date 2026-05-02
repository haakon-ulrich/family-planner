import type { TaskInstance, TaskStepInstance, UpsertTaskInstance, UpsertTaskStepInstance, PostponeTaskInstance } from '@shared/index';

const json = async <T>(res: Response): Promise<T> => {
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? 'Request failed');
  return body.data as T;
};

export const fetchInstances = (date: string): Promise<TaskInstance[]> =>
  fetch(`/api/instances?date=${date}`).then((r) => json(r));

export const fetchStepInstances = (date: string): Promise<TaskStepInstance[]> =>
  fetch(`/api/step-instances?date=${date}`).then((r) => json(r));

export const upsertInstance = (data: UpsertTaskInstance): Promise<TaskInstance> =>
  fetch('/api/instances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => json(r));

export const upsertStepInstance = (data: UpsertTaskStepInstance): Promise<TaskStepInstance> =>
  fetch('/api/step-instances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => json(r));

export const postponeInstance = (data: PostponeTaskInstance): Promise<{ taskId: string; date: string; tomorrowDate: string }> =>
  fetch('/api/instances/postpone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => json(r));
