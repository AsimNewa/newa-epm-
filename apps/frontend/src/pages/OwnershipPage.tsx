// AG Grid Enterprise — unlocks column tool panel, row grouping, column menus.
import 'ag-grid-enterprise';

import { useCallback, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { AgGridReact } from 'ag-grid-react';
import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import type { ConsolidationGroup, GroupMember, OwnershipStructureEntry } from '@newa-epm/shared';
import { FormModal, type FormField } from '../components/FormModal';
import { ExportMenu } from '../components/ExportMenu';
import { GroupImportModal } from '../components/GroupImportModal';
import { OwnershipStructureImportModal } from '../components/OwnershipStructureImportModal';
import { useEntities } from '../hooks/useEntities';
import { usePeriods } from '../hooks/usePeriods';
import { useImportConsolidationGroups, useImportOwnershipStructure } from '../hooks/useBulkImport';
import { useCustomFormFields } from '../lib/custom-field-form';
import { useCustomFieldDefinitions } from '../hooks/useCustomFields';
import { exportConsolidationGroups, exportOwnershipStructure } from '../lib/ownership-format';
import type { ExportFormat } from '../lib/ownership-format';
import {
  useConsolidationGroups,
  useCreateConsolidationGroup,
  useCreateOwnershipStructureEntry,
  useDeleteConsolidationGroup,
  useDeleteOwnershipStructureEntry,
  useOwnershipStructure,
  useUpdateConsolidationGroup,
  useUpdateOwnershipStructureEntry,
} from '../hooks/useOwnership';

type GroupWithMembers = ConsolidationGroup & { members: GroupMember[] };

const STATUS_VALUES = ['active', 'inactive'] as const;
const CONSOLIDATION_METHODS = [
  { label: 'Full', value: 'FULL' },
  { label: 'Equity', value: 'EQUITY' },
  { label: 'Proportionate', value: 'PROPORTIONATE' },
  { label: 'Cost', value: 'COST' },
];

const createGroupSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  reportingCurrency: z.string().optional(),
  parentEntityId: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

const createStructureSchema = z.object({
  subsidiaryEntityId: z.string().min(1, 'Subsidiary entity is required'),
  parentEntityId: z.string().min(1, 'Parent entity is required'),
  consolidationMethod: z.enum(['FULL', 'EQUITY', 'PROPORTIONATE', 'COST']),
  directPercentage: z.number({ invalid_type_error: 'Direct % is required' }).min(0).max(100),
  effectivePercentage: z.number().min(0).max(100).optional(),
  nciPercentage: z.number().min(0).max(100).optional(),
  effectiveFromPeriodId: z.string().min(1, 'Effective from period is required'),
  effectiveToPeriodId: z.string().optional(),
  acquisitionCost: z.number().optional(),
  acquisitionDate: z.string().optional(),
});

const editStructureSchema = z.object({
  consolidationMethod: z.enum(['FULL', 'EQUITY', 'PROPORTIONATE', 'COST']),
  directPercentage: z.number({ invalid_type_error: 'Direct % is required' }).min(0).max(100),
  effectivePercentage: z.number().min(0).max(100).optional(),
  nciPercentage: z.number().min(0).max(100).optional(),
  effectiveToPeriodId: z.string().optional(),
  acquisitionCost: z.number().optional(),
  acquisitionDate: z.string().optional(),
});

export function OwnershipPage(): JSX.Element {
  const { data: groups, isLoading } = useConsolidationGroups();
  const { data: entities } = useEntities();
  const { data: periods } = usePeriods();
  const createGroup = useCreateConsolidationGroup();
  const updateGroup = useUpdateConsolidationGroup();
  const deleteGroup = useDeleteConsolidationGroup();
  const importGroups = useImportConsolidationGroups();
  const customFormFields = useCustomFormFields('CONSOLIDATION_GROUP');
  const { data: customFieldDefs } = useCustomFieldDefinitions('CONSOLIDATION_GROUP');

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupImportOpen, setGroupImportOpen] = useState(false);
  const [structureCreateOpen, setStructureCreateOpen] = useState(false);
  const [structureImportOpen, setStructureImportOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<OwnershipStructureEntry | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const groupGridApiRef = useRef<GridApi | null>(null);
  const [groupGridReady, setGroupGridReady] = useState(false);
  const structureGridApiRef = useRef<GridApi | null>(null);
  const [structureGridReady, setStructureGridReady] = useState(false);

  const selectedGroup = (groups ?? []).find((g) => g.id === selectedGroupId) as GroupWithMembers | undefined;
  const { data: structureEntries } = useOwnershipStructure(selectedGroupId);
  const createEntry = useCreateOwnershipStructureEntry();
  const updateEntry = useUpdateOwnershipStructureEntry();
  const deleteEntry = useDeleteOwnershipStructureEntry();
  const importStructure = useImportOwnershipStructure(selectedGroupId ?? '');

  const entityOptions = useMemo(
    () => (entities ?? []).map((e) => ({ label: `${e.code} - ${e.name}`, value: e.id })),
    [entities],
  );

  const periodOptions = useMemo(
    () => (periods ?? []).map((p) => ({ label: `${p.name} (${p.period})`, value: p.id })),
    [periods],
  );

  const groupCreateFields: FormField[] = useMemo(
    () => [
      { name: 'code', label: 'Code' },
      { name: 'name', label: 'Name' },
      { name: 'reportingCurrency', label: 'Reporting Currency (ISO)' },
      { name: 'parentEntityId', label: 'Parent Entity', type: 'combobox', options: [{ label: '(none)', value: '' }, ...entityOptions] },
      ...customFormFields,
    ],
    [entityOptions, customFormFields],
  );

  const handleGroupExport = useCallback(
    (format: ExportFormat) => {
      const api = groupGridApiRef.current;
      if (!api) return;
      exportConsolidationGroups(format, api, groups ?? [], customFieldDefs ?? []);
    },
    [groups, customFieldDefs],
  );

  const handleStructureExport = useCallback(
    (format: ExportFormat) => {
      const api = structureGridApiRef.current;
      if (!api) return;
      exportOwnershipStructure(format, api, structureEntries ?? []);
    },
    [structureEntries],
  );

  const onGroupCellValueChanged = useCallback(
    (event: CellValueChangedEvent<GroupWithMembers>) => {
      const row = event.data;
      if (!row) return;
      updateGroup.mutate({
        id: row.id,
        dto: {
          name: row.name,
          reportingCurrency: row.reportingCurrency ?? undefined,
          status: row.status as 'active' | 'inactive',
        },
      });
    },
    [updateGroup],
  );

  const createStructureFields: FormField[] = useMemo(
    () => [
      { name: 'subsidiaryEntityId', label: 'Subsidiary Entity', type: 'combobox', options: entityOptions },
      { name: 'parentEntityId', label: 'Parent Entity', type: 'combobox', options: entityOptions },
      { name: 'consolidationMethod', label: 'Consolidation Method', type: 'select', options: CONSOLIDATION_METHODS },
      { name: 'directPercentage', label: 'Direct Ownership %', type: 'number' },
      { name: 'effectivePercentage', label: 'Effective % (optional, defaults to Direct %)', type: 'number' },
      { name: 'nciPercentage', label: 'NCI % (optional, defaults to 100 − Direct %)', type: 'number' },
      { name: 'effectiveFromPeriodId', label: 'Effective From Period', type: 'select', options: periodOptions },
      {
        name: 'effectiveToPeriodId',
        label: 'Effective To Period (optional)',
        type: 'select',
        options: [{ label: '(ongoing)', value: '' }, ...periodOptions],
      },
      { name: 'acquisitionCost', label: 'Acquisition Cost (optional)', type: 'number' },
      { name: 'acquisitionDate', label: 'Acquisition Date (optional)', type: 'date' },
    ],
    [entityOptions, periodOptions],
  );

  // Identity fields (subsidiary/parent/effective-from-period) can't change after creation — to
  // change who-owns-whom or the start period, delete the entry and create a new one. Editing
  // only touches method/percentages/effective-to/acquisition info.
  const editStructureFields: FormField[] = useMemo(
    () => [
      { name: 'consolidationMethod', label: 'Consolidation Method', type: 'select', options: CONSOLIDATION_METHODS },
      { name: 'directPercentage', label: 'Direct Ownership %', type: 'number' },
      { name: 'effectivePercentage', label: 'Effective % (optional, defaults to Direct %)', type: 'number' },
      { name: 'nciPercentage', label: 'NCI % (optional, defaults to 100 − Direct %)', type: 'number' },
      {
        name: 'effectiveToPeriodId',
        label: 'Effective To Period (optional)',
        type: 'select',
        options: [{ label: '(ongoing)', value: '' }, ...periodOptions],
      },
      { name: 'acquisitionCost', label: 'Acquisition Cost (optional)', type: 'number' },
      { name: 'acquisitionDate', label: 'Acquisition Date (optional)', type: 'date' },
    ],
    [periodOptions],
  );

  const entityLabel = useCallback(
    (id: string) => {
      const e = (entities ?? []).find((entity) => entity.id === id);
      return e ? `${e.code} - ${e.name}` : id;
    },
    [entities],
  );

  const periodLabel = useCallback(
    (id: string) => (periods ?? []).find((p) => p.id === id)?.period ?? id,
    [periods],
  );

  const editModalTitle = editingEntry
    ? `Edit: ${entityLabel(editingEntry.subsidiaryEntityId)} owned by ${entityLabel(editingEntry.parentEntityId)}, from ${periodLabel(editingEntry.effectiveFromPeriodId)}`
    : '';

  const groupColumns = useMemo<ColDef<GroupWithMembers>[]>(
    () => [
      {
        field: 'code',
        headerName: 'Code',
        width: 140,
        editable: false,
        pinned: 'left',
        filter: 'agTextColumnFilter',
        enableRowGroup: true,
        cellStyle: { fontWeight: 600 },
      },
      { field: 'name', headerName: 'Name', flex: 1, minWidth: 180, editable: true, filter: 'agTextColumnFilter' },
      {
        field: 'reportingCurrency',
        headerName: 'Reporting Currency',
        width: 160,
        editable: true,
        filter: 'agTextColumnFilter',
      },
      {
        headerName: 'Members',
        width: 100,
        editable: false,
        sortable: false,
        filter: false,
        valueGetter: (params) => params.data?.members?.length ?? 0,
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: STATUS_VALUES },
        filter: 'agSetColumnFilter',
        cellClass: (params) => (params.value === 'active' ? 'text-green-700' : 'text-red-600'),
      },
      {
        colId: 'actions',
        headerName: 'Actions',
        pinned: 'right',
        width: 160,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: { data: GroupWithMembers | undefined }) => {
          if (!params.data) return null;
          const { data } = params;
          return (
            <div className="flex gap-3 py-1">
              <button
                className="text-xs text-slate-600 hover:underline"
                onClick={() => setSelectedGroupId(data.id)}
              >
                Open
              </button>
              <button
                className="text-xs text-red-600 hover:underline"
                onClick={() => {
                  if (confirm(`Delete group ${data.code}?`)) {
                    deleteGroup.mutate(data.id);
                    if (selectedGroupId === data.id) setSelectedGroupId(null);
                  }
                }}
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    [deleteGroup, selectedGroupId],
  );

  const structureColumns = useMemo<ColDef<OwnershipStructureEntry>[]>(
    () => [
      {
        headerName: 'Subsidiary Entity',
        flex: 1,
        minWidth: 160,
        filter: 'agTextColumnFilter',
        valueGetter: (params) =>
          params.data?.subsidiaryEntity
            ? `${params.data.subsidiaryEntity.code} - ${params.data.subsidiaryEntity.name}`
            : params.data?.subsidiaryEntityId,
      },
      {
        headerName: 'Parent Entity',
        flex: 1,
        minWidth: 160,
        filter: 'agTextColumnFilter',
        valueGetter: (params) =>
          params.data?.parentEntity
            ? `${params.data.parentEntity.code} - ${params.data.parentEntity.name}`
            : params.data?.parentEntityId,
      },
      { field: 'consolidationMethod', headerName: 'Method', width: 140, filter: 'agSetColumnFilter' },
      { field: 'directPercentage', headerName: 'Direct %', width: 100 },
      { field: 'effectivePercentage', headerName: 'Effective %', width: 110 },
      { field: 'nciPercentage', headerName: 'NCI %', width: 90 },
      {
        headerName: 'From Period',
        width: 130,
        valueGetter: (params) => params.data?.effectiveFromPeriod?.period ?? params.data?.effectiveFromPeriodId,
      },
      {
        headerName: 'To Period',
        width: 130,
        valueGetter: (params) => params.data?.effectiveToPeriod?.period ?? '(ongoing)',
      },
      { field: 'acquisitionCost', headerName: 'Acquisition Cost', width: 140 },
      { field: 'acquisitionDate', headerName: 'Acquisition Date', width: 130 },
      {
        colId: 'actions',
        headerName: 'Actions',
        pinned: 'right',
        width: 130,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: { data: OwnershipStructureEntry | undefined }) => {
          if (!params.data) return null;
          const { data } = params;
          return (
            <div className="flex gap-3 py-1">
              <button
                className="text-xs text-slate-600 hover:underline"
                onClick={() => setEditingEntry(data)}
              >
                Edit
              </button>
              <button
                className="text-xs text-red-600 hover:underline"
                onClick={() => {
                  if (!selectedGroupId) return;
                  if (confirm('Delete this ownership structure entry?')) {
                    deleteEntry.mutate({ groupId: selectedGroupId, id: data.id });
                  }
                }}
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    [deleteEntry, selectedGroupId],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-800">Consolidation Groups</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu onExport={handleGroupExport} disabled={!groupGridReady} />
            <button
              className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={() => setGroupImportOpen(true)}
            >
              <span>⬆</span> Import
            </button>
            <button
              className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
              onClick={() => setGroupModalOpen(true)}
            >
              + New Group
            </button>
          </div>
        </div>

        <div className="ag-theme-quartz rounded border border-slate-200" style={{ height: 380, minHeight: 260 }}>
          {isLoading ? (
            <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <AgGridReact<GroupWithMembers>
              rowData={(groups ?? []) as GroupWithMembers[]}
              columnDefs={groupColumns}
              defaultColDef={{ resizable: true, sortable: true, filter: true }}
              sideBar={{
                toolPanels: [
                  { id: 'columns', labelDefault: 'Columns', labelKey: 'columns', iconKey: 'columns', toolPanel: 'agColumnsToolPanel' },
                  { id: 'filters', labelDefault: 'Filters', labelKey: 'filters', iconKey: 'filter', toolPanel: 'agFiltersToolPanel' },
                ],
              }}
              rowGroupPanelShow="always"
              onCellValueChanged={onGroupCellValueChanged}
              stopEditingWhenCellsLoseFocus
              enterNavigatesVertically
              enterNavigatesVerticallyAfterEdit
              animateRows
              onGridReady={(e: GridReadyEvent) => { groupGridApiRef.current = e.api; setGroupGridReady(true); }}
              rowSelection="multiple"
              suppressRowClickSelection
            />
          )}
        </div>
      </div>

      {!selectedGroup && (
        <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Select a group above (or create one), then click <strong>Open</strong> to manage its ownership structure.
        </p>
      )}

      {selectedGroup && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-800">Ownership Structure — {selectedGroup.name}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <ExportMenu onExport={handleStructureExport} disabled={!structureGridReady} />
              <button
                className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                onClick={() => setStructureImportOpen(true)}
              >
                <span>⬆</span> Import
              </button>
              <button
                className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
                onClick={() => setStructureCreateOpen(true)}
              >
                + New Ownership Entry
              </button>
            </div>
          </div>

          <div className="ag-theme-quartz rounded border border-slate-200" style={{ height: 380, minHeight: 260 }}>
            <AgGridReact<OwnershipStructureEntry>
              rowData={structureEntries ?? []}
              columnDefs={structureColumns}
              defaultColDef={{ resizable: true, sortable: true, filter: true }}
              sideBar={{
                toolPanels: [
                  { id: 'columns', labelDefault: 'Columns', labelKey: 'columns', iconKey: 'columns', toolPanel: 'agColumnsToolPanel' },
                  { id: 'filters', labelDefault: 'Filters', labelKey: 'filters', iconKey: 'filter', toolPanel: 'agFiltersToolPanel' },
                ],
              }}
              animateRows
              onGridReady={(e: GridReadyEvent) => { structureGridApiRef.current = e.api; setStructureGridReady(true); }}
            />
          </div>
        </div>
      )}

      <FormModal
        title="New Consolidation Group"
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        schema={createGroupSchema}
        fields={groupCreateFields}
        onSubmit={(values) => {
          const dto = { ...values, parentEntityId: values.parentEntityId || undefined };
          createGroup.mutate(dto, { onSuccess: () => setGroupModalOpen(false) });
        }}
      />

      <FormModal
        title="New Ownership Entry"
        open={structureCreateOpen}
        onClose={() => setStructureCreateOpen(false)}
        schema={createStructureSchema}
        fields={createStructureFields}
        defaultValues={{ consolidationMethod: 'FULL' }}
        onSubmit={(values) => {
          if (!selectedGroupId) return;
          const dto = { ...values, effectiveToPeriodId: values.effectiveToPeriodId || undefined };
          createEntry.mutate({ groupId: selectedGroupId, dto }, { onSuccess: () => setStructureCreateOpen(false) });
        }}
      />

      <FormModal
        title={editModalTitle}
        open={editingEntry !== null}
        onClose={() => setEditingEntry(null)}
        schema={editStructureSchema}
        fields={editStructureFields}
        defaultValues={
          editingEntry
            ? {
                consolidationMethod: editingEntry.consolidationMethod,
                directPercentage: editingEntry.directPercentage,
                effectivePercentage: editingEntry.effectivePercentage ?? undefined,
                nciPercentage: editingEntry.nciPercentage ?? undefined,
                effectiveToPeriodId: editingEntry.effectiveToPeriodId ?? '',
                acquisitionCost: editingEntry.acquisitionCost ?? undefined,
                acquisitionDate: editingEntry.acquisitionDate ?? undefined,
              }
            : undefined
        }
        onSubmit={(values) => {
          if (!selectedGroupId || !editingEntry) return;
          const dto = { ...values, effectiveToPeriodId: values.effectiveToPeriodId || undefined };
          updateEntry.mutate(
            { groupId: selectedGroupId, id: editingEntry.id, dto },
            { onSuccess: () => setEditingEntry(null) },
          );
        }}
      />

      <GroupImportModal
        open={groupImportOpen}
        onClose={() => setGroupImportOpen(false)}
        customFieldDefs={customFieldDefs ?? []}
        onImport={(rows) => importGroups.mutateAsync(rows)}
      />

      <OwnershipStructureImportModal
        open={structureImportOpen}
        onClose={() => setStructureImportOpen(false)}
        onImport={(rows) => importStructure.mutateAsync(rows)}
      />
    </div>
  );
}
