import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchMemberStreak, fetchHouseholdStreak } from '../api';

export const streakKey = (memberId: string) => ['streaks', memberId] as const;
export const HOUSEHOLD_STREAK_KEY = ['streaks', 'household'] as const;

export const useMemberStreaks = (memberIds: string[]): Map<string, number> => {
  const results = useQueries({
    queries: memberIds.map((id) => ({
      queryKey: streakKey(id),
      queryFn: () => fetchMemberStreak(id),
      staleTime: 30_000,
    })),
  });

  const map = new Map<string, number>();
  memberIds.forEach((id, i) => {
    map.set(id, results[i]?.data?.currentStreak ?? 0);
  });
  return map;
};

export const useHouseholdStreak = () =>
  useQuery({
    queryKey: HOUSEHOLD_STREAK_KEY,
    queryFn: fetchHouseholdStreak,
    staleTime: 30_000,
  });
