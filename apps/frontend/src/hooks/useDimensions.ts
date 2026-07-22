import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateDimensionDto,
  CreateDimensionMemberDto,
  Dimension,
  DimensionMember,
  UpdateDimensionDto,
  UpdateDimensionMemberDto,
} from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';
import { usePeriodStore } from '../store/period-store';

type DimensionWithMembers = Dimension & { members: DimensionMember[] };

const KEY = (periodId: string | null) => ['dimensions', periodId];

export function useDimensions() {
  const tenantId = useTenantStore((state) => state.tenantId);
  const periodId = usePeriodStore((state) => state.periodId);

  return useQuery({
    queryKey: KEY(periodId),
    queryFn: async () => (await apiClient.get<DimensionWithMembers[]>('/dimensions')).data,
    enabled: !!tenantId && !!periodId,
  });
}

export function useCreateDimension() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async (dto: CreateDimensionDto) => (await apiClient.post<Dimension>('/dimensions', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

export function useUpdateDimension() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateDimensionDto }) =>
      (await apiClient.put<Dimension>(`/dimensions/${id}`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

export function useDeleteDimension() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/dimensions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

export function useCreateDimensionMember() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ dimensionId, dto }: { dimensionId: string; dto: CreateDimensionMemberDto }) =>
      (await apiClient.post<DimensionMember>(`/dimensions/${dimensionId}/members`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

export function useUpdateDimensionMember() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({
      dimensionId,
      memberId,
      dto,
    }: {
      dimensionId: string;
      memberId: string;
      dto: UpdateDimensionMemberDto;
    }) => (await apiClient.put<DimensionMember>(`/dimensions/${dimensionId}/members/${memberId}`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

export function useDeleteDimensionMember() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ dimensionId, memberId }: { dimensionId: string; memberId: string }) =>
      apiClient.delete(`/dimensions/${dimensionId}/members/${memberId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

/** Invalidates the dimensions list — use after a bulk member import, which may touch dimensions other than the one currently selected. */
export function useInvalidateDimensions() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);
  return () => queryClient.invalidateQueries({ queryKey: KEY(periodId) });
}
