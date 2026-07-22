import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCurrencyDto,
  CreateExchangeRateDto,
  Currency,
  ExchangeRate,
  UpdateCurrencyDto,
  UpdateExchangeRateDto,
} from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';

const CURRENCIES_KEY = ['currencies'];
const EXCHANGE_RATES_KEY = ['exchange-rates'];

export function useCurrencies() {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: CURRENCIES_KEY,
    queryFn: async () => (await apiClient.get<Currency[]>('/currencies')).data,
    enabled: !!tenantId,
  });
}

export function useCreateCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateCurrencyDto) => (await apiClient.post<Currency>('/currencies', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
  });
}

export function useUpdateCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateCurrencyDto }) =>
      (await apiClient.put<Currency>(`/currencies/${id}`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
  });
}

export function useDeleteCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/currencies/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
  });
}

export function useExchangeRates() {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: EXCHANGE_RATES_KEY,
    queryFn: async () => (await apiClient.get<ExchangeRate[]>('/exchange-rates')).data,
    enabled: !!tenantId,
  });
}

export function useCreateExchangeRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateExchangeRateDto) =>
      (await apiClient.post<ExchangeRate>('/exchange-rates', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXCHANGE_RATES_KEY }),
  });
}

export function useUpdateExchangeRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateExchangeRateDto }) =>
      (await apiClient.put<ExchangeRate>(`/exchange-rates/${id}`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXCHANGE_RATES_KEY }),
  });
}

export function useDeleteExchangeRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/exchange-rates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXCHANGE_RATES_KEY }),
  });
}
