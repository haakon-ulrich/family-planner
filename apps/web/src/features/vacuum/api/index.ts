export type VacuumState =
  | 'docked'
  | 'cleaning'
  | 'returning'
  | 'idle'
  | 'paused'
  | 'error'
  | 'offline'
  | 'auth_required'
  | 'washing_mop'
  | 'drying_mop'
  | 'emptying_bin';

export type VacuumStatus = {
  state: VacuumState;
  battery: number | null;
  fan_speed: string | null;
  mop_intensity: string | null;
  error_code: number | null;
  last_updated: string;
};

export type Room = {
  id: number;
  name: string;
};

export type FanSpeed = 'quiet' | 'balanced' | 'turbo' | 'max' | 'max_plus';
export type MopIntensity = 'off' | 'slight' | 'low' | 'medium' | 'moderate' | 'high' | 'extreme';

export type CleanRequest = {
  room_ids: number[];
  repeats: number;
  fan_speed: FanSpeed;
  mop_intensity: MopIntensity;
};

const json = async <T>(res: Response): Promise<T> => {
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? 'Request failed');
  return body.data as T;
};

export const fetchVacuumStatus = (): Promise<VacuumStatus> =>
  fetch('/api/vacuum/status').then((r) => json<VacuumStatus>(r));

export const fetchVacuumRooms = (): Promise<Room[]> =>
  fetch('/api/vacuum/rooms').then((r) => json<Room[]>(r));

export const postClean = (req: CleanRequest): Promise<{ ok: boolean }> =>
  fetch('/api/vacuum/clean', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  }).then((r) => json<{ ok: boolean }>(r));

export const postDock = (): Promise<{ ok: boolean }> =>
  fetch('/api/vacuum/dock', { method: 'POST' }).then((r) => json<{ ok: boolean }>(r));

export const postStop = (): Promise<{ ok: boolean }> =>
  fetch('/api/vacuum/stop', { method: 'POST' }).then((r) => json<{ ok: boolean }>(r));

export type RoomGeometry = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VacuumMap = {
  image: string | null;
  image_width: number | null;
  image_height: number | null;
  rooms: RoomGeometry[];
};

export const fetchVacuumMap = (): Promise<VacuumMap> =>
  fetch('/api/vacuum/map').then((r) => json<VacuumMap>(r));
