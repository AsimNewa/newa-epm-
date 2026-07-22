import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCustomFieldDefinitionDto,
  CustomFieldDefinition,
  CustomFieldEntityType,
  UpdateCustomFieldDefinitionDto,
} from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';

const KEY = (entityType?: CustomFieldEntityType) => ['custom-field-definitions', entityType ?? 'all'];

export function useCustomFieldDefinitions(entityType?: CustomFieldEntityType) {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: KEY(entityType),
    queryFn: async () => {
      const params = entityType ? `?entityType=${entityType}` : '';
      return (await apiClient.get<CustomFieldDefinition[]>(`/custom-field-definitions${params}`)).data;
    },
    enabled: !!tenantId,
  });
}

export function useCreateCustomFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateCustomFieldDefinitionDto) =>
      (await apiClient.post<CustomFieldDefinition>('/custom-field-definitions', dto)).data,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: KEY(variables.entityType) });
      queryClient.invalidateQueries({ queryKey: KEY() });
    },
  });
}

export function useUpdateCustomFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateCustomFieldDefinitionDto }) =>
      (await apiClient.put<CustomFieldDefinition>(`/custom-field-definitions/${id}`, dto)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] });
    },
  });
}

export function useDeleteCustomFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/custom-field-definitions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] });
    },
  });
}
