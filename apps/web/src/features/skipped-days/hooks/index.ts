import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateSkippedDayRange } from '@shared/index';
import { fetchSkippedDayRanges, createSkippedDayRange, deleteSkippedDayRange } from '../api';

export const SKIPPED_DAYS_KEY = ['skippedDays'] as const;

export const useSkippedDayRanges = () =>
  useQuery({ queryKey: SKIPPED_DAYS_KEY, queryFn: fetchSkippedDayRanges });

export const useCreateSkippedDayRange = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSkippedDayRange) => createSkippedDayRange(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: SKIPPED_DAYS_KEY }),
  });
};

export const useDeleteSkippedDayRange = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSkippedDayRange(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: SKIPPED_DAYS_KEY }),
  });
};
