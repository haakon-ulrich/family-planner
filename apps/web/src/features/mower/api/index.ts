export type MowerStatusValue =
  | 'mowing'
  | 'charging'
  | 'docked'
  | 'paused'
  | 'returning'
  | 'error'
  | 'unknown';

export type MowerStatus = {
  connected: boolean;
  battery_percent: number | null;
  status: MowerStatusValue | null;
  progress_percent: number | null;
  error_code: number | null;
  error_message: string | null;
  updated_at: string | null;
};

const json = async <T>(res: Response): Promise<T> => {
  const body = await res.json();
  if (!res.ok) throw new Error((body as { error?: { message?: string } })?.error?.message ?? 'Request failed');
  return (body as { data: T }).data;
};

export const fetchMowerStatus = (): Promise<MowerStatus> =>
  fetch('/api/mower/status').then((r) => json<MowerStatus>(r));
