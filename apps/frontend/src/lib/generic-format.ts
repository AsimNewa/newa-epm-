/**
 * Generic multi-format export/import engine, shared by pages whose data is a flat list with no
 * nested customFields (Rate Types, Roles, Periods, Custom Field Definitions). Reuses the same
 * parsing engine as entity-format.ts / coa-format.ts, so behavior stays consistent with the
 * Entities / Chart of Accounts / Currencies / Dimensions pages — only the row shape differs,
 * supplied per-page via a small `toRow`/`fromRow` pair instead of a whole new format file.
 */

import * as XLSX from 'xlsx';
import type { GridApi } from 'ag-grid-community';
import { detectFormat, FORMAT_LABELS, parseImportFile } from './entity-format';

export type ExportFormat = 'xlsx' | 'csv' | 'tsv' | 'pipe' | 'json' | 'xml';
export type ImportFormat = ExportFormat;
export { FORMAT_LABELS, detectFormat, parseImportFile };

export interface GenericFormatConfig {
  headers: string[];
  filenameBase: string; // e.g. "rate-types"
  sheetName: string; // e.g. "Rate Types"
  itemTag: string; // xml element per row, e.g. "rateType"
  rootTag: string; // xml wrapper element, e.g. "rateTypes"
}

// ─── Read rows from the grid ──────────────────────────────────────────────────

export function readGridRowsGeneric<T>(
  gridApi: GridApi,
  toRow: (item: T) => Record<string, unknown>,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  gridApi.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) {
      rows.push(toRow(node.data as T));
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

function exportExcelGeneric(
  rows: Record<string, unknown>[],
  headers: string[],
  sheetName: string,
  filename: string,
): void {
  const wsData = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const colWidths = headers.map((h) =>
    Math.max(h.length + 2, ...rows.map((r) => String(r[h] ?? '').length + 2), 10),
  );
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w, 40) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

function exportDelimitedGeneric(
  rows: Record<string, unknown>[],
  headers: string[],
  delimiter: string,
  filename: string,
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

function exportJsonGeneric(rawItems: unknown[], filename: string): void {
  triggerDownload(new Blob([JSON.stringify(rawItems, null, 2)], { type: 'application/json' }), filename);
}

function exportXmlGeneric(
  rows: Record<string, unknown>[],
  headers: string[],
  itemTag: string,
  rootTag: string,
  filename: string,
): void {
  const sanitize = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const nodes = rows.map((row) => {
    const lines = headers.map((h) => `    <${h}>${sanitize(String(row[h] ?? ''))}</${h}>`);
    return `  <${itemTag}>\n${lines.join('\n')}\n  </${itemTag}>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>\n${nodes.join('\n')}\n</${rootTag}>`;
  triggerDownload(new Blob([xml], { type: 'application/xml' }), filename);
}

export function exportGeneric<T>(
  format: ExportFormat,
  gridApi: GridApi,
  rawItems: T[],
  toRow: (item: T) => Record<string, unknown>,
  config: GenericFormatConfig,
): void {
  const rows = readGridRowsGeneric(gridApi, toRow);
  const { headers, filenameBase, sheetName, itemTag, rootTag } = config;

  switch (format) {
    case 'xlsx':
      exportExcelGeneric(rows, headers, sheetName, `${filenameBase}.xlsx`);
      break;
    case 'csv':
      exportDelimitedGeneric(rows, headers, ',', `${filenameBase}.csv`);
      break;
    case 'tsv':
      exportDelimitedGeneric(rows, headers, '\t', `${filenameBase}.tsv`);
      break;
    case 'pipe':
      exportDelimitedGeneric(rows, headers, '|', `${filenameBase}-pipe.txt`);
      break;
    case 'json':
      exportJsonGeneric(rawItems, `${filenameBase}.json`);
      break;
    case 'xml':
      exportXmlGeneric(rows, headers, itemTag, rootTag, `${filenameBase}.xml`);
      break;
  }
}
