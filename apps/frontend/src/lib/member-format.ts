/**
 * Export and import utilities for Dimension Member data.
 * Follows the same pattern as coa-format.ts (parentCode is code-based, mirrors ChartOfAccount).
 *
 * Every row carries a "dimension" column (the owning Dimension's name) so a single file can be
 * identified as belonging to (or, on import, routed to) Cost Center / Department / Project etc.
 */

import * as XLSX from 'xlsx';
import type { DimensionMember } from '@newa-epm/shared';
import type { GridApi } from 'ag-grid-community';
import { detectFormat, FORMAT_LABELS, parseImportFile } from './entity-format';

export type ExportFormat = 'xlsx' | 'csv' | 'tsv' | 'pipe' | 'json' | 'xml';
export type ImportFormat = ExportFormat;
export { FORMAT_LABELS, detectFormat, parseImportFile };

const STANDARD_HEADERS = ['dimension', 'code', 'name', 'parentCode', 'weight', 'status'];

/** Turn a dimension name into a filesystem-safe filename fragment, e.g. "Cost Center" -> "cost-center". */
export function slugifyDimensionName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'dimension'
  );
}

// ─── Flatten / unflatten ──────────────────────────────────────────────────────

export function flattenMember(member: DimensionMember, dimensionLabel: string): Record<string, unknown> {
  return {
    dimension: dimensionLabel,
    code: member.code,
    name: member.name,
    parentCode: member.parentCode ?? '',
    weight: member.weight,
    status: member.status,
  };
}

export function buildMemberHeaders(): string[] {
  return STANDARD_HEADERS;
}

/** Convert a flat import row back into a DimensionMember import DTO shape (dimension + code + name + ...). */
export function unflattenToMemberDto(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (!STANDARD_HEADERS.includes(key)) continue;

    if (key === 'weight') {
      const n = Number(value);
      result.weight = isNaN(n) ? 1 : n;
    } else if (key === 'parentCode' && (value === '' || value == null)) {
      // omit blank parentCode so backend treats it as a root member
    } else if (value !== '' && value != null) {
      result[key] = value;
    }
  }

  return result;
}

// ─── Read rows from the grid ──────────────────────────────────────────────────

export function readGridRowsMember(gridApi: GridApi, dimensionLabel: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  gridApi.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) {
      rows.push(flattenMember(node.data as DimensionMember, dimensionLabel));
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

function exportExcelMembers(rows: Record<string, unknown>[], headers: string[], filename: string): void {
  const wsData = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const colWidths = headers.map((h) =>
    Math.max(h.length + 2, ...rows.map((r) => String(r[h] ?? '').length + 2), 10),
  );
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w, 40) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  XLSX.writeFile(wb, filename);
}

function exportDelimitedMembers(
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

function exportJsonMembers(members: DimensionMember[], dimensionLabel: string, filename: string): void {
  const withDimension = members.map((m) => ({ dimension: dimensionLabel, ...m }));
  triggerDownload(
    new Blob([JSON.stringify(withDimension, null, 2)], { type: 'application/json' }),
    filename,
  );
}

function exportXmlMembers(rows: Record<string, unknown>[], headers: string[], filename: string): void {
  const sanitize = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const nodes = rows.map((row) => {
    const lines = headers.map((h) => `    <${h}>${sanitize(String(row[h] ?? ''))}</${h}>`);
    return `  <member>\n${lines.join('\n')}\n  </member>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<members>\n${nodes.join('\n')}\n</members>`;
  triggerDownload(new Blob([xml], { type: 'application/xml' }), filename);
}

export function exportDimensionMembers(
  format: ExportFormat,
  gridApi: GridApi,
  members: DimensionMember[],
  dimensionLabel: string,
): void {
  const rows = readGridRowsMember(gridApi, dimensionLabel);
  const headers = buildMemberHeaders();
  const base = `${slugifyDimensionName(dimensionLabel)}-members`;

  switch (format) {
    case 'xlsx':
      exportExcelMembers(rows, headers, `${base}.xlsx`);
      break;
    case 'csv':
      exportDelimitedMembers(rows, headers, ',', `${base}.csv`);
      break;
    case 'tsv':
      exportDelimitedMembers(rows, headers, '\t', `${base}.tsv`);
      break;
    case 'pipe':
      exportDelimitedMembers(rows, headers, '|', `${base}-pipe.txt`);
      break;
    case 'json':
      exportJsonMembers(members, dimensionLabel, `${base}.json`);
      break;
    case 'xml':
      exportXmlMembers(rows, headers, `${base}.xml`);
      break;
  }
}
