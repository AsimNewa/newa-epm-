import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateEntityDto, Entity, UpdateEntityDto } from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';
import { usePeriodStore } from '../store/period-store';

const KEY = (periodId: string | null) => ['entities', periodId];

export function useEntities() {
  const tenantId = useTenantStore((state) => state.tenantId);
  const periodId = usePeriodStore((state) => state.periodId);

  return useQuery({
    queryKey: KEY(periodId),
    queryFn: async () => (await apiClient.get<Entity[]>('/entities')).data,
    enabled: !!tenantId && !!periodId,
  });
}

export function useCreateEntity() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async (dto: CreateEntityDto) => (await apiClient.post<Entity>('/entities', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

export function useUpdateEntity() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateEntityDto }) =>
      (await apiClient.put<Entity>(`/entities/${id}`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

export function useDeleteEntity() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/entities/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}
