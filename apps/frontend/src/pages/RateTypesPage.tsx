import 'ag-grid-enterprise';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import type { ImportResult, RateType } from '@newa-epm/shared';
import { useCreateRateType, useDeleteRateType, useRateTypes, useUpdateRateType } from '../hooks/useRateTypes';
import { useImportRateTypes } from '../hooks/useBulkImport';
import { ExportMenu } from '../components/ExportMenu';
import { GenericImportModal } from '../components/GenericImportModal';
import { exportGeneric } from '../lib/generic-format';
import type { ExportFormat } from '../lib/generic-format';

const RATE_TYPE_HEADERS = ['code', 'name', 'description', 'defaultAccountTypes'];

const RATE_TYPE_EXPORT_CONFIG = {
  headers: RATE_TYPE_HEADERS,
  filenameBase: 'rate-types',
  sheetName: 'Rate Types',
  itemTag: 'rateType',
  rootTag: 'rateTypes',
};

function rateTypeToRow(rt: RateType): Record<string, unknown> {
  return {
    code: rt.code,
    name: rt.name,
    description: rt.description ?? '',
    defaultAccountTypes: (rt.defaultAccountTypes ?? []).join(','),
  };
}

function rowToRateTypeDto(row: Record<string, unknown>): Record<string, unknown> {
  const dto: Record<string, unknown> = {};
  for (const h of RATE_TYPE_HEADERS) {
    if (h === 'defaultAccountTypes') {
      const raw = String(row[h] ?? '').trim();
      dto[h] = raw ? raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
    } else if (row[h] !== '' && row[h] != null) {
      dto[h] = row[h];
    }
  }
  return dto;
}

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  ASSET:     '#f0fdf4',
  LIABILITY: '#fef2f2',
  EQUITY:    '#eff6ff',
  REVENUE:   '#faf5ff',
  EXPENSE:   '#fff7ed',
};

// ─── Account type pill display (grid cell) ────────────────────────────────────

function AccountTypePills({ types }: { types: string[] }) {
  if (!types?.length) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1 py-0.5">
      {types.map((t) => (
        <span
          key={t}
          className="rounded px-1.5 py-0.5 text-xs font-semibold text-slate-700"
          style={{ backgroundColor: ACCOUNT_TYPE_COLORS[t] ?? '#f1f5f9', border: '1px solid #e2e8f0' }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// ─── Custom modal with checkbox-style account type selector ──────────────────

interface ModalProps {
  open: boolean;
  rateType: RateType | null;
  isPending: boolean;
  onClose: () => void;
  onSave: (data: { code: string; name: string; description: string; accountTypes: string[] }) => void;
}

function RateTypeModal({ open, rateType, isPending, onClose, onSave }: ModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!rateType;

  useEffect(() => {
    if (open) {
      setCode(rateType?.code ?? '');
      setName(rateType?.name ?? '');
      setDescription(rateType?.description ?? '');
      setSelectedTypes(new Set(rateType?.defaultAccountTypes ?? []));
      setErrors({});
    }
  }, [open, rateType]);

  if (!open) return null;

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!isEditing && !code.trim()) errs.code = 'Code is required';
    if (!name.trim()) errs.name = 'Name is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({ code: code.trim().toUpperCase(), name: name.trim(), description: description.trim(), accountTypes: [...selectedTypes] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEditing ? `Edit "${rateType.code}"` : 'New Rate Type'}
          </h2>
          <button className="text-slate-400 hover:text-slate-700 text-lg" onClick={onClose}>✕</button>
        </div>

        {/* Code — create only, can't change code after creation */}
        {!isEditing && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Code <span className="text-slate-400">(e.g. CLOSING, AVERAGE, HISTORICAL)</span>
            </label>
            <input
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm uppercase"
              placeholder="CLOSING"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            {errors.code && <p className="mt-0.5 text-xs text-red-600">{errors.code}</p>}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
          <input
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Closing Rate"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <p className="mt-0.5 text-xs text-red-600">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
          <input
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Used for balance sheet items at period-end"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Account type selector */}
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-700">
            Default for Account Types
            <span className="ml-1 font-normal text-slate-400">(click to toggle)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_TYPES.map((type) => {
              const isActive = selectedTypes.has(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`rounded px-3 py-1.5 text-sm font-semibold text-slate-700 transition-all ${
                    isActive ? 'shadow-sm' : 'opacity-50 hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: ACCOUNT_TYPE_COLORS[type],
                    border: isActive ? '2px solid #475569' : '1.5px solid #e2e8f0',
                    outline: isActive ? '2px solid rgba(71,85,105,0.15)' : 'none',
                    outlineOffset: '1px',
                  }}
                >
                  {isActive ? '✓ ' : ''}{type}
                </button>
              );
            })}
          </div>
          {selectedTypes.size === 0 && (
            <p className="mt-1 text-xs text-slate-400">No account types selected — this rate type won't auto-fill in COA.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            disabled={isPending}
            className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40"
            onClick={handleSave}
          >
            {isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Create rate type'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RateTypesPage(): JSX.Element {
  const { data: rateTypes, isLoading } = useRateTypes();
  const createRateType = useCreateRateType();
  const updateRateType = useUpdateRateType();
  const deleteRateType = useDeleteRateType();
  const importRateTypes = useImportRateTypes();

  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RateType | null>(null);
  const gridApiRef = useRef<GridApi | null>(null);
  const [gridReady, setGridReady] = useState(false);

  const openCreate = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (rt: RateType) => { setEditTarget(rt); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const onGridReady = useCallback((e: GridReadyEvent) => { gridApiRef.current = e.api; setGridReady(true); }, []);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const api = gridApiRef.current;
      if (!api) return;
      exportGeneric(format, api, rateTypes ?? [], rateTypeToRow, RATE_TYPE_EXPORT_CONFIG);
    },
    [rateTypes],
  );

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent<RateType>) => {
      if (!e.data) return;
      updateRateType.mutate({ id: e.data.id, dto: { name: e.data.name, description: e.data.description ?? undefined } });
    },
    [updateRateType],
  );

  const handleSave = useCallback(
    ({ code, name, description, accountTypes }: { code: string; name: string; description: string; accountTypes: string[] }) => {
      if (editTarget) {
        updateRateType.mutate(
          { id: editTarget.id, dto: { name, description, defaultAccountTypes: accountTypes } },
          { onSuccess: closeModal },
        );
      } else {
        createRateType.mutate(
          { code, name, description, defaultAccountTypes: accountTypes },
          { onSuccess: closeModal },
        );
      }
    },
    [editTarget, createRateType, updateRateType],
  );

  const columnDefs = useMemo<ColDef<RateType>[]>(
    () => [
      {
        field: 'code',
        headerName: 'Code',
        width: 150,
        editable: false,
        pinned: 'left',
        filter: 'agTextColumnFilter',
        cellStyle: { fontWeight: 700, fontFamily: 'monospace' },
      },
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 180,
        editable: true,
        filter: 'agTextColumnFilter',
      },
      {
        field: 'description',
        headerName: 'Description',
        flex: 1,
        minWidth: 220,
        editable: true,
        filter: 'agTextColumnFilter',
      },
      {
        field: 'defaultAccountTypes',
        headerName: 'Default for Account Types',
        flex: 1,
        minWidth: 280,
        editable: false,
        filter: false,
        sortable: false,
        cellRenderer: (params: { value: string[] }) => <AccountTypePills types={params.value} />,
      },
      {
        colId: 'actions',
        headerName: 'Actions',
        pinned: 'right',
        width: 160,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: { data: RateType | undefined }) => {
          if (!params.data) return null;
          const { data } = params;
          return (
            <div className="flex gap-3 py-1">
              <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(data)}>
                Edit
              </button>
              <button
                className="text-xs text-red-600 hover:underline"
                onClick={() => { if (confirm(`Delete rate type "${data.code}"?`)) deleteRateType.mutate(data.id); }}
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    [deleteRateType],
  );

  const defaultColDef = useMemo<ColDef>(() => ({ resizable: true, sortable: true, filter: true }), []);

  const isPending = createRateType.isPending || updateRateType.isPending;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Rate Types</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            FX translation rate types — map each to account types for auto-fill in Chart of Accounts.
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
            onClick={openCreate}
          >
            + New Rate Type
          </button>
        </div>
      </div>

      <div
        className="ag-theme-quartz rounded border border-slate-200"
        style={{ height: 'calc(100vh - 240px)', minHeight: 350 }}
      >
        {isLoading ? (
          <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
        ) : (
          <AgGridReact<RateType>
            rowData={rateTypes ?? []}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onCellValueChanged={onCellValueChanged}
            stopEditingWhenCellsLoseFocus
            enterNavigatesVertically
            enterNavigatesVerticallyAfterEdit
            animateRows
            onGridReady={onGridReady}
            rowSelection="multiple"
            suppressRowClickSelection
          />
        )}
      </div>

      <RateTypeModal
        open={modalOpen}
        rateType={editTarget}
        isPending={isPending}
        onClose={closeModal}
        onSave={handleSave}
      />

      <GenericImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Rate Types"
        standardFields={RATE_TYPE_HEADERS}
        helpText={<><code>defaultAccountTypes</code> accepts a comma-separated list, e.g. <code>ASSET,LIABILITY</code>.</>}
        fromRow={rowToRateTypeDto}
        onImport={(rows) => importRateTypes.mutateAsync(rows) as Promise<ImportResult>}
      />
    </div>
  );
}
