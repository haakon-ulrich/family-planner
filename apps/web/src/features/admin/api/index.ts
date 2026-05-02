import type { Settings, UpdateSettings } from '@shared/index';

const base = '/api/settings';

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data as T;
};

export const fetchSettings = (): Promise<Settings> =>
  fetch(base).then((r) => handleResponse<Settings>(r));

export const updateSettings = (data: UpdateSettings): Promise<Settings> =>
  fetch(base, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => handleResponse<Settings>(r));
