import { useQuery } from '@tanstack/react-query';
import { fetchVacuumStatus } from '../api';

export const VACUUM_STATUS_KEY = ['vacuum', 'status'] as const;

export const useVacuumStatus = () =>
  useQuery({
    queryKey: VACUUM_STATUS_KEY,
    queryFn: fetchVacuumStatus,
    refetchInterval: 15_000,
  });
