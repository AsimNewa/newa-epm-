import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRateTypeDto, RateType, UpdateRateTypeDto } from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';

const KEY = ['rate-types'];

export function useRateTypes() {
  const tenantId = useTenantStore((state) => state.tenantId);
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get<RateType[]>('/rate-types')).data,
    enabled: !!tenantId,
  });
}

export function useCreateRateType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateRateTypeDto) =>
      (await apiClient.post<RateType>('/rate-types', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateRateType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateRateTypeDto }) =>
      (await apiClient.put<RateType>(`/rate-types/${id}`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteRateType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/rate-types/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
