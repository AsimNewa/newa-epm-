// AG Grid Enterprise — unlocks column tool panel, row grouping, column menus.
import 'ag-grid-enterprise';

import { useCallback, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { AgGridReact } from 'ag-grid-react';
import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import type { FiscalYear, ImportResult, Period } from '@newa-epm/shared';
import { FormModal, type FormField } from '../components/FormModal';
import { ExportMenu } from '../components/ExportMenu';
import { GenericImportModal } from '../components/GenericImportModal';
import { exportGeneric } from '../lib/generic-format';
import type { ExportFormat } from '../lib/generic-format';
import { useImportPeriods } from '../hooks/useBulkImport';
import { usePeriodStore } from '../store/period-store';
import {
  useCopyMasterData,
  useCreateFiscalYear,
  useCreatePeriod,
  useDeletePeriod,
  useFiscalYears,
  usePeriods,
  useUpdatePeriod,
} from '../hooks/usePeriods';

const PERIOD_HEADERS = ['name', 'period', 'periodNumber', 'isAdjustment', 'startDate', 'endDate'];

const PERIOD_EXPORT_CONFIG = {
  headers: [...PERIOD_HEADERS, 'status'],
  filenameBase: 'periods',
  sheetName: 'Periods',
  itemTag: 'period',
  rootTag: 'periods',
};

function periodToRow(p: Period): Record<string, unknown> {
  return {
    name: p.name,
    period: p.period,
    periodNumber: p.periodNumber,
    isAdjustment: p.isAdjustment,
    startDate: String(p.startDate).slice(0, 10),
    endDate: String(p.endDate).slice(0, 10),
    status: p.status,
  };
}

function rowToPeriodDto(row: Record<string, unknown>): Record<string, unknown> {
  const dto: Record<string, unknown> = {};
  for (const h of PERIOD_HEADERS) {
    if (h === 'isAdjustment') {
      const v = row[h];
      dto[h] = v === true || v === 'true' || v === '1' || v === 'yes' || v === 'Yes';
    } else if (row[h] !== '' && row[h] != null) {
      dto[h] = row[h];
    }
  }
  return dto;
}

const MONTH_OPTIONS = [
  { label: 'January', value: '1' },
  { label: 'February', value: '2' },
  { label: 'March', value: '3' },
  { label: 'April', value: '4' },
  { label: 'May', value: '5' },
  { label: 'June', value: '6' },
  { label: 'July', value: '7' },
  { label: 'August', value: '8' },
  { label: 'September', value: '9' },
  { label: 'October', value: '10' },
  { label: 'November', value: '11' },
  { label: 'December', value: '12' },
];

const createYearSchema = z.object({
  startYear: z.number({ invalid_type_error: 'Start year is required' }).int().min(1900).max(9999),
  startMonth: z.coerce.number().int().min(1).max(12),
  regularPeriods: z.number().int().min(1).max(24).optional(),
  adjustmentPeriods: z.number().int().min(0).max(12).optional(),
});

const yearFields: FormField[] = [
  { name: 'startYear', label: 'Start Year', type: 'number' },
  { name: 'startMonth', label: 'Start Month', type: 'select', options: MONTH_OPTIONS },
  { name: 'regularPeriods', label: 'Regular Periods (default 12)', type: 'number' },
  { name: 'adjustmentPeriods', label: 'Adjustment Periods (n extra)', type: 'number' },
];

const createPeriodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  period: z.string().optional(),
  periodNumber: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
});

const periodFields: FormField[] = [
  { name: 'name', label: 'Period Name' },
  { name: 'period', label: 'Period Code (default YYYY-NNN)' },
  { name: 'periodNumber', label: 'Period Number (NNN, alphanumeric allowed)' },
  { name: 'startDate', label: 'Start Date', type: 'date' },
  { name: 'endDate', label: 'End Date', type: 'date' },
];

export function CalendarPeriodsPage(): JSX.Element {
  const { data: fiscalYears, isLoading: loadingYears } = useFiscalYears();
  const { data: periods, isLoading: loadingPeriods } = usePeriods();
  const createFiscalYear = useCreateFiscalYear();
  const createPeriod = useCreatePeriod();
  const updatePeriod = useUpdatePeriod();
  const deletePeriod = useDeletePeriod();
  const copyMasterData = useCopyMasterData();
  const setCurrentPeriodId = usePeriodStore((state) => state.setPeriodId);
  const currentPeriodId = usePeriodStore((state) => state.periodId);

  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [periodImportOpen, setPeriodImportOpen] = useState(false);
  const [copyPrompt, setCopyPrompt] = useState<{ targetPeriodIds: string[]; targetLabel: string } | null>(null);
  const [copySourceId, setCopySourceId] = useState('');

  const periodGridApiRef = useRef<GridApi | null>(null);
  const [periodGridReady, setPeriodGridReady] = useState(false);
  const fyGridApiRef = useRef<GridApi | null>(null);
  const importPeriods = useImportPeriods();

  const sortedPeriods = useMemo(
    () => [...(periods ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [periods],
  );

  const mostRecentPeriod = sortedPeriods[sortedPeriods.length - 1];

  const handlePeriodExport = useCallback(
    (format: ExportFormat) => {
      const api = periodGridApiRef.current;
      if (!api) return;
      exportGeneric(format, api, sortedPeriods, periodToRow, PERIOD_EXPORT_CONFIG);
    },
    [sortedPeriods],
  );

  const onPeriodCellValueChanged = useCallback(
    (event: CellValueChangedEvent<Period>) => {
      const row = event.data;
      if (!row) return;
      updatePeriod.mutate({ id: row.id, dto: { name: row.name, status: row.status } });
    },
    [updatePeriod],
  );

  const columns = useMemo<ColDef<Period>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 160,
        editable: true,
        pinned: 'left',
        filter: 'agTextColumnFilter',
        cellStyle: { fontWeight: 600 },
      },
      { field: 'period', headerName: 'Code', width: 130, editable: false, filter: 'agTextColumnFilter' },
      { field: 'startDate', headerName: 'Start', width: 120, editable: false, filter: 'agDateColumnFilter' },
      { field: 'endDate', headerName: 'End', width: 120, editable: false, filter: 'agDateColumnFilter' },
      { field: 'isAdjustment', headerName: 'Adjustment', width: 110, editable: false, filter: 'agSetColumnFilter' },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['draft', 'open', 'submitted', 'locked'] },
        filter: 'agSetColumnFilter',
      },
      {
        colId: 'actions',
        headerName: 'Actions',
        pinned: 'right',
        width: 260,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: { data: Period | undefined }) => {
          if (!params.data) return null;
          const { data } = params;
          return (
            <div className="flex gap-3 py-1">
              <button
                className="text-xs text-slate-600 hover:underline disabled:opacity-40"
                onClick={() => setCurrentPeriodId(data.id)}
                disabled={currentPeriodId === data.id}
              >
                {currentPeriodId === data.id ? 'Current' : 'Use as current'}
              </button>
              <button
                className="text-xs text-slate-600 hover:underline"
                onClick={() => {
                  setCopySourceId('');
                  setCopyPrompt({ targetPeriodIds: [data.id], targetLabel: data.name });
                }}
              >
                Copy master data
              </button>
              <button
                className="text-xs text-red-600 hover:underline"
                onClick={() => {
                  if (confirm(`Delete period ${data.name}?`)) {
                    deletePeriod.mutate(data.id);
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
    [currentPeriodId, deletePeriod, setCurrentPeriodId],
  );

  const fiscalYearColumns = useMemo<ColDef<FiscalYear>[]>(
    () => [
      { field: 'startYear', headerName: 'Start Year', width: 120 },
      {
        headerName: 'Start Month',
        width: 130,
        valueGetter: (params) => MONTH_OPTIONS.find((m) => Number(m.value) === params.data?.startMonth)?.label,
      },
      { field: 'regularPeriods', headerName: 'Regular Periods', width: 140 },
      { field: 'adjustmentPeriods', headerName: 'Adjustment Periods', width: 150 },
      { headerName: 'Total Periods', width: 130, valueGetter: (params) => params.data?.periods?.length ?? 0 },
      { field: 'status', headerName: 'Status', width: 110 },
    ],
    [],
  );

  const handleCopyConfirm = async (): Promise<void> => {
    if (!copyPrompt || !copySourceId) {
      setCopyPrompt(null);
      return;
    }

    let source = copySourceId;
    for (const targetId of copyPrompt.targetPeriodIds) {
      await copyMasterData.mutateAsync({ periodId: targetId, dto: { sourcePeriodId: source } });
      source = targetId;
    }
    setCopyPrompt(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Fiscal Years</h2>
          <button
            className="rounded bg-brand-primary px-3 py-1.5 text-sm text-white hover:opacity-90"
            onClick={() => setYearModalOpen(true)}
          >
            + New Fiscal Year
          </button>
        </div>
        <div className="ag-theme-quartz rounded border border-slate-200" style={{ height: 260, minHeight: 200 }}>
          {loadingYears ? (
            <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <AgGridReact<FiscalYear>
              rowData={fiscalYears ?? []}
              columnDefs={fiscalYearColumns}
              defaultColDef={{ resizable: true, sortable: true, filter: true }}
              animateRows
              onGridReady={(e: GridReadyEvent) => { fyGridApiRef.current = e.api; }}
              rowSelection="multiple"
              suppressRowClickSelection
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Periods</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu onExport={handlePeriodExport} disabled={!periodGridReady} />
            <button
              className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={() => setPeriodImportOpen(true)}
            >
              <span>⬆</span> Import
            </button>
            <button
              className="rounded bg-brand-primary px-3 py-1.5 text-sm text-white hover:opacity-90"
              onClick={() => setPeriodModalOpen(true)}
            >
              + New Period
            </button>
          </div>
        </div>
        <div className="ag-theme-quartz rounded border border-slate-200" style={{ height: 420, minHeight: 300 }}>
          {loadingPeriods ? (
            <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <AgGridReact<Period>
              rowData={sortedPeriods}
              columnDefs={columns}
              defaultColDef={{ resizable: true, sortable: true, filter: true }}
              sideBar={{
                toolPanels: [
                  { id: 'columns', labelDefault: 'Columns', labelKey: 'columns', iconKey: 'columns', toolPanel: 'agColumnsToolPanel' },
                  { id: 'filters', labelDefault: 'Filters', labelKey: 'filters', iconKey: 'filter', toolPanel: 'agFiltersToolPanel' },
                ],
              }}
              onCellValueChanged={onPeriodCellValueChanged}
              stopEditingWhenCellsLoseFocus
              enterNavigatesVertically
              enterNavigatesVerticallyAfterEdit
              animateRows
              onGridReady={(e: GridReadyEvent) => { periodGridApiRef.current = e.api; setPeriodGridReady(true); }}
              rowSelection="multiple"
              suppressRowClickSelection
            />
          )}
        </div>
      </div>

      <FormModal
        title="New Fiscal Year"
        open={yearModalOpen}
        onClose={() => setYearModalOpen(false)}
        schema={createYearSchema}
        fields={yearFields}
        defaultValues={{ startMonth: 1, regularPeriods: 12, adjustmentPeriods: 0 }}
        onSubmit={(values) => {
          createFiscalYear.mutate(values, {
            onSuccess: (fiscalYear) => {
              setYearModalOpen(false);
              const newPeriodIds = (fiscalYear.periods ?? []).map((p) => p.id);
              if (newPeriodIds.length > 0) {
                setCopySourceId(mostRecentPeriod?.id ?? '');
                setCopyPrompt({ targetPeriodIds: newPeriodIds, targetLabel: `all periods in FY${values.startYear}` });
              }
            },
          });
        }}
      />

      <FormModal
        title="New Period"
        open={periodModalOpen}
        onClose={() => setPeriodModalOpen(false)}
        schema={createPeriodSchema}
        fields={periodFields}
        onSubmit={(values) => {
          createPeriod.mutate(
            { ...values, period: values.period || undefined, periodNumber: values.periodNumber || undefined },
            {
              onSuccess: (created) => {
                setPeriodModalOpen(false);
                setCopySourceId(mostRecentPeriod?.id ?? '');
                setCopyPrompt({ targetPeriodIds: [created.id], targetLabel: created.name });
              },
            },
          );
        }}
      />

      {copyPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded bg-white p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">Copy master data?</h2>
            <p className="mb-4 text-sm text-slate-600">
              Copy entities, chart of accounts, dimensions, and ownership structure into{' '}
              <strong>{copyPrompt.targetLabel}</strong> from an existing period (defaults to the most recent one).
            </p>
            <select
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={copySourceId}
              onChange={(e) => setCopySourceId(e.target.value)}
            >
              <option value="">Skip — start empty</option>
              {sortedPeriods
                .filter((p) => !copyPrompt.targetPeriodIds.includes(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.period})
                  </option>
                ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" onClick={() => setCopyPrompt(null)}>
                Cancel
              </button>
              <button
                className="rounded bg-brand-primary px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
                disabled={copyMasterData.isPending}
                onClick={handleCopyConfirm}
              >
                {copyMasterData.isPending ? 'Copying...' : copySourceId ? 'Copy' : 'Skip'}
              </button>
            </div>
          </div>
        </div>
      )}

      <GenericImportModal
        open={periodImportOpen}
        onClose={() => setPeriodImportOpen(false)}
        title="Import Periods"
        standardFields={PERIOD_HEADERS}
        helpText={<>A <code>period</code> matching an existing code updates that period in place; otherwise a new one is created.</>}
        fromRow={rowToPeriodDto}
        onImport={(rows) => importPeriods.mutateAsync(rows) as Promise<ImportResult>}
      />
    </div>
  );
}
