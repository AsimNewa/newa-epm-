import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConsolidationGroup,
  CreateConsolidationGroupDto,
  CreateGroupMemberDto,
  CreateOwnershipPeriodDto,
  CreateOwnershipStructureEntryDto,
  GroupMember,
  OwnershipPeriod,
  OwnershipStructureEntry,
  UpdateConsolidationGroupDto,
  UpdateOwnershipStructureEntryDto,
} from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';
import { useTenantStore } from '../store/tenant-store';
import { usePeriodStore } from '../store/period-store';

type GroupWithDetails = ConsolidationGroup & { members: GroupMember[] };

const KEY = (calendarPeriodId: string | null) => ['consolidation-groups', calendarPeriodId];
const OWNERSHIP_PERIODS_KEY = (calendarPeriodId: string | null, groupId: string) => [
  'ownership-periods',
  calendarPeriodId,
  groupId,
];
const OWNERSHIP_STRUCTURE_KEY = (calendarPeriodId: string | null, groupId: string) => [
  'ownership-structure',
  calendarPeriodId,
  groupId,
];

export function useConsolidationGroups() {
  const tenantId = useTenantStore((state) => state.tenantId);
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useQuery({
    queryKey: KEY(calendarPeriodId),
    queryFn: async () => (await apiClient.get<GroupWithDetails[]>('/consolidation-groups')).data,
    enabled: !!tenantId && !!calendarPeriodId,
  });
}

export function useCreateConsolidationGroup() {
  const queryClient = useQueryClient();
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async (dto: CreateConsolidationGroupDto) =>
      (await apiClient.post<ConsolidationGroup>('/consolidation-groups', dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(calendarPeriodId) }),
  });
}

export function useUpdateConsolidationGroup() {
  const queryClient = useQueryClient();
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateConsolidationGroupDto }) =>
      (await apiClient.put<ConsolidationGroup>(`/consolidation-groups/${id}`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(calendarPeriodId) }),
  });
}

export function useDeleteConsolidationGroup() {
  const queryClient = useQueryClient();
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/consolidation-groups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(calendarPeriodId) }),
  });
}

export function useCreateGroupMember() {
  const queryClient = useQueryClient();
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ groupId, dto }: { groupId: string; dto: CreateGroupMemberDto }) =>
      (await apiClient.post<GroupMember>(`/consolidation-groups/${groupId}/members`, dto)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(calendarPeriodId) }),
  });
}

export function useDeleteGroupMember() {
  const queryClient = useQueryClient();
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ groupId, memberId }: { groupId: string; memberId: string }) =>
      apiClient.delete(`/consolidation-groups/${groupId}/members/${memberId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(calendarPeriodId) }),
  });
}

export function useOwnershipPeriods(groupId: string | null) {
  const tenantId = useTenantStore((state) => state.tenantId);
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useQuery({
    queryKey: OWNERSHIP_PERIODS_KEY(calendarPeriodId, groupId ?? ''),
    queryFn: async () =>
      (await apiClient.get<OwnershipPeriod[]>(`/consolidation-groups/${groupId}/ownership-periods`)).data,
    enabled: !!tenantId && !!calendarPeriodId && !!groupId,
  });
}

export function useCreateOwnershipPeriod() {
  const queryClient = useQueryClient();
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ groupId, dto }: { groupId: string; dto: CreateOwnershipPeriodDto }) =>
      (await apiClient.post<OwnershipPeriod>(`/consolidation-groups/${groupId}/ownership-periods`, dto)).data,
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: OWNERSHIP_PERIODS_KEY(calendarPeriodId, variables.groupId) }),
  });
}

export function useDeleteOwnershipPeriod() {
  const queryClient = useQueryClient();
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ groupId, periodId }: { groupId: string; periodId: string }) =>
      apiClient.delete(`/consolidation-groups/${groupId}/ownership-periods/${periodId}`),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: OWNERSHIP_PERIODS_KEY(calendarPeriodId, variables.groupId) }),
  });
}

export function useOwnershipStructure(groupId: string | null) {
  const tenantId = useTenantStore((state) => state.tenantId);
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useQuery({
    queryKey: OWNERSHIP_STRUCTURE_KEY(calendarPeriodId, groupId ?? ''),
    queryFn: async () =>
      (await apiClient.get<OwnershipStructureEntry[]>(`/consolidation-groups/${groupId}/ownership-structure`)).data,
    enabled: !!tenantId && !!calendarPeriodId && !!groupId,
  });
}

export function useCreateOwnershipStructureEntry() {
  const queryClient = useQueryClient();
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ groupId, dto }: { groupId: string; dto: CreateOwnershipStructureEntryDto }) =>
      (await apiClient.post<OwnershipStructureEntry>(`/consolidation-groups/${groupId}/ownership-structure`, dto))
        .data,
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: OWNERSHIP_STRUCTURE_KEY(calendarPeriodId, variables.groupId) }),
  });
}

export function useUpdateOwnershipStructureEntry() {
  const queryClient = useQueryClient();
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({
      groupId,
      id,
      dto,
    }: {
      groupId: string;
      id: string;
      dto: UpdateOwnershipStructureEntryDto;
    }) =>
      (
        await apiClient.put<OwnershipStructureEntry>(
          `/consolidation-groups/${groupId}/ownership-structure/${id}`,
          dto,
        )
      ).data,
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: OWNERSHIP_STRUCTURE_KEY(calendarPeriodId, variables.groupId) }),
  });
}

export function useDeleteOwnershipStructureEntry() {
  const queryClient = useQueryClient();
  const calendarPeriodId = usePeriodStore((state) => state.periodId);

  return useMutation({
    mutationFn: async ({ groupId, id }: { groupId: string; id: string }) =>
      apiClient.delete(`/consolidation-groups/${groupId}/ownership-structure/${id}`),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: OWNERSHIP_STRUCTURE_KEY(calendarPeriodId, variables.groupId) }),
  });
}
