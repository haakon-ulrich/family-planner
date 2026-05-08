import { useQuery } from '@tanstack/react-query';
import { fetchMowerStatus } from '../api';

export const MOWER_STATUS_KEY = ['mower', 'status'] as const;

export const useMowerStatus = () =>
  useQuery({
    queryKey: MOWER_STATUS_KEY,
    queryFn: fetchMowerStatus,
    refetchInterval: 30_000,
  });
