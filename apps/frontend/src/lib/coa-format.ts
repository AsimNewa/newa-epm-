/**
 * Export and import utilities for Chart of Accounts data.
 * Follows the same pattern as entity-format.ts.
 */

import * as XLSX from 'xlsx';
import type { ChartOfAccount, CustomFieldDefinition } from '@newa-epm/shared';
import type { GridApi } from 'ag-grid-community';
import { detectFormat, FORMAT_LABELS, parseImportFile } from './entity-format';

export type ExportFormat = 'xlsx' | 'csv' | 'tsv' | 'pipe' | 'json' | 'xml';
export type ImportFormat = ExportFormat;
export { FORMAT_LABELS, detectFormat, parseImportFile };


const STANDARD_HEADERS = [
  'accountCode',
  'accountName',
  'accountType',
  'accountNature',
  'parentCode',
  'rollupWeight',
  'status',
  'statementType',
  'cashFlowCategory',
  'ifrsReference',
  'requiresIntercompanyRecon',
  'requiresOtherRecon',
];

// ─── Flatten / unflatten ──────────────────────────────────────────────────────

export function flattenCoa(
  account: ChartOfAccount,
  customFieldDefs: CustomFieldDefinition[],
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    accountCode: account.accountCode,
    accountName: account.accountName,
    accountType: account.accountType,
    accountNature: account.accountNature,
    parentCode: account.parentCode ?? '',
    rollupWeight: account.rollupWeight,
    status: account.status,
    statementType: account.statementType ?? '',
    cashFlowCategory: account.cashFlowCategory ?? '',
    ifrsReference: account.ifrsReference ?? '',
    requiresIntercompanyRecon: account.requiresIntercompanyRecon,
    requiresOtherRecon: account.requiresOtherRecon,
  };

  for (const def of customFieldDefs) {
    row[`customFields.${def.fieldKey}`] =
      (account.customFields as Record<string, unknown> | undefined | null)?.[def.fieldKey] ?? '';
  }

  return row;
}

export function buildCoaHeaders(
  rows: Record<string, unknown>[],
  customFieldDefs: CustomFieldDefinition[],
): string[] {
  const definedCfKeys = new Set(customFieldDefs.map((d) => `customFields.${d.fieldKey}`));
  const extraKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key.startsWith('customFields.') && !definedCfKeys.has(key)) {
        extraKeys.add(key);
      }
    }
  }
  return [...STANDARD_HEADERS, ...definedCfKeys, ...extraKeys];
}

/** Convert a flat import row back into a COA DTO shape. */
export function unflattenToCoaDto(
  row: Record<string, unknown>,
  customFieldDefs: CustomFieldDefinition[],
): Record<string, unknown> {
  const knownCfKeys = new Set(customFieldDefs.map((d) => d.fieldKey));
  const customFields: Record<string, unknown> = {};
  const result: Record<string, unknown> = {};

  const parseBool = (v: unknown): boolean =>
    v === true || v === 'true' || v === '1' || v === 'yes' || v === 'Yes';

  for (const [key, value] of Object.entries(row)) {
    if (STANDARD_HEADERS.includes(key)) {
      if (key === 'requiresIntercompanyRecon' || key === 'requiresOtherRecon') {
        result[key] = parseBool(value);
      } else if (key === 'rollupWeight') {
        const n = Number(value);
        result[key] = isNaN(n) ? 1 : n;
      } else if (key === 'parentCode' && (value === '' || value == null)) {
        // omit blank parentCode so backend treats it as null
      } else if (value !== '' && value != null) {
        result[key] = value;
      }
    } else if (key.startsWith('customFields.')) {
      customFields[key.slice('customFields.'.length)] = value;
    } else if (knownCfKeys.has(key)) {
      customFields[key] = value;
    }
  }

  if (Object.keys(customFields).length > 0) {
    result.customFields = customFields;
  }

  return result;
}

// ─── Read rows from the grid ──────────────────────────────────────────────────

export function readGridRowsCoa(
  gridApi: GridApi,
  customFieldDefs: CustomFieldDefinition[],
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  gridApi.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) {
      rows.push(flattenCoa(node.data as ChartOfAccount, customFieldDefs));
    }
  });
  return rows;
}

// ─── Export ───────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcelCoa(
  rows: Record<string, unknown>[],
  headers: string[],
  filename = 'chart-of-accounts.xlsx',
): void {
  const wsData = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const colWidths = headers.map((h) =>
    Math.max(h.length + 2, ...rows.map((r) => String(r[h] ?? '').length + 2), 10),
  );
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w, 40) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Chart of Accounts');
  XLSX.writeFile(wb, filename);
}

function exportDelimitedCoa(
  rows: Record<string, unknown>[],
  headers: string[],
  delimiter = ',',
  filename = 'chart-of-accounts.csv',
): void {
  const escape = (v: unknown): string => {
    const s = String(v ?? '');
    if (s.includes(delimiter) || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.map(escape).join(delimiter),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(delimiter)),
  ];
  triggerDownload(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), filename);
}

function exportJsonCoa(accounts: ChartOfAccount[], filename = 'chart-of-accounts.json'): void {
  triggerDownload(
    new Blob([JSON.stringify(accounts, null, 2)], { type: 'application/json' }),
    filename,
  );
}

function exportXmlCoa(
  rows: Record<string, unknown>[],
  headers: string[],
  filename = 'chart-of-accounts.xml',
): void {
  const sanitize = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const tagName = (key: string) =>
    key.startsWith('customFields.') ? `cf_${key.slice('customFields.'.length)}` : key;

  const nodes = rows.map((row) => {
    const cfLines: string[] = [];
    const stdLines: string[] = [];
    for (const h of headers) {
      const value = sanitize(String(row[h] ?? ''));
      const tag = tagName(h);
      if (h.startsWith('customFields.')) {
        cfLines.push(`      <${tag}>${value}</${tag}>`);
      } else {
        stdLines.push(`    <${h}>${value}</${h}>`);
      }
    }
    const cfBlock =
      cfLines.length > 0 ? `\n    <customFields>\n${cfLines.join('\n')}\n    </customFields>` : '';
    return `  <account>\n${stdLines.join('\n')}${cfBlock}\n  </account>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<chartOfAccounts>\n${nodes.join('\n')}\n</chartOfAccounts>`;
  triggerDownload(new Blob([xml], { type: 'application/xml' }), filename);
}

export function exportChartOfAccounts(
  format: ExportFormat,
  gridApi: GridApi,
  accounts: ChartOfAccount[],
  customFieldDefs: CustomFieldDefinition[],
): void {
  const rows = readGridRowsCoa(gridApi, customFieldDefs);
  const headers = buildCoaHeaders(rows, customFieldDefs);

  switch (format) {
    case 'xlsx':
      exportExcelCoa(rows, headers, 'chart-of-accounts.xlsx');
      break;
    case 'csv':
      exportDelimitedCoa(rows, headers, ',', 'chart-of-accounts.csv');
      break;
    case 'tsv':
      exportDelimitedCoa(rows, headers, '\t', 'chart-of-accounts.tsv');
      break;
    case 'pipe':
      exportDelimitedCoa(rows, headers, '|', 'chart-of-accounts-pipe.txt');
      break;
    case 'json':
      exportJsonCoa(accounts, 'chart-of-accounts.json');
      break;
    case 'xml':
      exportXmlCoa(rows, headers, 'chart-of-accounts.xml');
      break;
  }
}
