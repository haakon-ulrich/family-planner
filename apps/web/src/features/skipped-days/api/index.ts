import type { SkippedDayRange, CreateSkippedDayRange } from '@shared/index';

const base = '/api/skipped-days';

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  return (json as { data: T }).data;
};

export const fetchSkippedDayRanges = (): Promise<SkippedDayRange[]> =>
  fetch(base).then((r) => handleResponse<SkippedDayRange[]>(r));

export const createSkippedDayRange = (data: CreateSkippedDayRange): Promise<SkippedDayRange> =>
  fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => handleResponse<SkippedDayRange>(r));

export const deleteSkippedDayRange = (id: string): Promise<SkippedDayRange> =>
  fetch(`${base}/${id}`, { method: 'DELETE' }).then((r) => handleResponse<SkippedDayRange>(r));
