// AG Grid Enterprise — unlocks tree data, column tool panel, row grouping, column menus.
import 'ag-grid-enterprise';

import { useCallback, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { AgGridReact } from 'ag-grid-react';
import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import type { Dimension, DimensionMember } from '@newa-epm/shared';
import { FormModal, type FormField } from '../components/FormModal';
import { ExportMenu } from '../components/ExportMenu';
import { DimensionImportModal } from '../components/DimensionImportModal';
import { DimensionMemberImportModal } from '../components/DimensionMemberImportModal';
import {
  useCreateDimension,
  useCreateDimensionMember,
  useDeleteDimension,
  useDeleteDimensionMember,
  useDimensions,
  useInvalidateDimensions,
  useUpdateDimension,
  useUpdateDimensionMember,
} from '../hooks/useDimensions';
import { useImportDimensionMembers, useImportDimensions } from '../hooks/useBulkImport';
import { useCustomFormFields } from '../lib/custom-field-form';
import { useCustomFieldDefinitions } from '../hooks/useCustomFields';
import { exportDimensions } from '../lib/dimension-format';
import type { ExportFormat as DimensionExportFormat } from '../lib/dimension-format';
import { exportDimensionMembers } from '../lib/member-format';
import type { ExportFormat as MemberExportFormat } from '../lib/member-format';

// ─── Types ──────────────────────────────────────────────────────────────────

type DimensionWithMembers = Dimension & { members: DimensionMember[] };

const STATUS_VALUES = ['active', 'inactive'] as const;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createDimensionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  customFields: z.record(z.any()).optional(),
});

const createMemberSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  parentCode: z.string().optional(),
  weight: z.number().optional(),
});

const dimensionCreateFields: FormField[] = [
  { name: 'name', label: 'Name' },
  { name: 'type', label: 'Type (e.g. COST_CENTER)' },
];

function buildMemberFields(members: DimensionMember[]): FormField[] {
  return [
    { name: 'code', label: 'Code' },
    { name: 'name', label: 'Name' },
    {
      name: 'parentCode',
      label: 'Parent Member',
      type: 'select',
      options: [
        { label: '(none - top level)', value: '' },
        ...members.map((m) => ({ label: `${m.code} — ${m.name}`, value: m.code })),
      ],
    },
    { name: 'weight', label: 'Rollup Weight (e.g. 1, -1)', type: 'number' },
  ];
}

// ─── Helper: build the path array from parentCode chain (mirrors ChartOfAccountsPage) ──

function buildMemberPathMap(members: DimensionMember[]): Map<string, string[]> {
  const parentLookup = new Map(members.map((m) => [m.code, m.parentCode ?? null]));
  const cache = new Map<string, string[]>();

  const getPath = (code: string, visited = new Set<string>()): string[] => {
    if (cache.has(code)) return cache.get(code)!;
    if (visited.has(code)) return [code]; // cycle guard
    visited.add(code);
    const parent = parentLookup.get(code);
    const path = parent ? [...getPath(parent, visited), code] : [code];
    cache.set(code, path);
    return path;
  };

  const map = new Map<string, string[]>();
  for (const m of members) {
    map.set(m.code, getPath(m.code));
  }
  return map;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DimensionsPage(): JSX.Element {
  const { data: dimensions, isLoading } = useDimensions();
  const { data: customFieldDefs } = useCustomFieldDefinitions('DIMENSION');
  const customFormFields = useCustomFormFields('DIMENSION');

  const createDimension = useCreateDimension();
  const updateDimension = useUpdateDimension();
  const deleteDimension = useDeleteDimension();
  const importDimensions = useImportDimensions();

  const createMember = useCreateDimensionMember();
  const updateMember = useUpdateDimensionMember();
  const deleteMember = useDeleteDimensionMember();
  const importMembers = useImportDimensionMembers();
  const invalidateDimensions = useInvalidateDimensions();

  const [dimensionModalOpen, setDimensionModalOpen] = useState(false);
  const [dimensionImportOpen, setDimensionImportOpen] = useState(false);
  const [selectedDimensionId, setSelectedDimensionId] = useState<string | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberImportOpen, setMemberImportOpen] = useState(false);

  const dimensionGridApiRef = useRef<GridApi | null>(null);
  const memberGridApiRef = useRef<GridApi | null>(null);
  const [dimensionGridReady, setDimensionGridReady] = useState(false);
  const [memberGridReady, setMemberGridReady] = useState(false);

  const selectedDimension = dimensions?.find((d) => d.id === selectedDimensionId) ?? null;
  const dimensionCreateFields2 = useMemo(() => [...dimensionCreateFields, ...customFormFields], [customFormFields]);

  // ─── Dimension list grid ────────────────────────────────────────────────────

  const onDimensionCellValueChanged = useCallback(
    (event: CellValueChangedEvent<DimensionWithMembers>) => {
      const row = event.data;
      if (!row) return;
      updateDimension.mutate({
        id: row.id,
        dto: { name: row.name, type: row.type, status: row.status as 'active' | 'inactive' },
      });
    },
    [updateDimension],
  );

  const dimensionColumnDefs = useMemo<ColDef<DimensionWithMembers>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 200,
        editable: (params) => !params.data?.isSystem,
        pinned: 'left',
        filter: 'agTextColumnFilter',
        enableRowGroup: true,
        cellStyle: { fontWeight: 600 },
        cellRenderer: (params: { value: string; data: DimensionWithMembers | undefined }) =>
          params.data?.isSystem ? (
            <span>
              {params.value}{' '}
              <span
                className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                title="System dimension — cannot be renamed or deleted"
              >
                System
              </span>
            </span>
          ) : (
            params.value
          ),
      },
      {
        field: 'type',
        headerName: 'Type',
        width: 170,
        editable: (params) => !params.data?.isSystem,
        filter: 'agTextColumnFilter',
        enableRowGroup: true,
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: STATUS_VALUES },
        filter: 'agSetColumnFilter',
        enableRowGroup: true,
        cellClass: (params) => (params.value === 'active' ? 'text-green-700' : 'text-red-600'),
      },
      {
        headerName: 'Members',
        width: 110,
        editable: false,
        sortable: false,
        filter: false,
        valueGetter: (params) => params.data?.members.length ?? 0,
      },
      {
        colId: 'actions',
        headerName: 'Actions',
        pinned: 'right',
        width: 200,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: { data: DimensionWithMembers | undefined }) => {
          if (!params.data) return null;
          const { data } = params;
          return (
            <div className="flex gap-3 py-1">
              <button
                className="text-xs text-slate-600 hover:underline"
                onClick={() => setSelectedDimensionId(data.id)}
              >
                View members
              </button>
              {!data.isSystem && (
                <button
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => {
                    if (confirm(`Delete dimension ${data.name}?`)) {
                      deleteDimension.mutate(data.id);
                      if (selectedDimensionId === data.id) setSelectedDimensionId(null);
                    }
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [deleteDimension, selectedDimensionId],
  );

  const handleDimensionExport = useCallback(
    (format: DimensionExportFormat) => {
      const api = dimensionGridApiRef.current;
      if (!api) return;
      exportDimensions(format, api, dimensions ?? [], customFieldDefs ?? []);
    },
    [dimensions, customFieldDefs],
  );

  // ─── Members grid (hierarchical, parentCode-based like Chart of Accounts) ──

  const members = selectedDimension?.members ?? [];
  const memberPathMap = useMemo(() => buildMemberPathMap(members), [members]);
  const existingMemberCodes = useMemo(() => members.map((m) => m.code), [members]);
  const memberFields = useMemo(() => buildMemberFields(members), [members]);

  const getMemberDataPath = useCallback(
    (data: DimensionMember) => memberPathMap.get(data.code) ?? [data.code],
    [memberPathMap],
  );

  const onMemberCellValueChanged = useCallback(
    (event: CellValueChangedEvent<DimensionMember>) => {
      const row = event.data;
      if (!row || !selectedDimensionId) return;
      updateMember.mutate({
        dimensionId: selectedDimensionId,
        memberId: row.id,
        dto: {
          name: row.name,
          parentCode: row.parentCode || undefined,
          weight: Number(row.weight),
          status: row.status as 'active' | 'inactive',
        },
      });
    },
    [updateMember, selectedDimensionId],
  );

  const memberColumnDefs = useMemo<ColDef<DimensionMember>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 200,
        editable: true,
        filter: 'agTextColumnFilter',
      },
      {
        field: 'parentCode',
        headerName: 'Parent Code',
        width: 150,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['', ...existingMemberCodes] },
        filter: 'agTextColumnFilter',
      },
      {
        field: 'weight',
        headerName: 'Weight',
        width: 100,
        editable: true,
        // Prisma serializes Decimal fields as JSON strings ("1", "-1"), so the value must be
        // coerced to a real number — otherwise AG Grid's cell-type checking either rejects
        // numeric edits (inferred as text) or shows "Invalid Number" (declared as number but
        // fed a string).
        cellDataType: 'number',
        valueGetter: (params) => (params.data ? Number(params.data.weight) : null),
        valueSetter: (params) => {
          if (!params.data) return false;
          params.data.weight = params.newValue;
          return true;
        },
        cellEditor: 'agNumberCellEditor',
        filter: 'agNumberColumnFilter',
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
        headerName: '',
        pinned: 'right',
        width: 90,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: { data: DimensionMember | undefined }) => {
          if (!params.data) return null;
          const { data } = params;
          return (
            <button
              className="text-xs text-red-600 hover:underline"
              onClick={() => {
                if (!selectedDimensionId) return;
                if (confirm(`Delete member ${data.code}?`)) {
                  deleteMember.mutate({ dimensionId: selectedDimensionId, memberId: data.id });
                }
              }}
            >
              Delete
            </button>
          );
        },
      },
    ],
    [existingMemberCodes, deleteMember, selectedDimensionId],
  );

  const memberAutoGroupColumnDef = useMemo<ColDef>(
    () => ({
      headerName: 'Code',
      minWidth: 180,
      width: 200,
      pinned: 'left' as const,
      editable: false,
      filter: 'agTextColumnFilter',
      cellRendererParams: { suppressCount: true },
    }),
    [],
  );

  const handleMemberExport = useCallback(
    (format: MemberExportFormat) => {
      const api = memberGridApiRef.current;
      if (!api || !selectedDimension) return;
      exportDimensionMembers(format, api, selectedDimension.members, selectedDimension.name);
    },
    [selectedDimension],
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      menuTabs: ['generalMenuTab', 'filterMenuTab', 'columnsMenuTab'],
    }),
    [],
  );

  const sideBar = useMemo(
    () => ({
      toolPanels: [
        { id: 'columns', labelDefault: 'Columns', labelKey: 'columns', iconKey: 'columns', toolPanel: 'agColumnsToolPanel' },
        { id: 'filters', labelDefault: 'Filters', labelKey: 'filters', iconKey: 'filter', toolPanel: 'agFiltersToolPanel' },
      ],
    }),
    [],
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8">
      {/* ── Dimensions section ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-800">Dimensions</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu onExport={handleDimensionExport} disabled={!dimensionGridReady} />
            <button
              className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={() => setDimensionImportOpen(true)}
            >
              <span>⬆</span> Import
            </button>
            <button
              className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
              onClick={() => setDimensionModalOpen(true)}
            >
              + New Dimension
            </button>
          </div>
        </div>

        <div className="ag-theme-quartz rounded border border-slate-200" style={{ height: 320, minHeight: 220 }}>
          {isLoading ? (
            <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <AgGridReact<DimensionWithMembers>
              rowData={dimensions ?? []}
              columnDefs={dimensionColumnDefs}
              defaultColDef={defaultColDef}
              sideBar={sideBar}
              rowGroupPanelShow="always"
              onCellValueChanged={onDimensionCellValueChanged}
              stopEditingWhenCellsLoseFocus
              enterNavigatesVertically
              enterNavigatesVerticallyAfterEdit
              animateRows
              onGridReady={(e: GridReadyEvent) => {
                dimensionGridApiRef.current = e.api;
                setDimensionGridReady(true);
              }}
              rowSelection="multiple"
              suppressRowClickSelection
            />
          )}
        </div>
      </div>

      {/* ── Members section (hierarchical, shown once a dimension is selected) ── */}
      {selectedDimension && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-800">Members of {selectedDimension.name}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <ExportMenu onExport={handleMemberExport} disabled={!memberGridReady} />
              <button
                className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                onClick={() => setMemberImportOpen(true)}
              >
                <span>⬆</span> Import
              </button>
              <button
                className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
                onClick={() => setMemberModalOpen(true)}
              >
                + New Member
              </button>
            </div>
          </div>

          {/* AG Grid Enterprise — tree data, same pattern as Chart of Accounts */}
          <div className="ag-theme-quartz rounded border border-slate-200" style={{ height: 420, minHeight: 300 }}>
            <AgGridReact<DimensionMember>
              rowData={members}
              columnDefs={memberColumnDefs}
              defaultColDef={defaultColDef}
              treeData
              getDataPath={getMemberDataPath}
              autoGroupColumnDef={memberAutoGroupColumnDef}
              groupDefaultExpanded={-1}
              sideBar={sideBar}
              onCellValueChanged={onMemberCellValueChanged}
              stopEditingWhenCellsLoseFocus
              enterNavigatesVertically
              enterNavigatesVerticallyAfterEdit
              animateRows
              onGridReady={(e: GridReadyEvent) => {
                memberGridApiRef.current = e.api;
                setMemberGridReady(true);
              }}
              rowSelection="multiple"
              suppressRowClickSelection
            />
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      <FormModal
        title="New Dimension"
        open={dimensionModalOpen}
        onClose={() => setDimensionModalOpen(false)}
        schema={createDimensionSchema}
        fields={dimensionCreateFields2}
        onSubmit={(values) => {
          createDimension.mutate(values, { onSuccess: () => setDimensionModalOpen(false) });
        }}
      />

      <DimensionImportModal
        open={dimensionImportOpen}
        onClose={() => setDimensionImportOpen(false)}
        customFieldDefs={customFieldDefs ?? []}
        onImport={(rows) => importDimensions.mutateAsync(rows)}
      />

      <FormModal
        title="New Member"
        open={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        schema={createMemberSchema}
        fields={memberFields}
        onSubmit={(values) => {
          if (!selectedDimensionId) return;
          createMember.mutate(
            { dimensionId: selectedDimensionId, dto: { ...values, parentCode: values.parentCode || undefined } },
            { onSuccess: () => setMemberModalOpen(false) },
          );
        }}
      />

      <DimensionMemberImportModal
        open={memberImportOpen}
        onClose={() => setMemberImportOpen(false)}
        defaultDimension={selectedDimension?.name ?? 'Dimension'}
        onImport={async (rows) => {
          const result = await importMembers.mutateAsync(rows);
          invalidateDimensions();
          return result;
        }}
      />
    </div>
  );
}
