import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TenantSettings, UpdateTenantSettingsDto } from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';

const KEY = ['settings'];

export function useSettings() {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get<TenantSettings>('/settings')).data,
    enabled: !!tenantId,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: UpdateTenantSettingsDto) => (await apiClient.put<TenantSettings>('/settings', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
