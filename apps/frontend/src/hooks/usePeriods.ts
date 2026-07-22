import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CopyMasterDataDto,
  CreateFiscalYearDto,
  CreatePeriodDto,
  FiscalYear,
  Period,
  UpdatePeriodDto,
} from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';

const FISCAL_YEARS_KEY = ['fiscal-years'];
const PERIODS_KEY = ['periods'];

export function useFiscalYears() {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: FISCAL_YEARS_KEY,
    queryFn: async () => (await apiClient.get<FiscalYear[]>('/fiscal-years')).data,
    enabled: !!tenantId,
  });
}

export function usePeriods() {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: PERIODS_KEY,
    queryFn: async () => (await apiClient.get<Period[]>('/periods')).data,
    enabled: !!tenantId,
  });
}

export function useCreateFiscalYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateFiscalYearDto) => (await apiClient.post<FiscalYear>('/fiscal-years', dto)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_YEARS_KEY });
      queryClient.invalidateQueries({ queryKey: PERIODS_KEY });
    },
  });
}

export function useCreatePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreatePeriodDto) => (await apiClient.post<Period>('/periods', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PERIODS_KEY }),
  });
}

export function useUpdatePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdatePeriodDto }) =>
      (await apiClient.put<Period>(`/periods/${id}`, dto)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERIODS_KEY });
      queryClient.invalidateQueries({ queryKey: FISCAL_YEARS_KEY });
    },
  });
}

export function useDeletePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/periods/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERIODS_KEY });
      queryClient.invalidateQueries({ queryKey: FISCAL_YEARS_KEY });
    },
  });
}

export function useCopyMasterData() {
  return useMutation({
    mutationFn: async ({ periodId, dto }: { periodId: string; dto: CopyMasterDataDto }) =>
      (await apiClient.post<Period>(`/periods/${periodId}/copy-master-data`, dto)).data,
  });
}
