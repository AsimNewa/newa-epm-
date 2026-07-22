import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ThemeSetting, UpdateThemeDto } from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';

const KEY = ['theme'];

export function useTheme() {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get<ThemeSetting>('/theme')).data,
    enabled: !!tenantId,
  });
}

export function useUpdateTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: UpdateThemeDto) => (await apiClient.put<ThemeSetting>('/theme', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
