import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRoleDto, Permission, Role, SetRolePermissionsDto, UpdateRoleDto } from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';

const ROLES_KEY = ['roles'];
const PERMISSIONS_KEY = ['permissions'];

export function useRoles() {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: async () => (await apiClient.get<Role[]>('/roles')).data,
    enabled: !!tenantId,
  });
}

export function usePermissions() {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: PERMISSIONS_KEY,
    queryFn: async () => (await apiClient.get<Permission[]>('/permissions')).data,
    enabled: !!tenantId,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateRoleDto) => (await apiClient.post<Role>('/roles', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateRoleDto }) =>
      (await apiClient.put<Role>(`/roles/${id}`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
  });
}

export function useSetRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: SetRolePermissionsDto }) =>
      (await apiClient.put<Role>(`/roles/${id}/permissions`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
  });
}
