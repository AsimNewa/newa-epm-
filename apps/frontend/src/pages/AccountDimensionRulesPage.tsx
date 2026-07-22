// AG Grid Enterprise — unlocks column tool panel, row grouping, column menus.
import 'ag-grid-enterprise';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  CellStyle,
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellEditor,
  ICellEditorParams,
  ValueGetterParams,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import type { DimensionAccountRule, ImportResult } from '@newa-epm/shared';

// Defined locally to avoid Rollup CJS __exportStar static-analysis limitation
const DIMENSION_APPLICABILITY_VALUES = ['MANDATORY', 'OPTIONAL', 'PROHIBITED'] as const;
type DimensionApplicabilityValue = (typeof DIMENSION_APPLICABILITY_VALUES)[number];
import { ExportMenu } from '../components/ExportMenu';
import { GenericImportModal } from '../components/GenericImportModal';
import { exportGeneric } from '../lib/generic-format';
import type { ExportFormat } from '../lib/generic-format';
import { useDimensions } from '../hooks/useDimensions';
import { useChartOfAccounts } from '../hooks/useChartOfAccounts';
import {
  useCreateDimensionAccountRule,
  useDeleteDimensionAccountRule,
  useDimensionAccountRules,
  useImportDimensionAccountRules,
  useResolveAllDimensions,
  useUpdateDimensionAccountRule,
} from '../hooks/useDimensionAccountRules';

interface CodeOption {
  code: string;
  name: string;
}

const RANGE_SYNTAX_HINT = 'Use ".." for an inclusive range (11100..11999) and "," to combine multiple selections (11100..11999,12100).';

/**
 * Free-text range input with cursor-aware autocomplete: suggestions are filtered against the token
 * currently being typed (the text since the last "," or ".."), not the whole value, so the "," / ".."
 * syntax keeps working while each individual code gets picked from a real list instead of memorized.
 */
function RangeCodeInput({
  value,
  onChange,
  options,
  placeholder,
  wrapperClassName = 'w-full',
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: CodeOption[];
  placeholder?: string;
  wrapperClassName?: string;
  autoFocus?: boolean;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const token = useMemo(() => {
    const before = value.slice(0, cursor);
    const lastComma = before.lastIndexOf(',');
    const lastRangeDots = before.lastIndexOf('..');
    const start = Math.max(lastComma + 1, lastRangeDots >= 0 ? lastRangeDots + 2 : -1, 0);
    return { start, text: before.slice(start).trim() };
  }, [value, cursor]);

  const suggestions = useMemo(() => {
    if (!token.text) return [];
    const q = token.text.toLowerCase();
    return options.filter((o) => o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)).slice(0, 8);
  }, [token.text, options]);

  const trackCursor = (el: HTMLInputElement): void => setCursor(el.selectionStart ?? el.value.length);

  const applySuggestion = (code: string): void => {
    const before = value.slice(0, token.start);
    const after = value.slice(cursor);
    const next = `${before}${code}${after}`;
    onChange(next);
    const pos = (before + code).length;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
    setOpen(false);
  };

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        ref={inputRef}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          trackCursor(e.target);
          setOpen(true);
        }}
        onKeyUp={(e) => trackCursor(e.currentTarget)}
        onClick={(e) => trackCursor(e.currentTarget)}
        onFocus={(e) => {
          trackCursor(e.currentTarget);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-52 w-64 overflow-auto rounded border border-slate-300 bg-white text-xs shadow-lg">
          {suggestions.map((s) => (
            <li key={s.code}>
              <button
                type="button"
                className="block w-full px-2 py-1.5 text-left hover:bg-slate-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySuggestion(s.code)}
              >
                <span className="font-mono font-semibold text-slate-800">{s.code}</span>
                <span className="ml-2 text-slate-500">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// AG Grid custom cell editor — same RangeCodeInput autocomplete, wrapped for the grid's inline
// "Allowed Member Range" cell edit (not just the New Rule/Edit modal). Rendered as a popup
// (cellEditorPopup: true on the column) so the suggestion dropdown isn't clipped by the cell/row.
interface RangeCodeCellEditorParams extends ICellEditorParams<DimensionAccountRule, string> {
  options: CodeOption[];
}

const RangeCodeCellEditor = forwardRef<ICellEditor<string>, RangeCodeCellEditorParams>((props, ref) => {
  const [value, setValue] = useState(props.value ?? '');

  useImperativeHandle(ref, () => ({
    getValue: () => value,
  }));

  return (
    <div className="rounded border border-slate-300 bg-white p-1 shadow-lg" style={{ width: 280 }}>
      <RangeCodeInput value={value} onChange={setValue} options={props.options} placeholder="e.g. CC100..CC120" autoFocus />
    </div>
  );
});
RangeCodeCellEditor.displayName = 'RangeCodeCellEditor';

const RULE_HEADERS = ['conditions', 'applicability', 'memberRange', 'defaultMemberCode', 'priority'];

const CHART_OF_ACCOUNTS_LABEL = 'Chart of Accounts';
const COA_AXIS = ''; // sourceDimensionId '' in form state = Chart of Accounts

const APPLICABILITY_BADGE: Record<string, string> = {
  MANDATORY: 'bg-red-50 text-red-700',
  OPTIONAL: 'bg-slate-100 text-slate-600',
  PROHIBITED: 'bg-amber-50 text-amber-800',
};

interface ConditionRow {
  sourceDimensionId: string; // '' = Chart of Accounts
  sourceRange: string;
}

interface RuleFormOutput {
  applicability: DimensionApplicabilityValue;
  memberRange?: string;
  defaultMemberCode?: string;
  priority: number;
  conditions: { sourceDimensionId?: string; sourceRange: string }[];
}

// ─── Rule create/edit modal — a dynamic list of ANDed source conditions, not a flat form field ────
function RuleFormModal({
  open,
  mode,
  initialRule,
  sourceOptions,
  memberOptions,
  codeOptionsForSource,
  targetMemberCodeOptions,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  initialRule: DimensionAccountRule | null;
  sourceOptions: { label: string; value: string }[];
  memberOptions: { label: string; value: string }[];
  codeOptionsForSource: (sourceDimensionId: string) => CodeOption[];
  targetMemberCodeOptions: CodeOption[];
  onClose: () => void;
  onSubmit: (values: RuleFormOutput) => void;
}): JSX.Element | null {
  const [applicability, setApplicability] = useState<DimensionApplicabilityValue>('MANDATORY');
  const [memberRange, setMemberRange] = useState('');
  const [defaultMemberCode, setDefaultMemberCode] = useState('');
  const [priority, setPriority] = useState(0);
  const [conditions, setConditions] = useState<ConditionRow[]>([{ sourceDimensionId: COA_AXIS, sourceRange: '' }]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (initialRule) {
      setApplicability(initialRule.applicability);
      setMemberRange(initialRule.memberRange ?? '');
      setDefaultMemberCode(initialRule.defaultMemberCode ?? '');
      setPriority(initialRule.priority);
      setConditions(
        initialRule.conditions.length > 0
          ? initialRule.conditions.map((c) => ({ sourceDimensionId: c.sourceDimensionId ?? COA_AXIS, sourceRange: c.sourceRange }))
          : [{ sourceDimensionId: COA_AXIS, sourceRange: '' }],
      );
    } else {
      setApplicability('MANDATORY');
      setMemberRange('');
      setDefaultMemberCode('');
      setPriority(0);
      setConditions([{ sourceDimensionId: COA_AXIS, sourceRange: '' }]);
    }
    setError(null);
  }, [open, initialRule]);

  if (!open) return null;

  const updateCondition = (index: number, patch: Partial<ConditionRow>): void => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };
  const addCondition = (): void => setConditions((prev) => [...prev, { sourceDimensionId: COA_AXIS, sourceRange: '' }]);
  const removeCondition = (index: number): void => setConditions((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = (): void => {
    if (conditions.some((c) => !c.sourceRange.trim())) {
      setError('Every condition needs a range.');
      return;
    }
    const axes = conditions.map((c) => c.sourceDimensionId || COA_AXIS);
    if (new Set(axes).size !== axes.length) {
      setError('Each condition must key off a different source — combine same-axis ranges into one condition instead.');
      return;
    }

    setError(null);
    onSubmit({
      applicability,
      memberRange: memberRange.trim() || undefined,
      defaultMemberCode: defaultMemberCode || undefined,
      priority,
      conditions: conditions.map((c) => ({ sourceDimensionId: c.sourceDimensionId || undefined, sourceRange: c.sourceRange.trim() })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          {mode === 'create' ? 'New Dimension Rule' : 'Edit Dimension Rule'}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Conditions <span className="font-normal text-slate-400">— ALL must match (AND)</span>
            </label>
            <p className="mb-1.5 text-xs text-slate-500">{RANGE_SYNTAX_HINT} Start typing to search that source's codes.</p>
            <div className="space-y-2">
              {conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    className="w-40 shrink-0 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    value={condition.sourceDimensionId}
                    onChange={(e) => updateCondition(index, { sourceDimensionId: e.target.value })}
                  >
                    {sourceOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <RangeCodeInput
                    wrapperClassName="min-w-0 flex-1"
                    placeholder="e.g. 11100..11999,12100"
                    value={condition.sourceRange}
                    onChange={(v) => updateCondition(index, { sourceRange: v })}
                    options={codeOptionsForSource(condition.sourceDimensionId)}
                  />
                  <button
                    type="button"
                    className="shrink-0 text-xs text-red-600 hover:underline disabled:pointer-events-none disabled:opacity-30"
                    disabled={conditions.length <= 1}
                    onClick={() => removeCondition(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="mt-2 text-xs font-medium text-slate-600 hover:underline" onClick={addCondition}>
              + Add condition (AND)
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Applicability</label>
            <select
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={applicability}
              onChange={(e) => setApplicability(e.target.value as DimensionApplicabilityValue)}
            >
              {DIMENSION_APPLICABILITY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Allowed Member Range (blank = any member)</label>
            <p className="mb-1.5 text-xs text-slate-500">{RANGE_SYNTAX_HINT} Start typing to search this dimension's members.</p>
            <RangeCodeInput value={memberRange} onChange={setMemberRange} options={targetMemberCodeOptions} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Default Member (when Mandatory)</label>
            <select
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={defaultMemberCode}
              onChange={(e) => setDefaultMemberCode(e.target.value)}
            >
              {memberOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Priority (tie-breaker, default 0)</label>
            <input
              type="number"
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountDimensionRulesPage(): JSX.Element {
  const { data: dimensions } = useDimensions();
  const { data: accounts } = useChartOfAccounts();
  const [selectedDimensionId, setSelectedDimensionId] = useState<string>('');

  const selectedDimension = (dimensions ?? []).find((d) => d.id === selectedDimensionId) ?? null;
  const { data: rules, isLoading } = useDimensionAccountRules(selectedDimensionId || null);
  const createRule = useCreateDimensionAccountRule();
  const updateRule = useUpdateDimensionAccountRule();
  const deleteRule = useDeleteDimensionAccountRule();
  const importRules = useImportDimensionAccountRules();

  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; rule: DimensionAccountRule | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const gridApiRef = useRef<GridApi | null>(null);
  const [gridReady, setGridReady] = useState(false);

  // ─── Resolve preview — an arbitrary set of (source axis, code) facts, resolved against every dimension ──
  const [previewContext, setPreviewContext] = useState<ConditionRow[]>([{ sourceDimensionId: COA_AXIS, sourceRange: '' }]);
  const resolveAll = useResolveAllDimensions();

  const dimensionNameById = useMemo(() => new Map((dimensions ?? []).map((d) => [d.id, d.name] as const)), [dimensions]);
  const dimensionIdByLowerName = useMemo(
    () => new Map((dimensions ?? []).map((d) => [d.name.toLowerCase(), d.id] as const)),
    [dimensions],
  );

  const sourceLabel = useCallback(
    (sourceDimensionId?: string | null) =>
      sourceDimensionId ? dimensionNameById.get(sourceDimensionId) ?? sourceDimensionId : CHART_OF_ACCOUNTS_LABEL,
    [dimensionNameById],
  );

  const formatConditions = useCallback(
    (rule: DimensionAccountRule) => rule.conditions.map((c) => `${sourceLabel(c.sourceDimensionId)}: ${c.sourceRange}`).join('  AND  '),
    [sourceLabel],
  );

  // Any other dimension can act as a source axis — a target dimension can't source itself.
  const sourceOptions = useMemo(
    () => [
      { label: CHART_OF_ACCOUNTS_LABEL, value: COA_AXIS },
      ...(dimensions ?? []).filter((d) => d.id !== selectedDimensionId).map((d) => ({ label: d.name, value: d.id })),
    ],
    [dimensions, selectedDimensionId],
  );

  const memberOptions = useMemo(
    () => [
      { label: '(none)', value: '' },
      ...(selectedDimension?.members ?? []).map((m) => ({ label: `${m.code} — ${m.name}`, value: m.code })),
    ],
    [selectedDimension],
  );

  // Autocomplete source for a condition row's range input — Chart of Accounts codes, or the picked
  // source dimension's own members.
  const codeOptionsForSource = useCallback(
    (sourceDimensionId: string): CodeOption[] => {
      if (!sourceDimensionId) {
        return (accounts ?? []).map((a) => ({ code: a.accountCode, name: a.accountName }));
      }
      const dim = (dimensions ?? []).find((d) => d.id === sourceDimensionId);
      return (dim?.members ?? []).map((m) => ({ code: m.code, name: m.name }));
    },
    [accounts, dimensions],
  );

  // Autocomplete source for the Allowed Member Range field — always the target dimension's own members.
  const targetMemberCodeOptions = useMemo(
    () => (selectedDimension?.members ?? []).map((m) => ({ code: m.code, name: m.name })),
    [selectedDimension],
  );

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const api = gridApiRef.current;
      if (!api || !selectedDimension) return;
      exportGeneric(
        format,
        api,
        rules ?? [],
        (r: DimensionAccountRule) => ({
          conditions: r.conditions.map((c) => `${sourceLabel(c.sourceDimensionId)}:${c.sourceRange}`).join(';'),
          applicability: r.applicability,
          memberRange: r.memberRange ?? '',
          defaultMemberCode: r.defaultMemberCode ?? '',
          priority: r.priority,
        }),
        {
          headers: RULE_HEADERS,
          filenameBase: `${selectedDimension.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-dimension-rules`,
          sheetName: 'Dimension Rules',
          itemTag: 'rule',
          rootTag: 'dimensionRules',
        },
      );
    },
    [rules, selectedDimension, sourceLabel],
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<DimensionAccountRule>) => {
      const row = event.data;
      if (!row) return;
      updateRule.mutate({
        id: row.id,
        dto: {
          applicability: row.applicability,
          memberRange: row.memberRange || undefined,
          defaultMemberCode: row.defaultMemberCode || undefined,
          priority: Number(row.priority),
        },
      });
    },
    [updateRule],
  );

  const columns = useMemo<ColDef<DimensionAccountRule>[]>(
    () => [
      {
        colId: 'conditions',
        headerName: 'Conditions (AND)',
        flex: 1,
        minWidth: 260,
        editable: false,
        pinned: 'left',
        filter: 'agTextColumnFilter',
        valueGetter: (p: ValueGetterParams<DimensionAccountRule>) => (p.data ? formatConditions(p.data) : ''),
        cellStyle: { fontFamily: 'monospace' } as CellStyle,
      },
      {
        field: 'applicability',
        headerName: 'Applicability',
        width: 150,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: DIMENSION_APPLICABILITY_VALUES },
        filter: 'agSetColumnFilter',
        cellRenderer: (params: { value: string }) => (
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${APPLICABILITY_BADGE[params.value] ?? ''}`}>
            {params.value}
          </span>
        ),
      },
      {
        field: 'memberRange',
        headerName: 'Allowed Member Range',
        width: 220,
        editable: true,
        cellEditor: RangeCodeCellEditor,
        cellEditorPopup: true,
        cellEditorParams: { options: targetMemberCodeOptions },
        filter: 'agTextColumnFilter',
        valueFormatter: (p) => p.value || 'Any member',
        cellStyle: { fontFamily: 'monospace' } as CellStyle,
      },
      {
        field: 'defaultMemberCode',
        headerName: 'Default Member',
        width: 200,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: memberOptions.map((o) => o.value) },
        filter: 'agTextColumnFilter',
        valueFormatter: (p) => p.value || '—',
      },
      {
        field: 'priority',
        headerName: 'Priority',
        width: 100,
        editable: true,
        cellDataType: 'number',
        valueGetter: (params) => (params.data ? Number(params.data.priority) : null),
        valueSetter: (params) => {
          if (!params.data) return false;
          params.data.priority = params.newValue;
          return true;
        },
        cellEditor: 'agNumberCellEditor',
        filter: 'agNumberColumnFilter',
      },
      {
        colId: 'actions',
        headerName: '',
        pinned: 'right',
        width: 130,
        sortable: false,
        filter: false,
        suppressHeaderMenuButton: true,
        cellRenderer: (params: { data: DimensionAccountRule | undefined }) => {
          if (!params.data) return null;
          const { data } = params;
          return (
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-slate-600 hover:underline"
                onClick={() => setModalState({ mode: 'edit', rule: data })}
              >
                Edit
              </button>
              <button
                className="text-xs text-red-600 hover:underline"
                onClick={() => {
                  if (confirm(`Delete rule "${formatConditions(data)}"?`)) deleteRule.mutate(data.id);
                }}
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    [memberOptions, targetMemberCodeOptions, deleteRule, formatConditions],
  );

  const previewResult = useMemo(() => {
    if (!resolveAll.data) return null;
    return resolveAll.data;
  }, [resolveAll.data]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Account ↔ Dimension Rules</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Define which accounts — or which members of another dimension, or a combination of several — require, allow, or
          prohibit each dimension, the range of members allowed, and the preset value to auto-fill when required. A rule
          with multiple conditions matches only when ALL of them are satisfied at once (e.g. Account range AND Department
          range together). By default every regular dimension is Optional unless a rule says otherwise.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Dimension</label>
          <select
            className="w-64 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={selectedDimensionId}
            onChange={(e) => setSelectedDimensionId(e.target.value)}
          >
            <option value="">Select a dimension…</option>
            {(dimensions ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.isSystem ? ' (system)' : ''}
              </option>
            ))}
          </select>
        </div>
        {selectedDimension?.isSystem && (
          <p className="pb-2 text-xs text-slate-500">
            System dimension — unruled accounts default to <strong>Mandatory</strong> (vs. Optional for regular dimensions).
          </p>
        )}
      </div>

      {selectedDimensionId && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Rules for {selectedDimension?.name}</h3>
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
                onClick={() => setModalState({ mode: 'create', rule: null })}
              >
                + New Rule
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Conditions are fixed at creation — use "New Rule" or "Edit" to add ANDed conditions across multiple
            dimensions (e.g. Account range AND Department range, or Project → Department combinations).
          </p>

          <div className="ag-theme-quartz rounded border border-slate-200" style={{ height: 420, minHeight: 300 }}>
            {isLoading ? (
              <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
            ) : (
              <AgGridReact<DimensionAccountRule>
                rowData={rules ?? []}
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
        </div>
      )}

      {/* ── Resolve preview: what does every dimension resolve to for a set of (axis, code) facts? ── */}
      <div className="flex flex-col gap-3 rounded border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-700">Preview resolved rules</h3>
        <p className="text-xs text-slate-500">
          Add one fact per axis (e.g. Chart of Accounts = 61100, Department = FINANCE) and resolve every dimension against
          them — combination rules only match once every axis they reference is supplied.
        </p>

        <div className="space-y-2">
          {previewContext.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                className="w-48 rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={entry.sourceDimensionId}
                onChange={(e) =>
                  setPreviewContext((prev) => prev.map((p, i) => (i === index ? { ...p, sourceDimensionId: e.target.value } : p)))
                }
              >
                <option value={COA_AXIS}>{CHART_OF_ACCOUNTS_LABEL}</option>
                {(dimensions ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input
                className="w-48 rounded border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Code, e.g. 61100 or FINANCE"
                value={entry.sourceRange}
                onChange={(e) =>
                  setPreviewContext((prev) => prev.map((p, i) => (i === index ? { ...p, sourceRange: e.target.value } : p)))
                }
              />
              <button
                type="button"
                className="text-xs text-red-600 hover:underline disabled:pointer-events-none disabled:opacity-30"
                disabled={previewContext.length <= 1}
                onClick={() => setPreviewContext((prev) => prev.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs font-medium text-slate-600 hover:underline"
            onClick={() => setPreviewContext((prev) => [...prev, { sourceDimensionId: COA_AXIS, sourceRange: '' }])}
          >
            + Add axis
          </button>
          <button
            className="ml-auto rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40"
            disabled={previewContext.every((p) => !p.sourceRange.trim())}
            onClick={() =>
              resolveAll.mutate(
                previewContext
                  .filter((p) => p.sourceRange.trim())
                  .map((p) => ({ sourceDimensionId: p.sourceDimensionId || undefined, code: p.sourceRange.trim() })),
              )
            }
          >
            Resolve All Dimensions
          </button>
        </div>

        {previewResult && (
          <table className="w-full max-w-2xl border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b p-2 text-left">Dimension</th>
                <th className="border-b p-2 text-left">Applicability</th>
                <th className="border-b p-2 text-left">Allowed Member Range</th>
                <th className="border-b p-2 text-left">Default Member</th>
              </tr>
            </thead>
            <tbody>
              {previewResult.map((res) => (
                <tr key={res.dimensionId}>
                  <td className="border-b p-2">{dimensionNameById.get(res.dimensionId) ?? res.dimensionId}</td>
                  <td className="border-b p-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${APPLICABILITY_BADGE[res.applicability] ?? ''}`}>
                      {res.applicability}
                    </span>
                  </td>
                  <td className="border-b p-2">{res.memberRange ?? 'Any member'}</td>
                  <td className="border-b p-2">{res.defaultMemberCode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RuleFormModal
        open={modalState !== null}
        mode={modalState?.mode ?? 'create'}
        initialRule={modalState?.rule ?? null}
        sourceOptions={sourceOptions}
        memberOptions={memberOptions}
        codeOptionsForSource={codeOptionsForSource}
        targetMemberCodeOptions={targetMemberCodeOptions}
        onClose={() => setModalState(null)}
        onSubmit={(values) => {
          if (!selectedDimensionId) return;
          if (modalState?.mode === 'edit' && modalState.rule) {
            updateRule.mutate({ id: modalState.rule.id, dto: values }, { onSuccess: () => setModalState(null) });
          } else {
            createRule.mutate({ ...values, dimensionId: selectedDimensionId }, { onSuccess: () => setModalState(null) });
          }
        }}
      />

      <GenericImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={`Import Rules for ${selectedDimension?.name ?? 'Dimension'}`}
        standardFields={RULE_HEADERS}
        helpText={
          <>
            Rows apply to the dimension selected above. <code>conditions</code> is a semicolon-separated list of
            <code> SourceDimension:range</code> pairs (blank source name = Chart of Accounts), e.g.{' '}
            <code>Department:FINANCE;Chart of Accounts:61100..61400</code>. <code>memberRange</code> and{' '}
            <code>defaultMemberCode</code> must be valid member codes for the selected dimension.
          </>
        }
        fromRow={(row) => {
          const dto: Record<string, unknown> = {};
          for (const h of RULE_HEADERS) {
            if (h === 'conditions') {
              const raw = row[h];
              if (raw !== '' && raw != null) {
                dto.conditions = String(raw)
                  .split(';')
                  .map((entry) => entry.trim())
                  .filter(Boolean)
                  .map((entry) => {
                    const idx = entry.indexOf(':');
                    const namePart = idx >= 0 ? entry.slice(0, idx).trim() : '';
                    const rangePart = idx >= 0 ? entry.slice(idx + 1).trim() : entry.trim();
                    const isCoa = !namePart || namePart.toLowerCase() === CHART_OF_ACCOUNTS_LABEL.toLowerCase();
                    return {
                      sourceDimensionId: isCoa ? undefined : dimensionIdByLowerName.get(namePart.toLowerCase()),
                      sourceRange: rangePart,
                    };
                  });
              }
            } else if (h === 'priority') {
              if (row[h] !== '' && row[h] != null) dto[h] = Number(row[h]);
            } else if (row[h] !== '' && row[h] != null) {
              dto[h] = row[h];
            }
          }
          return dto;
        }}
        onImport={(rows) => importRules.mutateAsync({ dimensionId: selectedDimensionId, rows }) as Promise<ImportResult>}
      />
    </div>
  );
}
