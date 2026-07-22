import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateDimensionAccountRuleDto,
  DimensionAccountRule,
  DimensionAccountResolution,
  DimensionRuleContextEntry,
  ImportResult,
  UpdateDimensionAccountRuleDto,
} from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';
import { usePeriodStore } from '../store/period-store';

const KEY = (periodId: string | null) => ['dimension-account-rules', periodId];

export function useDimensionAccountRules(dimensionId: string | null) {
  const tenantId = useTenantStore((state) => state.tenantId);
  const periodId = usePeriodStore((state) => state.periodId);

  return useQuery({
    queryKey: [...KEY(periodId), dimensionId],
    queryFn: async () =>
      (
        await apiClient.get<DimensionAccountRule[]>('/dimension-account-rules', {
          params: dimensionId ? { dimensionId } : undefined,
        })
      ).data,
    enabled: !!tenantId && !!periodId && !!dimensionId,
  });
}

export function useCreateDimensionAccountRule() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async (dto: CreateDimensionAccountRuleDto) =>
      (await apiClient.post<DimensionAccountRule>('/dimension-account-rules', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

export function useUpdateDimensionAccountRule() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateDimensionAccountRuleDto }) =>
      (await apiClient.put<DimensionAccountRule>(`/dimension-account-rules/${id}`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

export function useDeleteDimensionAccountRule() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/dimension-account-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

export function useImportDimensionAccountRules() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ dimensionId, rows }: { dimensionId: string; rows: Record<string, unknown>[] }) =>
      (
        await apiClient.post<ImportResult>('/dimension-account-rules/import', { rows }, { params: { dimensionId } })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

/** Preview tool: resolve every dimension's applicability/default for one account code. */
export function useResolveAccountDimensions() {
  return useMutation({
    mutationFn: async (accountCode: string) =>
      (await apiClient.get<DimensionAccountResolution[]>(`/dimension-account-rules/resolve-account/${accountCode}`)).data,
  });
}

/** Preview tool: resolve every dimension given an arbitrary set of (source axis, code) facts. */
export function useResolveAllDimensions() {
  return useMutation({
    mutationFn: async (context: DimensionRuleContextEntry[]) =>
      (await apiClient.post<DimensionAccountResolution[]>('/dimension-account-rules/resolve-all', { context })).data,
  });
}
