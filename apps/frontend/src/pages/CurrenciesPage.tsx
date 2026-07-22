import 'ag-grid-enterprise';

import { useCallback, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { AgGridReact } from 'ag-grid-react';
import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import type { Currency, ExchangeRate } from '@newa-epm/shared';
import { FormModal, type FormField } from '../components/FormModal';
import { ExportMenu } from '../components/ExportMenu';
import { CurrencyImportModal } from '../components/CurrencyImportModal';
import { ExchangeRateImportModal } from '../components/ExchangeRateImportModal';
import {
  useCreateCurrency,
  useCreateExchangeRate,
  useCurrencies,
  useDeleteCurrency,
  useDeleteExchangeRate,
  useExchangeRates,
  useUpdateCurrency,
  useUpdateExchangeRate,
} from '../hooks/useCurrencies';
import { useImportCurrencies, useImportExchangeRates } from '../hooks/useBulkImport';
import { useRateTypes } from '../hooks/useRateTypes';
import { useCustomFormFields } from '../lib/custom-field-form';
import { exportCurrencies, exportExchangeRates } from '../lib/currency-format';
import type { ExportFormat } from '../lib/currency-format';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createCurrencySchema = z.object({
  code: z.string().length(3, 'Use a 3-letter ISO currency code'),
  name: z.string().min(1, 'Name is required'),
  customFields: z.record(z.any()).optional(),
});

const updateCurrencySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  customFields: z.record(z.any()).optional(),
});

const createRateSchema = z.object({
  fromCurrency: z.string().length(3, 'Use a 3-letter ISO currency code'),
  toCurrency: z.string().length(3, 'Use a 3-letter ISO currency code'),
  rateDate: z.string().min(1, 'Date is required'),
  rate: z.number({ invalid_type_error: 'Rate is required' }).positive(),
  rateType: z.string().min(1, 'Rate type is required'),
});

const currencyCreateFields: FormField[] = [
  { name: 'code', label: 'Code (3-letter ISO)' },
  { name: 'name', label: 'Name' },
];
const currencyUpdateFields: FormField[] = [{ name: 'name', label: 'Name' }];

// ─── Component ────────────────────────────────────────────────────────────────

export function CurrenciesPage(): JSX.Element {
  const { data: currencies, isLoading: loadingCurrencies } = useCurrencies();
  const { data: rates, isLoading: loadingRates } = useExchangeRates();
  const { data: rateTypes } = useRateTypes();

  const createCurrency = useCreateCurrency();
  const updateCurrency = useUpdateCurrency();
  const deleteCurrency = useDeleteCurrency();
  const importCurrencies = useImportCurrencies();
  const customFieldDefs = useCustomFormFields('CURRENCY');

  const createRate = useCreateExchangeRate();
  const updateRate = useUpdateExchangeRate();
  const deleteRate = useDeleteExchangeRate();
  const importRates = useImportExchangeRates();

  const [currencyModal, setCurrencyModal] = useState<'create' | 'edit' | null>(null);
  const [currencyImportOpen, setCurrencyImportOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [rateImportOpen, setRateImportOpen] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState<Currency | null>(null);

  const currencyGridRef = useRef<GridApi | null>(null);
  const rateGridRef = useRef<GridApi | null>(null);
  const [currencyGridReady, setCurrencyGridReady] = useState(false);
  const [rateGridReady, setRateGridReady] = useState(false);

  const rateTypeOptions = useMemo(
    () => (rateTypes ?? []).map((rt) => ({ label: rt.name, value: rt.code })),
    [rateTypes],
  );

  const rateFields = useMemo<FormField[]>(
    () => [
      { name: 'fromCurrency', label: 'From Currency (ISO)' },
      { name: 'toCurrency', label: 'To Currency (ISO)' },
      { name: 'rateDate', label: 'Rate Date', type: 'date' },
      { name: 'rate', label: 'Rate', type: 'number' },
      {
        name: 'rateType',
        label: 'Rate Type',
        type: 'select',
        options:
          rateTypeOptions.length > 0
            ? rateTypeOptions
            : [
                { label: 'Spot', value: 'SPOT' },
                { label: 'Average', value: 'AVERAGE' },
                { label: 'Closing', value: 'CLOSING' },
              ],
      },
    ],
    [rateTypeOptions],
  );

  const allCurrencyCreateFields = useMemo(
    () => [...currencyCreateFields, ...customFieldDefs],
    [customFieldDefs],
  );
  const allCurrencyUpdateFields = useMemo(
    () => [...currencyUpdateFields, ...customFieldDefs],
    [customFieldDefs],
  );

  // ─── Currency grid ──────────────────────────────────────────────────────────

  const onCurrencyCellValueChanged = useCallback(
    (e: CellValueChangedEvent<Currency>) => {
      if (!e.data) return;
      updateCurrency.mutate({ id: e.data.id, dto: { name: e.data.name } });
    },
    [updateCurrency],
  );

  const currencyColumnDefs = useMemo<ColDef<Currency>[]>(
    () => [
      {
        field: 'code',
        headerName: 'Code',
        width: 100,
        editable: false,
        pinned: 'left',
        filter: 'agTextColumnFilter',
        enableRowGroup: true,
        cellStyle: { fontWeight: 600 },
      },
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 180,
        editable: true,
        filter: 'agTextColumnFilter',
        enableRowGroup: true,
      },
      {
        field: 'active',
        headerName: 'Active',
        width: 110,
        editable: true,
        filter: 'agSetColumnFilter',
        enableRowGroup: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: [true, false] },
        cellClass: (p) => (p.value ? 'text-green-700' : 'text-red-600'),
      },
      {
        colId: 'actions',
        headerName: 'Actions',
        pinned: 'right',
        width: 140,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: { data: Currency | undefined }) => {
          if (!params.data) return null;
          const { data } = params;
          return (
            <div className="flex gap-3 py-1">
              <button
                className="text-xs text-slate-600 hover:underline"
                onClick={() => { setActiveCurrency(data); setCurrencyModal('edit'); }}
              >
                Edit
              </button>
              <button
                className="text-xs text-red-600 hover:underline"
                onClick={() => {
                  if (confirm(`Delete currency ${data.code}?`)) deleteCurrency.mutate(data.id);
                }}
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    [deleteCurrency],
  );

  // ─── Exchange rate grid ─────────────────────────────────────────────────────

  const onRateCellValueChanged = useCallback(
    (e: CellValueChangedEvent<ExchangeRate>) => {
      if (!e.data || e.colDef.field !== 'rate') return;
      updateRate.mutate({ id: e.data.id, dto: { rate: Number(e.data.rate) } });
    },
    [updateRate],
  );

  const rateTypeCodes = useMemo(
    () => (rateTypes ?? []).map((rt) => rt.code),
    [rateTypes],
  );

  const rateColumnDefs = useMemo<ColDef<ExchangeRate>[]>(
    () => [
      {
        field: 'fromCurrency',
        headerName: 'From',
        width: 90,
        editable: false,
        pinned: 'left',
        filter: 'agTextColumnFilter',
        enableRowGroup: true,
        cellStyle: { fontWeight: 600 },
      },
      {
        field: 'toCurrency',
        headerName: 'To',
        width: 90,
        editable: false,
        pinned: 'left',
        filter: 'agTextColumnFilter',
        enableRowGroup: true,
        cellStyle: { fontWeight: 600 },
      },
      {
        field: 'rateDate',
        headerName: 'Date',
        width: 130,
        editable: false,
        filter: 'agDateColumnFilter',
        enableRowGroup: true,
        valueFormatter: (p) =>
          p.value ? String(p.value).slice(0, 10) : '',
      },
      {
        field: 'rate',
        headerName: 'Rate',
        flex: 1,
        minWidth: 130,
        editable: true,
        filter: 'agNumberColumnFilter',
        cellEditor: 'agNumberCellEditor',
        valueFormatter: (p) => (p.value != null ? Number(p.value).toFixed(6) : ''),
      },
      {
        field: 'rateType',
        headerName: 'Rate Type',
        width: 140,
        editable: false,
        filter: 'agSetColumnFilter',
        enableRowGroup: true,
        ...(rateTypeCodes.length > 0
          ? { cellEditor: 'agSelectCellEditor', cellEditorParams: { values: rateTypeCodes }, editable: false }
          : {}),
      },
      {
        colId: 'actions',
        headerName: 'Actions',
        pinned: 'right',
        width: 100,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: { data: ExchangeRate | undefined }) => {
          if (!params.data) return null;
          const { data } = params;
          return (
            <button
              className="text-xs text-red-600 hover:underline"
              onClick={() => {
                if (confirm(`Delete rate ${data.fromCurrency}/${data.toCurrency}?`))
                  deleteRate.mutate(data.id);
              }}
            >
              Delete
            </button>
          );
        },
      },
    ],
    [deleteRate, rateTypeCodes],
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

  const handleCurrencyExport = useCallback(
    (format: ExportFormat) => {
      if (currencyGridRef.current)
        exportCurrencies(format, currencyGridRef.current, currencies ?? []);
    },
    [currencies],
  );

  const handleRateExport = useCallback(
    (format: ExportFormat) => {
      if (rateGridRef.current) exportExchangeRates(format, rateGridRef.current, rates ?? []);
    },
    [rates],
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8">
      {/* ── Currencies section ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-800">Currencies</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu onExport={handleCurrencyExport} disabled={!currencyGridReady} />
            <button
              className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={() => setCurrencyImportOpen(true)}
            >
              <span>⬆</span> Import
            </button>
            <button
              className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
              onClick={() => { setActiveCurrency(null); setCurrencyModal('create'); }}
            >
              + New Currency
            </button>
          </div>
        </div>

        <div
          className="ag-theme-quartz rounded border border-slate-200"
          style={{ height: 280, minHeight: 200 }}
        >
          {loadingCurrencies ? (
            <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <AgGridReact<Currency>
              rowData={currencies ?? []}
              columnDefs={currencyColumnDefs}
              defaultColDef={defaultColDef}
              sideBar={{ toolPanels: [{ id: 'columns', labelDefault: 'Columns', labelKey: 'columns', iconKey: 'columns', toolPanel: 'agColumnsToolPanel' }, { id: 'filters', labelDefault: 'Filters', labelKey: 'filters', iconKey: 'filter', toolPanel: 'agFiltersToolPanel' }] }}
              rowGroupPanelShow="always"
              onCellValueChanged={onCurrencyCellValueChanged}
              stopEditingWhenCellsLoseFocus
              enterNavigatesVertically
              enterNavigatesVerticallyAfterEdit
              animateRows
              onGridReady={(e: GridReadyEvent) => { currencyGridRef.current = e.api; setCurrencyGridReady(true); }}
              rowSelection="multiple"
              suppressRowClickSelection
            />
          )}
        </div>
      </div>

      {/* ── Exchange Rates section ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-800">Exchange Rates</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu onExport={handleRateExport} disabled={!rateGridReady} />
            <button
              className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={() => setRateImportOpen(true)}
            >
              <span>⬆</span> Import
            </button>
            <button
              className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
              onClick={() => setRateModalOpen(true)}
            >
              + New Rate
            </button>
          </div>
        </div>

        <div
          className="ag-theme-quartz rounded border border-slate-200"
          style={{ height: 'calc(100vh - 560px)', minHeight: 300 }}
        >
          {loadingRates ? (
            <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <AgGridReact<ExchangeRate>
              rowData={rates ?? []}
              columnDefs={rateColumnDefs}
              defaultColDef={defaultColDef}
              sideBar={{ toolPanels: [{ id: 'columns', labelDefault: 'Columns', labelKey: 'columns', iconKey: 'columns', toolPanel: 'agColumnsToolPanel' }, { id: 'filters', labelDefault: 'Filters', labelKey: 'filters', iconKey: 'filter', toolPanel: 'agFiltersToolPanel' }] }}
              rowGroupPanelShow="always"
              onCellValueChanged={onRateCellValueChanged}
              stopEditingWhenCellsLoseFocus
              enterNavigatesVertically
              enterNavigatesVerticallyAfterEdit
              animateRows
              onGridReady={(e: GridReadyEvent) => { rateGridRef.current = e.api; setRateGridReady(true); }}
              rowSelection="multiple"
              suppressRowClickSelection
            />
          )}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      <FormModal
        title="New Currency"
        open={currencyModal === 'create'}
        onClose={() => setCurrencyModal(null)}
        schema={createCurrencySchema}
        fields={allCurrencyCreateFields}
        onSubmit={(values) => createCurrency.mutate(values, { onSuccess: () => setCurrencyModal(null) })}
      />

      <FormModal
        title={`Edit Currency ${activeCurrency?.code ?? ''}`}
        open={currencyModal === 'edit'}
        onClose={() => setCurrencyModal(null)}
        schema={updateCurrencySchema}
        fields={allCurrencyUpdateFields}
        defaultValues={activeCurrency ? { ...activeCurrency, customFields: activeCurrency.customFields ?? undefined } : undefined}
        onSubmit={(values) => {
          if (!activeCurrency) return;
          updateCurrency.mutate({ id: activeCurrency.id, dto: values }, { onSuccess: () => setCurrencyModal(null) });
        }}
      />

      <CurrencyImportModal
        open={currencyImportOpen}
        onClose={() => setCurrencyImportOpen(false)}
        onImport={(rows) => importCurrencies.mutateAsync(rows)}
      />

      <FormModal
        title="New Exchange Rate"
        open={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        schema={createRateSchema}
        fields={rateFields}
        defaultValues={{ rateType: rateTypeOptions[0]?.value ?? 'SPOT' }}
        onSubmit={(values) =>
          createRate.mutate(
            { ...values, rate: Number(values.rate) },
            { onSuccess: () => setRateModalOpen(false) },
          )
        }
      />

      <ExchangeRateImportModal
        open={rateImportOpen}
        onClose={() => setRateImportOpen(false)}
        onImport={(rows) => importRates.mutateAsync(rows)}
      />
    </div>
  );
}
