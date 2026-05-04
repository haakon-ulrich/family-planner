import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchVacuumRooms, fetchVacuumStatus, postClean, postDock, postStop } from '../api';
import type { CleanRequest } from '../api';

export const VACUUM_STATUS_KEY = ['vacuum', 'status'] as const;
export const VACUUM_ROOMS_KEY = ['vacuum', 'rooms'] as const;

export const useVacuumStatus = () =>
  useQuery({
    queryKey: VACUUM_STATUS_KEY,
    queryFn: fetchVacuumStatus,
    refetchInterval: 15_000,
  });

export const useVacuumRooms = () =>
  useQuery({
    queryKey: VACUUM_ROOMS_KEY,
    queryFn: fetchVacuumRooms,
    refetchInterval: 60_000,
  });

export const useClean = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CleanRequest) => postClean(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: VACUUM_STATUS_KEY }),
  });
};

export const useDock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postDock,
    onSuccess: () => qc.invalidateQueries({ queryKey: VACUUM_STATUS_KEY }),
  });
};

export const useStop = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postStop,
    onSuccess: () => qc.invalidateQueries({ queryKey: VACUUM_STATUS_KEY }),
  });
};
