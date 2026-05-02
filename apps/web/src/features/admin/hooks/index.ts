import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, updateSettings } from '@web/features/admin/api';
import type { UpdateSettings } from '@shared/index';

export const SETTINGS_KEY = ['settings'] as const;

export const useSettings = () =>
  useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchSettings });

export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSettings) => updateSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
};
