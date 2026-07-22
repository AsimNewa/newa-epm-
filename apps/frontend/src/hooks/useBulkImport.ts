import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ImportResult } from '@newa-epm/shared';
import { apiClient } from '../lib/api-client';

// Ownership Structure import is scoped to a specific group, so its endpoint needs `groupId`
// interpolated — unlike every other domain's import, which posts to a static endpoint.
export function useImportOwnershipStructure(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: Record<string, unknown>[]) =>
      (await apiClient.post<ImportResult>(`/consolidation-groups/${groupId}/ownership-structure/import`, { rows }))
        .data,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

function makeImportHook(endpoint: string) {
  return function useBulkImport() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (rows: Record<string, unknown>[]) =>
        (await apiClient.post<ImportResult>(endpoint, { rows })).data,
      // A bulk import can create/update many rows across whatever list is currently on screen —
      // invalidate everything rather than tracking down each page's specific query key.
      onSuccess: () => queryClient.invalidateQueries(),
    });
  };
}

export const useImportEntities = makeImportHook('/entities/import');
export const useImportDimensions = makeImportHook('/dimensions/import');
// Each row names its own dimension (by name or type) via a "dimension" column, so one import can
// span Cost Center, Department, Project, etc. all at once.
export const useImportDimensionMembers = makeImportHook('/dimensions/members/import');
export const useImportChartOfAccounts = makeImportHook('/chart-of-accounts/import');
export const useImportCurrencies = makeImportHook('/currencies/import');
export const useImportExchangeRates = makeImportHook('/exchange-rates/import');
export const useImportRateTypes = makeImportHook('/rate-types/import');
export const useImportConsolidationGroups = makeImportHook('/consolidation-groups/import');
export const useImportRoles = makeImportHook('/roles/import');
export const useImportPeriods = makeImportHook('/periods/import');
export const useImportCustomFieldDefinitions = makeImportHook('/custom-field-definitions/import');
