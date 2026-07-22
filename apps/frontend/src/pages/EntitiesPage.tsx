// Import AG Grid Enterprise — unlocks column tool panel, row grouping, column menus, etc.
// A watermark appears in trial mode; provide a valid license key via LicenseManager for production.
import 'ag-grid-enterprise';

import { useCallback, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { AgGridReact } from 'ag-grid-react';
import type {
  CellValueChangedEvent,
  ColDef,
  ColumnState,
  GetMainMenuItemsParams,
  GridApi,
  GridReadyEvent,
  MenuItemDef,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import type { Entity } from '@newa-epm/shared';
import { FormModal, type FormField } from '../components/FormModal';
import { ExportMenu } from '../components/ExportMenu';
import { EntityImportModal } from '../components/EntityImportModal';
import { useCreateEntity, useDeleteEntity, useEntities, useUpdateEntity } from '../hooks/useEntities';
import { useImportEntities } from '../hooks/useBulkImport';
import { useCustomFormFields } from '../lib/custom-field-form';
import { useCustomFieldDefinitions } from '../hooks/useCustomFields';
import { useFieldGroupingConfigs, useUpsertFieldGrouping } from '../hooks/useFieldGrouping';
import { exportEntities } from '../lib/entity-format';
import type { ExportFormat } from '../lib/entity-format';

// ─── schemas ──────────────────────────────────────────────────────────────────

const baseCreateSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  country: z.string().optional(),
  currency: z.string().length(3, 'Use a 3-letter ISO currency code'),
  customFields: z.record(z.any()).optional(),
});

const STATUS_VALUES = ['active', 'inactive'] as const;

const staticCreateFields: FormField[] = [
  { name: 'code', label: 'Code' },
  { name: 'name', label: 'Name' },
  { name: 'country', label: 'Country' },
  { name: 'currency', label: 'Currency (ISO)' },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function cellEditorForFieldType(fieldType: string, selectOptions: string[]) {
  switch (fieldType) {
    case 'SELECT':
      return { cellEditor: 'agSelectCellEditor', cellEditorParams: { values: selectOptions } };
    case 'DATE':
      return { cellEditor: 'agDateStringCellEditor' };
    case 'NUMBER':
      return { cellEditor: 'agNumberCellEditor' };
    default:
      return {};
  }
}

// ─── component ────────────────────────────────────────────────────────────────

export function EntitiesPage(): JSX.Element {
  const { data: entities, isLoading } = useEntities();
  const { data: customFieldDefs } = useCustomFieldDefinitions('ENTITY');
  const { data: groupingConfigs } = useFieldGroupingConfigs('ENTITY');
  const customFormFields = useCustomFormFields('ENTITY');
  const createEntity = useCreateEntity();
  const updateEntity = useUpdateEntity();
  const deleteEntity = useDeleteEntity();
  const importEntities = useImportEntities();
  const upsertGrouping = useUpsertFieldGrouping('ENTITY');

  const [modalMode, setModalMode] = useState<'create' | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const gridApiRef = useRef<GridApi | null>(null);
  const [gridReady, setGridReady] = useState(false);
  const savedColumnStateRef = useRef<ColumnState[] | null>(null);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const api = gridApiRef.current;
      if (!api) return;
      exportEntities(format, api, entities ?? [], customFieldDefs ?? []);
    },
    [entities, customFieldDefs],
  );

  // Map fieldKey → isGrouping
  const groupingMap = useMemo(
    () => new Map((groupingConfigs ?? []).map((c) => [c.fieldKey, c.isGrouping])),
    [groupingConfigs],
  );

  // Toggle a field's grouping flag via column header menu
  const handleToggleGrouping = useCallback(
    (fieldKey: string) => {
      const current = groupingMap.get(fieldKey) ?? false;
      upsertGrouping.mutate({ entityType: 'ENTITY', fieldKey, isGrouping: !current });
    },
    [groupingMap, upsertGrouping],
  );

  // Build column menu items (Enterprise feature: column header right-click / ≡ menu)
  const getMainMenuItems = useCallback(
    (params: GetMainMenuItemsParams): (string | MenuItemDef)[] => {
      const colId = params.column?.getColId() ?? '';
      // Derive the fieldKey from colId (custom field cols have prefix 'cf_')
      const fieldKey = colId.startsWith('cf_') ? `customFields.${colId.slice(3)}` : colId;
      const isGrouping = groupingMap.get(fieldKey) ?? false;

      const groupingItem: MenuItemDef = {
        name: isGrouping ? '★ Unmark as Grouping Field' : '☆ Mark as Grouping Field',
        tooltip: 'Grouping fields are available as management reporting dimensions',
        action: () => handleToggleGrouping(fieldKey),
        icon: '<span>📊</span>',
      };

      return [...params.defaultItems, 'separator', groupingItem];
    },
    [groupingMap, handleToggleGrouping],
  );

  // Save cell edit to backend
  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<Entity>) => {
      const row = event.data;
      if (!row) return;

      updateEntity.mutate({
        id: row.id,
        dto: {
          name: row.name,
          country: row.country ?? undefined,
          currency: row.currency,
          status: row.status as 'active' | 'inactive',
          customFields: row.customFields ?? undefined,
        },
      });
    },
    [updateEntity],
  );

  // Build header name with grouping indicator
  const headerName = (base: string, fieldKey: string) =>
    groupingMap.get(fieldKey) ? `${base} ★` : base;

  // ─── dynamic column definitions ───────────────────────────────────────────

  const columnDefs = useMemo<ColDef<Entity>[]>(() => {
    const standardCols: ColDef<Entity>[] = [
      {
        field: 'code',
        headerName: headerName('Code', 'code'),
        width: 130,
        editable: false,
        pinned: 'left',
        enableRowGroup: true,
        filter: 'agTextColumnFilter',
        cellStyle: { fontWeight: 600 },
      },
      {
        field: 'name',
        headerName: headerName('Name', 'name'),
        flex: 1,
        minWidth: 180,
        editable: true,
        enableRowGroup: true,
        filter: 'agTextColumnFilter',
      },
      {
        field: 'country',
        headerName: headerName('Country', 'country'),
        width: 130,
        editable: true,
        enableRowGroup: true,
        filter: 'agTextColumnFilter',
      },
      {
        field: 'currency',
        headerName: headerName('Currency', 'currency'),
        width: 120,
        editable: true,
        enableRowGroup: true,
        filter: 'agTextColumnFilter',
      },
      {
        field: 'status',
        headerName: headerName('Status', 'status'),
        width: 120,
        editable: true,
        enableRowGroup: true,
        filter: 'agSetColumnFilter',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: STATUS_VALUES },
        cellClass: (params) =>
          params.value === 'active' ? 'text-green-700' : 'text-red-600',
      },
    ];

    // Custom-field columns (dynamic)
    const customCols: ColDef<Entity>[] = (customFieldDefs ?? []).map((def) => {
      const cfKey = `customFields.${def.fieldKey}`;
      const isGrouping = groupingMap.get(cfKey) ?? false;
      const displayName = isGrouping ? `${def.label} ★` : def.label;

      return {
        colId: `cf_${def.fieldKey}`,
        headerName: displayName,
        valueGetter: (params) =>
          (params.data as Entity | undefined)?.customFields?.[def.fieldKey] ?? null,
        valueSetter: (params) => {
          if (!params.data) return false;
          // Mutate the existing row object (params.data is the actual row reference)
          (params.data as Entity).customFields = {
            ...((params.data as Entity).customFields ?? {}),
            [def.fieldKey]: params.newValue,
          };
          return true;
        },
        editable: true,
        enableRowGroup: def.fieldType !== 'NUMBER',
        filter: def.fieldType === 'NUMBER' ? 'agNumberColumnFilter' : 'agTextColumnFilter',
        ...cellEditorForFieldType(def.fieldType, def.selectOptions),
      } as ColDef<Entity>;
    });

    // Actions column (pinned right, not groupable)
    const actionCol: ColDef<Entity> = {
      colId: 'actions',
      headerName: 'Actions',
      pinned: 'right',
      width: 100,
      sortable: false,
      filter: false,
      enableRowGroup: false,
      suppressHeaderMenuButton: true,
      cellRenderer: (params: { data: Entity | undefined }) => {
        if (!params.data) return null;
        const { data } = params;
        return (
          <button
            className="text-sm text-red-600 hover:underline"
            onClick={() => {
              if (confirm(`Delete entity ${data.code}?`)) {
                deleteEntity.mutate(data.id);
              }
            }}
          >
            Delete
          </button>
        );
      },
    };

    return [...standardCols, ...customCols, actionCol];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customFieldDefs, groupingMap, deleteEntity]);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      enableRowGroup: true,
      menuTabs: ['generalMenuTab', 'filterMenuTab', 'columnsMenuTab'],
    }),
    [],
  );

  const createFields = useMemo(() => [...staticCreateFields, ...customFormFields], [customFormFields]);

  const onGridReady = useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api;
    savedColumnStateRef.current = event.api.getColumnState();
    setGridReady(true);
  }, []);

  // Save column state whenever it changes outside pivot mode so we can restore it on pivot exit
  const onColumnStateChanged = useCallback(() => {
    const api = gridApiRef.current;
    if (!api || api.isPivotMode()) return;
    savedColumnStateRef.current = api.getColumnState();
  }, []);

  // Restore pre-pivot column layout when the user exits pivot mode
  const onColumnPivotModeChanged = useCallback(() => {
    const api = gridApiRef.current;
    if (!api || api.isPivotMode()) return;
    if (savedColumnStateRef.current) {
      setTimeout(() => {
        gridApiRef.current?.applyColumnState({ state: savedColumnStateRef.current!, applyOrder: true });
      }, 0);
    }
  }, []);

  // ─── render ───────────────────────────────────────────────────────────────

  const activeGroupingFields = (groupingConfigs ?? []).filter((c) => c.isGrouping);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Entities</h2>
          {activeGroupingFields.length > 0 && (
            <p className="mt-0.5 text-xs text-slate-500">
              ★ Grouping fields:{' '}
              {activeGroupingFields
                .map((c) => {
                  const cfKey = c.fieldKey.startsWith('customFields.')
                    ? c.fieldKey.slice('customFields.'.length)
                    : null;
                  const label = cfKey
                    ? (customFieldDefs ?? []).find((d) => d.fieldKey === cfKey)?.label ?? cfKey
                    : c.fieldKey;
                  return label;
                })
                .join(', ')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="self-center text-xs text-slate-400">
            ★ right-click header → grouping field
          </span>
          <ExportMenu onExport={handleExport} disabled={!gridReady} />
          <button
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setImportOpen(true)}
          >
            <span>⬆</span> Import
          </button>
          <button
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
            onClick={() => setModalMode('create')}
          >
            + New Entity
          </button>
        </div>
      </div>

      {/* AG Grid Enterprise */}
      <div
        className="ag-theme-quartz rounded border border-slate-200"
        style={{ height: 'calc(100vh - 320px)', minHeight: 400 }}
      >
        {isLoading ? (
          <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
        ) : (
          <AgGridReact<Entity>
            rowData={entities ?? []}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            // ─── Enterprise features ────────────────────────────
            sideBar={{
              toolPanels: [
                {
                  id: 'columns',
                  labelDefault: 'Columns',
                  labelKey: 'columns',
                  iconKey: 'columns',
                  toolPanel: 'agColumnsToolPanel',
                },
                {
                  id: 'filters',
                  labelDefault: 'Filters',
                  labelKey: 'filters',
                  iconKey: 'filter',
                  toolPanel: 'agFiltersToolPanel',
                },
              ],
            }}
            rowGroupPanelShow="always"
            groupDefaultExpanded={-1}
            getMainMenuItems={getMainMenuItems}
            // ─── Pivot save/restore ───────────────────────────────
            onColumnPivotModeChanged={onColumnPivotModeChanged}
            onColumnMoved={onColumnStateChanged}
            onColumnVisible={onColumnStateChanged}
            onColumnResized={onColumnStateChanged}
            onSortChanged={onColumnStateChanged}
            // ─── Editing ─────────────────────────────────────────
            onCellValueChanged={onCellValueChanged}
            stopEditingWhenCellsLoseFocus
            enterNavigatesVertically
            enterNavigatesVerticallyAfterEdit
            // ─── General ─────────────────────────────────────────
            animateRows
            onGridReady={onGridReady}
            suppressMenuHide={false}
            rowSelection="multiple"
            suppressRowClickSelection
          />
        )}
      </div>

      {/* Create entity modal */}
      <FormModal
        title="New Entity"
        open={modalMode === 'create'}
        onClose={() => setModalMode(null)}
        schema={baseCreateSchema}
        fields={createFields}
        onSubmit={(values) => {
          createEntity.mutate(values, { onSuccess: () => setModalMode(null) });
        }}
      />

      {/* Multi-format import modal */}
      <EntityImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        customFieldDefs={customFieldDefs ?? []}
        onImport={(rows) => importEntities.mutateAsync(rows)}
      />
    </div>
  );
}
