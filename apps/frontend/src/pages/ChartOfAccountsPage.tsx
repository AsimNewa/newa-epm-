// AG Grid Enterprise — unlocks tree data, column tool panel, row grouping, column menus.
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
  IRowNode,
  MenuItemDef,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import type { ChartOfAccount } from '@newa-epm/shared';
import { FormModal, type FormField } from '../components/FormModal';
import { ExportMenu } from '../components/ExportMenu';
import { CoaImportModal } from '../components/CoaImportModal';
import {
  useChartOfAccounts,
  useCreateChartOfAccount,
  useDeleteChartOfAccount,
  useUpdateChartOfAccount,
} from '../hooks/useChartOfAccounts';
import { useImportChartOfAccounts } from '../hooks/useBulkImport';
import { useCustomFormFields } from '../lib/custom-field-form';
import { useCustomFieldDefinitions } from '../hooks/useCustomFields';
import { useFieldGroupingConfigs, useUpsertFieldGrouping } from '../hooks/useFieldGrouping';
import { useRateTypes } from '../hooks/useRateTypes';
import { exportChartOfAccounts } from '../lib/coa-format';
import type { ExportFormat } from '../lib/coa-format';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
const ACCOUNT_NATURES = ['DEBIT', 'CREDIT'] as const;
const STATEMENT_TYPES = ['BALANCE_SHEET', 'PROFIT_AND_LOSS', 'CASH_FLOW', 'EQUITY_STATEMENT'] as const;
const CASH_FLOW_CATEGORIES = ['OPERATING', 'INVESTING', 'FINANCING', 'NON_CASH'] as const;
const STATUS_VALUES = ['active', 'inactive'] as const;

// ─── Row color-coding by account type ─────────────────────────────────────────

const TYPE_BG: Record<string, string> = {
  ASSET:     '#f0fdf4', // green-50
  LIABILITY: '#fef2f2', // red-50
  EQUITY:    '#eff6ff', // blue-50
  REVENUE:   '#faf5ff', // purple-50
  EXPENSE:   '#fff7ed', // orange-50
};

// ─── Zod schema ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  accountCode:               z.string().min(1, 'Account code is required'),
  accountName:               z.string().min(1, 'Account name is required'),
  accountType:               z.enum(ACCOUNT_TYPES),
  accountNature:             z.enum(ACCOUNT_NATURES),
  parentCode:                z.string().optional(),
  rollupWeight:              z.number().optional(),
  statementType:             z.enum(STATEMENT_TYPES).optional(),
  cashFlowCategory:          z.enum(CASH_FLOW_CATEGORIES).optional(),
  ifrsReference:             z.string().optional(),
  requiresIntercompanyRecon: z.enum(['true', 'false']).optional(),
  requiresOtherRecon:        z.enum(['true', 'false']).optional(),
  rateType:                  z.string().optional(),
  customFields:              z.record(z.any()).optional(),
});

// ─── Static form fields ───────────────────────────────────────────────────────

const typeOpts = ACCOUNT_TYPES.map((v) => ({ label: v, value: v }));
const natureOpts = ACCOUNT_NATURES.map((v) => ({ label: v, value: v }));
const statementTypeOpts = [
  { label: '—', value: '' },
  ...STATEMENT_TYPES.map((v) => ({ label: v, value: v })),
];
const cashFlowOpts = [
  { label: '—', value: '' },
  ...CASH_FLOW_CATEGORIES.map((v) => ({ label: v, value: v })),
];
const boolOpts = [
  { label: 'No', value: 'false' },
  { label: 'Yes', value: 'true' },
];

const staticCreateFields: FormField[] = [
  { name: 'accountCode',               label: 'Account Code' },
  { name: 'accountName',               label: 'Account Name' },
  { name: 'accountType',               label: 'Type',               type: 'select', options: typeOpts },
  { name: 'accountNature',             label: 'Normal Balance',      type: 'select', options: natureOpts },
  { name: 'parentCode',                label: 'Parent Account Code' },
  { name: 'rollupWeight',              label: 'Rollup Weight',       type: 'number' },
  { name: 'statementType',             label: 'Statement',           type: 'select', options: statementTypeOpts },
  { name: 'cashFlowCategory',          label: 'Cash Flow Category',  type: 'select', options: cashFlowOpts },
  { name: 'ifrsReference',             label: 'IFRS Reference' },
  { name: 'requiresIntercompanyRecon', label: 'IC Recon Required',   type: 'select', options: boolOpts },
  { name: 'requiresOtherRecon',        label: 'Other Recon Required', type: 'select', options: boolOpts },
];

// ─── Helper: build the path array from parentCode chain ───────────────────────

function buildPathMap(accounts: ChartOfAccount[]): Map<string, string[]> {
  const parentLookup = new Map(accounts.map((a) => [a.accountCode, a.parentCode ?? null]));
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
  for (const a of accounts) {
    map.set(a.accountCode, getPath(a.accountCode));
  }
  return map;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChartOfAccountsPage(): JSX.Element {
  const { data: accounts, isLoading } = useChartOfAccounts();
  const { data: customFieldDefs } = useCustomFieldDefinitions('CHART_OF_ACCOUNT');
  const { data: groupingConfigs } = useFieldGroupingConfigs('CHART_OF_ACCOUNT');
  const customFormFields = useCustomFormFields('CHART_OF_ACCOUNT');
  const createAccount = useCreateChartOfAccount();
  const updateAccount = useUpdateChartOfAccount();
  const deleteAccount = useDeleteChartOfAccount();
  const importAccounts = useImportChartOfAccounts();
  const upsertGrouping = useUpsertFieldGrouping('CHART_OF_ACCOUNT');

  const { data: rateTypes } = useRateTypes();

  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const gridApiRef = useRef<GridApi | null>(null);
  const [gridReady, setGridReady] = useState(false);
  const savedColumnStateRef = useRef<ColumnState[] | null>(null);

  // Rate type helpers
  const rateTypeCodes = useMemo(() => (rateTypes ?? []).map((rt) => rt.code), [rateTypes]);

  const defaultRateTypeFor = useCallback(
    (accountType: string): string | null =>
      (rateTypes ?? []).find((rt) => rt.defaultAccountTypes.includes(accountType))?.code ?? null,
    [rateTypes],
  );

  // ─── Account type quick-filter ────────────────────────────────────────────
  const [activeTypeFilters, setActiveTypeFilters] = useState<Set<string>>(new Set());
  const activeTypeFiltersRef = useRef<Set<string>>(new Set());

  const toggleTypeFilter = useCallback((type: string) => {
    const next = new Set(activeTypeFiltersRef.current);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    activeTypeFiltersRef.current = next;
    setActiveTypeFilters(new Set(next));
    gridApiRef.current?.onFilterChanged();
  }, []);

  const clearTypeFilters = useCallback(() => {
    activeTypeFiltersRef.current = new Set();
    setActiveTypeFilters(new Set());
    gridApiRef.current?.onFilterChanged();
  }, []);

  const isExternalFilterPresent = useCallback(() => activeTypeFiltersRef.current.size > 0, []);

  const doesExternalFilterPass = useCallback(
    (node: IRowNode<ChartOfAccount>) =>
      activeTypeFiltersRef.current.size === 0 ||
      activeTypeFiltersRef.current.has(node.data?.accountType ?? ''),
    [],
  );

  // Tree path map — recomputed when accounts change
  const pathMap = useMemo(() => buildPathMap(accounts ?? []), [accounts]);

  // Existing account codes for parentCode validation dropdown
  const existingCodes = useMemo(
    () => (accounts ?? []).map((a) => a.accountCode),
    [accounts],
  );

  // Field-grouping map
  const groupingMap = useMemo(
    () => new Map((groupingConfigs ?? []).map((c) => [c.fieldKey, c.isGrouping])),
    [groupingConfigs],
  );

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const api = gridApiRef.current;
      if (!api) return;
      exportChartOfAccounts(format, api, accounts ?? [], customFieldDefs ?? []);
    },
    [accounts, customFieldDefs],
  );

  const handleToggleGrouping = useCallback(
    (fieldKey: string) => {
      const current = groupingMap.get(fieldKey) ?? false;
      upsertGrouping.mutate({ entityType: 'CHART_OF_ACCOUNT', fieldKey, isGrouping: !current });
    },
    [groupingMap, upsertGrouping],
  );

  const getMainMenuItems = useCallback(
    (params: GetMainMenuItemsParams): (string | MenuItemDef)[] => {
      const colId = params.column?.getColId() ?? '';
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

  const onGridReady = useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api;
    savedColumnStateRef.current = event.api.getColumnState();
    setGridReady(true);
  }, []);

  const onColumnStateChanged = useCallback(() => {
    const api = gridApiRef.current;
    if (!api || api.isPivotMode()) return;
    savedColumnStateRef.current = api.getColumnState();
  }, []);

  const onColumnPivotModeChanged = useCallback(() => {
    const api = gridApiRef.current;
    if (!api || api.isPivotMode()) return;
    if (savedColumnStateRef.current) {
      setTimeout(() => {
        gridApiRef.current?.applyColumnState({ state: savedColumnStateRef.current!, applyOrder: true });
      }, 0);
    }
  }, []);

  // Inline cell edit → update backend (auto-fill rateType when accountType changes)
  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<ChartOfAccount>) => {
      const row = event.data;
      if (!row) return;

      // Auto-fill rateType when accountType is edited and rateType is currently blank
      if (event.colDef.field === 'accountType') {
        const suggested = defaultRateTypeFor(row.accountType);
        if (suggested && !row.rateType) {
          row.rateType = suggested;
          event.api.refreshCells({ rowNodes: [event.node!], columns: ['rateType'] });
        }
      }

      updateAccount.mutate({
        id: row.id,
        dto: {
          accountName:               row.accountName,
          accountType:               row.accountType,
          accountNature:             row.accountNature,
          parentCode:                row.parentCode ?? undefined,
          rollupWeight:              row.rollupWeight,
          status:                    row.status as 'active' | 'inactive',
          statementType:             row.statementType ?? undefined,
          cashFlowCategory:          row.cashFlowCategory ?? undefined,
          ifrsReference:             row.ifrsReference ?? undefined,
          requiresIntercompanyRecon: row.requiresIntercompanyRecon,
          requiresOtherRecon:        row.requiresOtherRecon,
          rateType:                  row.rateType ?? undefined,
          customFields:              row.customFields ?? undefined,
        },
      });
    },
    [updateAccount, defaultRateTypeFor],
  );

  const headerName = (base: string, fieldKey: string) =>
    groupingMap.get(fieldKey) ? `${base} ★` : base;

  // ─── Column definitions ────────────────────────────────────────────────────

  const columnDefs = useMemo<ColDef<ChartOfAccount>[]>(() => {
    const cols: ColDef<ChartOfAccount>[] = [
      {
        field: 'accountName',
        headerName: headerName('Account Name', 'accountName'),
        flex: 1,
        minWidth: 220,
        editable: true,
        filter: 'agTextColumnFilter',
        enableRowGroup: false,
      },
      {
        field: 'accountType',
        headerName: headerName('Type', 'accountType'),
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ACCOUNT_TYPES },
        filter: 'agSetColumnFilter',
        enableRowGroup: false,
        cellStyle: (params) => {
          const bg = TYPE_BG[params.value as string];
          return bg ? { backgroundColor: bg, fontWeight: 600 } : null;
        },
      },
      {
        field: 'accountNature',
        headerName: headerName('Normal Balance', 'accountNature'),
        width: 140,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ACCOUNT_NATURES },
        filter: 'agSetColumnFilter',
        enableRowGroup: false,
      },
      {
        field: 'parentCode',
        headerName: headerName('Parent Code', 'parentCode'),
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['', ...existingCodes] },
        filter: 'agTextColumnFilter',
        enableRowGroup: false,
      },
      {
        field: 'rollupWeight',
        headerName: headerName('Weight', 'rollupWeight'),
        width: 90,
        editable: true,
        // Prisma serializes Decimal fields as JSON strings ("1", "-1"), so the value must be
        // coerced to a real number — otherwise AG Grid's cell-type checking either rejects
        // numeric edits (inferred as text) or shows "Invalid Number" (declared as number but
        // fed a string).
        cellDataType: 'number',
        valueGetter: (params) => (params.data ? Number(params.data.rollupWeight) : null),
        valueSetter: (params) => {
          if (!params.data) return false;
          params.data.rollupWeight = params.newValue;
          return true;
        },
        cellEditor: 'agNumberCellEditor',
        filter: 'agNumberColumnFilter',
      },
      {
        field: 'statementType',
        headerName: headerName('Statement', 'statementType'),
        width: 150,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['', ...STATEMENT_TYPES] },
        filter: 'agSetColumnFilter',
        enableRowGroup: false,
      },
      {
        field: 'cashFlowCategory',
        headerName: headerName('CF Category', 'cashFlowCategory'),
        width: 130,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['', ...CASH_FLOW_CATEGORIES] },
        filter: 'agSetColumnFilter',
        enableRowGroup: false,
      },
      {
        field: 'ifrsReference',
        headerName: headerName('IFRS Ref.', 'ifrsReference'),
        width: 110,
        editable: true,
        filter: 'agTextColumnFilter',
        enableRowGroup: false,
      },
      {
        field: 'requiresIntercompanyRecon',
        headerName: headerName('IC Recon', 'requiresIntercompanyRecon'),
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: [true, false] },
        filter: 'agSetColumnFilter',
        cellRenderer: (params: { value: boolean }) => (params.value ? '✓' : '—'),
      },
      {
        field: 'requiresOtherRecon',
        headerName: headerName('Other Recon', 'requiresOtherRecon'),
        width: 110,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: [true, false] },
        filter: 'agSetColumnFilter',
        cellRenderer: (params: { value: boolean }) => (params.value ? '✓' : '—'),
      },
      {
        field: 'rateType',
        headerName: headerName('Rate Type', 'rateType'),
        width: 130,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: rateTypeCodes.length > 0 ? ['', ...rateTypeCodes] : ['', 'SPOT', 'AVERAGE', 'CLOSING'],
        },
        filter: 'agSetColumnFilter',
        enableRowGroup: true,
        valueFormatter: (p: { value: string | null | undefined }) => p.value || '—',
      },
      {
        field: 'status',
        headerName: headerName('Status', 'status'),
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: STATUS_VALUES },
        filter: 'agSetColumnFilter',
        cellClass: (params) => (params.value === 'active' ? 'text-green-700' : 'text-red-600'),
      },
    ];

    // Custom-field columns
    const cfCols: ColDef<ChartOfAccount>[] = (customFieldDefs ?? []).map((def) => {
      const cfKey = `customFields.${def.fieldKey}`;
      const isGrouping = groupingMap.get(cfKey) ?? false;
      return {
        colId: `cf_${def.fieldKey}`,
        headerName: isGrouping ? `${def.label} ★` : def.label,
        valueGetter: (params) =>
          (params.data as ChartOfAccount | undefined)?.customFields?.[def.fieldKey] ?? null,
        valueSetter: (params) => {
          if (!params.data) return false;
          (params.data as ChartOfAccount).customFields = {
            ...((params.data as ChartOfAccount).customFields ?? {}),
            [def.fieldKey]: params.newValue,
          };
          return true;
        },
        editable: true,
        enableRowGroup: false,
        filter: def.fieldType === 'NUMBER' ? 'agNumberColumnFilter' : 'agTextColumnFilter',
      } as ColDef<ChartOfAccount>;
    });

    // Delete action column (pinned right)
    const actionCol: ColDef<ChartOfAccount> = {
      colId: 'actions',
      headerName: '',
      pinned: 'right',
      width: 80,
      sortable: false,
      filter: false,
      suppressHeaderMenuButton: true,
      cellRenderer: (params: { data: ChartOfAccount | undefined }) => {
        if (!params.data) return null;
        const { data } = params;
        return (
          <button
            className="text-xs text-red-600 hover:underline"
            onClick={() => {
              if (confirm(`Delete account ${data.accountCode}?`)) {
                deleteAccount.mutate(data.id);
              }
            }}
          >
            Delete
          </button>
        );
      },
    };

    return [...cols, ...cfCols, actionCol];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customFieldDefs, groupingMap, existingCodes, deleteAccount]);

  const autoGroupColumnDef = useMemo<ColDef>(
    () => ({
      headerName: 'Account Code',
      minWidth: 180,
      width: 200,
      pinned: 'left' as const,
      editable: false,
      filter: 'agTextColumnFilter',
      cellRendererParams: { suppressCount: true },
    }),
    [],
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

  const getDataPath = useCallback(
    (data: ChartOfAccount) => pathMap.get(data.accountCode) ?? [data.accountCode],
    [pathMap],
  );

  const getRowStyle = useCallback(
    (params: { data?: ChartOfAccount }) => {
      const type = params.data?.accountType;
      return type ? { backgroundColor: TYPE_BG[type] } : undefined;
    },
    [],
  );

  const rateTypeOpts = useMemo(
    () => [
      { label: '—', value: '' },
      ...(rateTypeCodes.length > 0
        ? (rateTypes ?? []).map((rt) => ({ label: rt.name, value: rt.code }))
        : [
            { label: 'Spot', value: 'SPOT' },
            { label: 'Average', value: 'AVERAGE' },
            { label: 'Closing', value: 'CLOSING' },
          ]),
    ],
    [rateTypes, rateTypeCodes],
  );

  const createFields = useMemo(
    () => [
      ...staticCreateFields,
      { name: 'rateType', label: 'Rate Type', type: 'select' as const, options: rateTypeOpts },
      ...customFormFields,
    ],
    [customFormFields, rateTypeOpts],
  );

  const activeGroupingFields = (groupingConfigs ?? []).filter((c) => c.isGrouping);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Chart of Accounts</h2>
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

        {/* Account type filter buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Filter:</span>
          {Object.entries(TYPE_BG).map(([type, color]) => {
            const isActive = activeTypeFilters.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className={`rounded px-2.5 py-0.5 text-xs font-semibold text-slate-700 transition-all ${
                  isActive ? 'shadow-sm' : 'opacity-60 hover:opacity-90'
                }`}
                style={{
                  backgroundColor: color,
                  border: isActive ? '2px solid #475569' : '1px solid #e2e8f0',
                  outline: isActive ? '2px solid rgba(71,85,105,0.15)' : 'none',
                  outlineOffset: '1px',
                }}
                title={isActive ? `Remove ${type} filter` : `Filter by ${type}`}
              >
                {isActive ? `✓ ${type}` : type}
              </button>
            );
          })}
          {activeTypeFilters.size > 0 && (
            <button
              onClick={clearTypeFilters}
              className="rounded border border-slate-300 px-2.5 py-0.5 text-xs text-slate-500 hover:border-slate-500 hover:text-slate-800"
            >
              × Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="self-center text-xs text-slate-400">★ right-click header → grouping</span>
          <ExportMenu onExport={handleExport} disabled={!gridReady} />
          <button
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setImportOpen(true)}
          >
            <span>⬆</span> Import
          </button>
          <button
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
            onClick={() => setModalOpen(true)}
          >
            + New Account
          </button>
        </div>
      </div>

      {/* AG Grid Enterprise — tree data */}
      <div
        className="ag-theme-quartz rounded border border-slate-200"
        style={{ height: 'calc(100vh - 280px)', minHeight: 450 }}
      >
        {isLoading ? (
          <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
        ) : (
          <AgGridReact<ChartOfAccount>
            rowData={accounts ?? []}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            // ─── Tree data (hierarchy) ──────────────────────
            treeData
            getDataPath={getDataPath}
            autoGroupColumnDef={autoGroupColumnDef}
            groupDefaultExpanded={1}
            // ─── Enterprise features ────────────────────────
            sideBar={{
              toolPanels: [
                {
                  id: 'columns',
                  labelDefault: 'Columns',
                  labelKey: 'columns',
                  iconKey: 'columns',
                  toolPanel: 'agColumnsToolPanel',
                  toolPanelParams: {
                    // Tree data owns the row hierarchy so row-group drag zone is suppressed.
                    // Pivot and values are fully available.
                    suppressRowGroups: true,
                  },
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
            getMainMenuItems={getMainMenuItems}
            // ─── Pivot save/restore ──────────────────────────
            onColumnPivotModeChanged={onColumnPivotModeChanged}
            onColumnMoved={onColumnStateChanged}
            onColumnVisible={onColumnStateChanged}
            onColumnResized={onColumnStateChanged}
            onSortChanged={onColumnStateChanged}
            // ─── Color-coding ───────────────────────────────
            getRowStyle={getRowStyle}
            // ─── External type filter ───────────────────────
            isExternalFilterPresent={isExternalFilterPresent}
            doesExternalFilterPass={doesExternalFilterPass}
            // ─── Editing ────────────────────────────────────
            onCellValueChanged={onCellValueChanged}
            stopEditingWhenCellsLoseFocus
            enterNavigatesVertically
            enterNavigatesVerticallyAfterEdit
            // ─── General ────────────────────────────────────
            animateRows
            onGridReady={onGridReady}
            suppressMenuHide={false}
            rowSelection="multiple"
            suppressRowClickSelection
          />
        )}
      </div>

      {/* Create Account modal */}
      <FormModal
        title="New Account"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        schema={createSchema}
        fields={createFields}
        defaultValues={{
          accountType: 'ASSET',
          accountNature: 'DEBIT',
          requiresIntercompanyRecon: 'false',
          requiresOtherRecon: 'false',
          rateType: defaultRateTypeFor('ASSET') ?? '',
        }}
        onSubmit={(values) => {
          const dto = {
            ...values,
            requiresIntercompanyRecon: values.requiresIntercompanyRecon === 'true',
            requiresOtherRecon: values.requiresOtherRecon === 'true',
            statementType:    values.statementType    || undefined,
            cashFlowCategory: values.cashFlowCategory || undefined,
            ifrsReference:    values.ifrsReference    || undefined,
            parentCode:       values.parentCode       || undefined,
            rateType:         values.rateType         || undefined,
          };
          createAccount.mutate(dto, { onSuccess: () => setModalOpen(false) });
        }}
      />

      {/* Multi-format import modal */}
      <CoaImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        customFieldDefs={customFieldDefs ?? []}
        onImport={(rows) => importAccounts.mutateAsync(rows)}
      />
    </div>
  );
}
