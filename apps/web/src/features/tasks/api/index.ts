import type { Task, CreateTask, UpdateTask } from '@shared/index';

const base = '/api/tasks';

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  return json.data as T;
};

export interface FetchTasksParams {
  memberId?: string;
  active?: boolean;
}

const buildUrl = (params?: FetchTasksParams): string => {
  if (!params) return base;
  const qs = new URLSearchParams();
  if (params.memberId !== undefined) qs.set('memberId', params.memberId);
  if (params.active !== undefined) qs.set('active', String(params.active));
  const str = qs.toString();
  return str ? `${base}?${str}` : base;
};

export const fetchTasks = (params?: FetchTasksParams): Promise<Task[]> =>
  fetch(buildUrl(params)).then((r) => handleResponse<Task[]>(r));

export const fetchTask = (id: string): Promise<Task> =>
  fetch(`${base}/${id}`).then((r) => handleResponse<Task>(r));

export const createTask = (data: CreateTask): Promise<Task> =>
  fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => handleResponse<Task>(r));

export const updateTask = (id: string, data: UpdateTask): Promise<Task> =>
  fetch(`${base}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => handleResponse<Task>(r));

export const deleteTask = (id: string): Promise<void> =>
  fetch(`${base}/${id}`, { method: 'DELETE' }).then((r) => handleResponse<void>(r));
