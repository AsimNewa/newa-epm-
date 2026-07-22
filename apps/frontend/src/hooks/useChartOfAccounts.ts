import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChartOfAccount, CreateChartOfAccountDto, UpdateChartOfAccountDto } from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';
import { usePeriodStore } from '../store/period-store';

const KEY = (periodId: string | null) => ['chart-of-accounts', periodId];

export function useChartOfAccounts() {
  const tenantId = useTenantStore((state) => state.tenantId);
  const periodId = usePeriodStore((state) => state.periodId);

  return useQuery({
    queryKey: KEY(periodId),
    queryFn: async () => (await apiClient.get<ChartOfAccount[]>('/chart-of-accounts')).data,
    enabled: !!tenantId && !!periodId,
  });
}

export function useCreateChartOfAccount() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async (dto: CreateChartOfAccountDto) =>
      (await apiClient.post<ChartOfAccount>('/chart-of-accounts', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

export function useUpdateChartOfAccount() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateChartOfAccountDto }) =>
      (await apiClient.put<ChartOfAccount>(`/chart-of-accounts/${id}`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}

export function useDeleteChartOfAccount() {
  const queryClient = useQueryClient();
  const periodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/chart-of-accounts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(periodId) }),
  });
}
