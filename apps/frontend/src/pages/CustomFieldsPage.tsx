// AG Grid Enterprise — unlocks column tool panel, row grouping, column menus.
import 'ag-grid-enterprise';

import { useCallback, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { AgGridReact } from 'ag-grid-react';
import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import type { CustomFieldDefinition, CustomFieldEntityType, ImportResult } from '@newa-epm/shared';

// Defined locally to avoid Rollup CJS __exportStar static-analysis limitation
const CUSTOM_FIELD_ENTITY_TYPES = [
  'ENTITY',
  'CHART_OF_ACCOUNT',
  'CURRENCY',
  'DIMENSION',
  'CONSOLIDATION_GROUP',
] as const;
const CUSTOM_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT'] as const;
import { FormModal, type FormField } from '../components/FormModal';
import { ExportMenu } from '../components/ExportMenu';
import { GenericImportModal } from '../components/GenericImportModal';
import { exportGeneric } from '../lib/generic-format';
import type { ExportFormat } from '../lib/generic-format';
import { useImportCustomFieldDefinitions } from '../hooks/useBulkImport';
import {
  useCreateCustomFieldDefinition,
  useCustomFieldDefinitions,
  useDeleteCustomFieldDefinition,
  useUpdateCustomFieldDefinition,
} from '../hooks/useCustomFields';

const ENTITY_TYPE_LABELS: Record<CustomFieldEntityType, string> = {
  ENTITY: 'Entity / Company',
  CHART_OF_ACCOUNT: 'Chart of Account',
  CURRENCY: 'Currency',
  DIMENSION: 'Dimension',
  CONSOLIDATION_GROUP: 'Consolidation Group',
};

const CUSTOM_FIELD_HEADERS = ['entityType', 'fieldKey', 'label', 'fieldType', 'selectOptions', 'required', 'displayOrder'];

const CUSTOM_FIELD_EXPORT_CONFIG = {
  headers: CUSTOM_FIELD_HEADERS,
  filenameBase: 'custom-fields',
  sheetName: 'Custom Fields',
  itemTag: 'customField',
  rootTag: 'customFields',
};

function definitionToRow(def: CustomFieldDefinition): Record<string, unknown> {
  return {
    entityType: def.entityType,
    fieldKey: def.fieldKey,
    label: def.label,
    fieldType: def.fieldType,
    selectOptions: (def.selectOptions ?? []).join(','),
    required: def.required,
    displayOrder: def.displayOrder,
  };
}

function rowToDefinitionDto(row: Record<string, unknown>): Record<string, unknown> {
  const dto: Record<string, unknown> = {};
  for (const h of CUSTOM_FIELD_HEADERS) {
    if (h === 'required') {
      const v = row[h];
      dto[h] = v === true || v === 'true' || v === '1' || v === 'yes' || v === 'Yes';
    } else if (h === 'selectOptions') {
      const raw = String(row[h] ?? '').trim();
      dto[h] = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    } else if (h === 'displayOrder') {
      if (row[h] !== '' && row[h] != null) dto[h] = Number(row[h]);
    } else if (row[h] !== '' && row[h] != null) {
      dto[h] = row[h];
    }
  }
  return dto;
}

const createSchema = z.object({
  entityType: z.enum(CUSTOM_FIELD_ENTITY_TYPES),
  fieldKey: z.string().min(1).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Must start with a letter and contain only letters, numbers, underscores'),
  label: z.string().min(1, 'Label is required'),
  fieldType: z.enum(CUSTOM_FIELD_TYPES),
  required: z.boolean().optional(),
});

const entityTypeOptions = CUSTOM_FIELD_ENTITY_TYPES.map((type) => ({
  label: ENTITY_TYPE_LABELS[type],
  value: type,
}));

const fieldTypeOptions = CUSTOM_FIELD_TYPES.map((type) => ({ label: type, value: type }));

const createFields: FormField[] = [
  { name: 'entityType', label: 'Data Type', type: 'select', options: entityTypeOptions },
  { name: 'fieldKey', label: 'Field Key (slug, e.g. costCode)' },
  { name: 'label', label: 'Display Label' },
  { name: 'fieldType', label: 'Field Type', type: 'select', options: fieldTypeOptions },
];

export function CustomFieldsPage(): JSX.Element {
  const { data: definitions, isLoading } = useCustomFieldDefinitions();
  const createDefinition = useCreateCustomFieldDefinition();
  const updateDefinition = useUpdateCustomFieldDefinition();
  const deleteDefinition = useDeleteCustomFieldDefinition();
  const importDefinitions = useImportCustomFieldDefinitions();

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const gridApiRef = useRef<GridApi | null>(null);
  const [gridReady, setGridReady] = useState(false);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const api = gridApiRef.current;
      if (!api) return;
      exportGeneric(format, api, definitions ?? [], definitionToRow, CUSTOM_FIELD_EXPORT_CONFIG);
    },
    [definitions],
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<CustomFieldDefinition>) => {
      const row = event.data;
      if (!row) return;
      updateDefinition.mutate({ id: row.id, dto: { label: row.label, required: row.required } });
    },
    [updateDefinition],
  );

  const columns = useMemo<ColDef<CustomFieldDefinition>[]>(
    () => [
      {
        headerName: 'Data Type',
        width: 180,
        editable: false,
        pinned: 'left',
        filter: 'agSetColumnFilter',
        valueGetter: (params) => ENTITY_TYPE_LABELS[params.data?.entityType as CustomFieldEntityType],
      },
      { field: 'fieldKey', headerName: 'Key', width: 160, editable: false, filter: 'agTextColumnFilter' },
      { field: 'label', headerName: 'Label', flex: 1, minWidth: 180, editable: true, filter: 'agTextColumnFilter' },
      { field: 'fieldType', headerName: 'Type', width: 120, editable: false, filter: 'agSetColumnFilter' },
      {
        field: 'required',
        headerName: 'Required',
        width: 110,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: [true, false] },
        filter: 'agSetColumnFilter',
        cellRenderer: (params: { value: boolean }) => (params.value ? '✓' : '—'),
      },
      {
        headerName: 'Select Options',
        width: 200,
        editable: false,
        sortable: false,
        filter: false,
        valueGetter: (params) => params.data?.selectOptions.join(', ') || '—',
      },
      {
        colId: 'actions',
        headerName: '',
        pinned: 'right',
        width: 90,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: { data: CustomFieldDefinition | undefined }) => {
          if (!params.data) return null;
          const { data } = params;
          return (
            <button
              className="text-xs text-red-600 hover:underline"
              onClick={() => {
                if (confirm(`Delete field "${data.label}"?`)) {
                  deleteDefinition.mutate(data.id);
                }
              }}
            >
              Delete
            </button>
          );
        },
      },
    ],
    [deleteDefinition],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Custom Fields</h2>
          <p className="mt-1 text-sm text-slate-500">
            Define tenant-wide custom fields for master data. Values are stored per record and visible in create/edit forms.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu onExport={handleExport} disabled={!gridReady} />
          <button
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setImportOpen(true)}
          >
            <span>⬆</span> Import
          </button>
          <button
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
            onClick={() => setCreateOpen(true)}
          >
            + New Custom Field
          </button>
        </div>
      </div>

      <div className="ag-theme-quartz rounded border border-slate-200" style={{ height: 'calc(100vh - 260px)', minHeight: 400 }}>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
        ) : (
          <AgGridReact<CustomFieldDefinition>
            rowData={definitions ?? []}
            columnDefs={columns}
            defaultColDef={{ resizable: true, sortable: true, filter: true }}
            sideBar={{
              toolPanels: [
                { id: 'columns', labelDefault: 'Columns', labelKey: 'columns', iconKey: 'columns', toolPanel: 'agColumnsToolPanel' },
                { id: 'filters', labelDefault: 'Filters', labelKey: 'filters', iconKey: 'filter', toolPanel: 'agFiltersToolPanel' },
              ],
            }}
            onCellValueChanged={onCellValueChanged}
            stopEditingWhenCellsLoseFocus
            enterNavigatesVertically
            enterNavigatesVerticallyAfterEdit
            animateRows
            onGridReady={(e: GridReadyEvent) => { gridApiRef.current = e.api; setGridReady(true); }}
            rowSelection="multiple"
            suppressRowClickSelection
          />
        )}
      </div>

      <FormModal
        title="New Custom Field"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        schema={createSchema}
        fields={createFields}
        defaultValues={{ entityType: 'ENTITY', fieldType: 'TEXT', required: false }}
        onSubmit={(values) => {
          createDefinition.mutate(values, { onSuccess: () => setCreateOpen(false) });
        }}
      />

      <GenericImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Custom Fields"
        standardFields={CUSTOM_FIELD_HEADERS}
        helpText={<><code>selectOptions</code> accepts a comma-separated list and is only used when <code>fieldType</code> is SELECT.</>}
        fromRow={rowToDefinitionDto}
        onImport={(rows) => importDefinitions.mutateAsync(rows) as Promise<ImportResult>}
      />
    </div>
  );
}
