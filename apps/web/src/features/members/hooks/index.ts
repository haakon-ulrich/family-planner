import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMembers, createMember, updateMember, deleteMember, reorderMembers } from '@web/features/members/api';
import type { CreateFamilyMember, FamilyMember, UpdateFamilyMember } from '@shared/index';

export const MEMBERS_KEY = ['members'] as const;

export const useMembers = () =>
  useQuery({ queryKey: MEMBERS_KEY, queryFn: fetchMembers });

export const useCreateMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFamilyMember) => createMember(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
};

export const useUpdateMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFamilyMember }) => updateMember(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
};

export const useDeleteMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
};

export const useReorderMembers = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderMembers(orderedIds),
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: MEMBERS_KEY });
      const previous = qc.getQueryData<FamilyMember[]>(MEMBERS_KEY);
      qc.setQueryData<FamilyMember[]>(MEMBERS_KEY, (old = []) => {
        const byId = new Map(old.map((m) => [m.id, m]));
        return orderedIds.flatMap((id) => (byId.get(id) ? [{ ...byId.get(id)!, sortOrder: orderedIds.indexOf(id) }] : []));
      });
      return { previous };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.previous) qc.setQueryData(MEMBERS_KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
};
