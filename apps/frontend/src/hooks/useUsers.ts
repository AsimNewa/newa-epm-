import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssignUserRoleDto, CreateUserDto, UpdateUserDto, User } from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';

const KEY = ['users'];

export function useUsers() {
  const tenantId = useTenantStore((state) => state.tenantId);

  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get<User[]>('/users')).data,
    enabled: !!tenantId,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateUserDto) => (await apiClient.post<User>('/users', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      (await apiClient.put<User>(`/users/${id}`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAssignUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, dto }: { userId: string; dto: AssignUserRoleDto }) =>
      (await apiClient.post(`/users/${userId}/roles`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) =>
      apiClient.delete(`/users/${userId}/roles/${roleId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
