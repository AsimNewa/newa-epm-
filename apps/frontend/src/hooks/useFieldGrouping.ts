import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';

export interface FieldGroupingConfig {
  id: string;
  tenantId: string;
  entityType: string;
  fieldKey: string;
  isGrouping: boolean;
  displayOrder: number;
}

export interface UpsertFieldGroupingDto {
  entityType: string;
  fieldKey: string;
  isGrouping: boolean;
  displayOrder?: number;
}

const KEY = (entityType: string) => ['field-grouping-configs', entityType];

export function useFieldGroupingConfigs(entityType: string) {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: KEY(entityType),
    queryFn: async () =>
      (await apiClient.get<FieldGroupingConfig[]>(`/field-grouping-configs?entityType=${entityType}`)).data,
    enabled: !!tenantId,
  });
}

export function useUpsertFieldGrouping(entityType: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: UpsertFieldGroupingDto) =>
      (await apiClient.put<FieldGroupingConfig>('/field-grouping-configs', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(entityType) }),
  });
}
