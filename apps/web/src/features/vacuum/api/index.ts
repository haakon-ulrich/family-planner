export type VacuumState =
  | 'docked'
  | 'cleaning'
  | 'returning'
  | 'idle'
  | 'paused'
  | 'error'
  | 'offline'
  | 'auth_required';

export type VacuumStatus = {
  state: VacuumState;
  battery: number | null;
  fan_speed: string | null;
  mop_intensity: string | null;
  error_code: number | null;
  last_updated: string;
};

const json = async <T>(res: Response): Promise<T> => {
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? 'Request failed');
  return body.data as T;
};

export const fetchVacuumStatus = (): Promise<VacuumStatus> =>
  fetch('/api/vacuum/status').then((r) => json<VacuumStatus>(r));
