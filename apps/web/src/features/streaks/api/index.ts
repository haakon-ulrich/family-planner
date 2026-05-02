const json = async <T>(res: Response): Promise<T> => {
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? 'Request failed');
  return body.data as T;
};

export interface MemberStreakData {
  memberId: string;
  currentStreak: number;
}

export interface HouseholdStreakData {
  currentStreak: number;
}

export const fetchMemberStreak = (memberId: string): Promise<MemberStreakData> =>
  fetch(`/api/streaks?memberId=${memberId}`).then((r) => json(r));

export const fetchHouseholdStreak = (): Promise<HouseholdStreakData> =>
  fetch('/api/streaks').then((r) => json(r));
