import type { FamilyMember, CreateFamilyMember, UpdateFamilyMember } from '@shared/index';

const base = '/api/members';

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  return json.data as T;
};

export const fetchMembers = (): Promise<FamilyMember[]> =>
  fetch(base).then((r) => handleResponse<FamilyMember[]>(r));

export const createMember = (data: CreateFamilyMember): Promise<FamilyMember> =>
  fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => handleResponse<FamilyMember>(r));

export const updateMember = (id: string, data: UpdateFamilyMember): Promise<FamilyMember> =>
  fetch(`${base}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => handleResponse<FamilyMember>(r));

export const deleteMember = (id: string): Promise<void> =>
  fetch(`${base}/${id}`, { method: 'DELETE' }).then((r) => handleResponse<void>(r));

export const reorderMembers = (orderedIds: string[]): Promise<void> =>
  fetch(`${base}/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds }),
  }).then((r) => handleResponse<void>(r));
