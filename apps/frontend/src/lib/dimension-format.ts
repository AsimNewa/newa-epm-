/**
 * Export and import utilities for Dimension (definition) data.
 * Follows the same pattern as entity-format.ts.
 */

import * as XLSX from 'xlsx';
import type { CustomFieldDefinition, Dimension } from '@newa-epm/shared';
import type { GridApi } from 'ag-grid-community';
import { detectFormat, FORMAT_LABELS, parseImportFile } from './entity-format';

export type ExportFormat = 'xlsx' | 'csv' | 'tsv' | 'pipe' | 'json' | 'xml';
export type ImportFormat = ExportFormat;
export { FORMAT_LABELS, detectFormat, parseImportFile };

const STANDARD_HEADERS = ['name', 'type', 'status'];

// ─── Flatten / unflatten ──────────────────────────────────────────────────────

export function flattenDimension(
  dimension: Dimension,
  customFieldDefs: CustomFieldDefinition[],
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    name: dimension.name,
    type: dimension.type,
    status: dimension.status,
  };

  for (const def of customFieldDefs) {
    row[`customFields.${def.fieldKey}`] =
      (dimension.customFields as Record<string, unknown> | undefined | null)?.[def.fieldKey] ?? '';
  }

  return row;
}

export function buildDimensionHeaders(
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

/** Convert a flat import row back into a Dimension DTO shape. */
export function unflattenToDimensionDto(
  row: Record<string, unknown>,
  customFieldDefs: CustomFieldDefinition[],
): Record<string, unknown> {
  const knownCfKeys = new Set(customFieldDefs.map((d) => d.fieldKey));
  const customFields: Record<string, unknown> = {};
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (STANDARD_HEADERS.includes(key)) {
      if (value !== '' && value != null) {
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

export function readGridRowsDimension(
  gridApi: GridApi,
  customFieldDefs: CustomFieldDefinition[],
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  gridApi.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) {
      rows.push(flattenDimension(node.data as Dimension, customFieldDefs));
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

function exportExcelDimensions(
  rows: Record<string, unknown>[],
  headers: string[],
  filename = 'dimensions.xlsx',
): void {
  const wsData = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const colWidths = headers.map((h) =>
    Math.max(h.length + 2, ...rows.map((r) => String(r[h] ?? '').length + 2), 10),
  );
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w, 40) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dimensions');
  XLSX.writeFile(wb, filename);
}

function exportDelimitedDimensions(
  rows: Record<string, unknown>[],
  headers: string[],
  delimiter = ',',
  filename = 'dimensions.csv',
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

function exportJsonDimensions(dimensions: Dimension[], filename = 'dimensions.json'): void {
  triggerDownload(
    new Blob([JSON.stringify(dimensions, null, 2)], { type: 'application/json' }),
    filename,
  );
}

function exportXmlDimensions(
  rows: Record<string, unknown>[],
  headers: string[],
  filename = 'dimensions.xml',
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
    return `  <dimension>\n${stdLines.join('\n')}${cfBlock}\n  </dimension>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<dimensions>\n${nodes.join('\n')}\n</dimensions>`;
  triggerDownload(new Blob([xml], { type: 'application/xml' }), filename);
}

export function exportDimensions(
  format: ExportFormat,
  gridApi: GridApi,
  dimensions: Dimension[],
  customFieldDefs: CustomFieldDefinition[],
): void {
  const rows = readGridRowsDimension(gridApi, customFieldDefs);
  const headers = buildDimensionHeaders(rows, customFieldDefs);

  switch (format) {
    case 'xlsx':
      exportExcelDimensions(rows, headers, 'dimensions.xlsx');
      break;
    case 'csv':
      exportDelimitedDimensions(rows, headers, ',', 'dimensions.csv');
      break;
    case 'tsv':
      exportDelimitedDimensions(rows, headers, '\t', 'dimensions.tsv');
      break;
    case 'pipe':
      exportDelimitedDimensions(rows, headers, '|', 'dimensions-pipe.txt');
      break;
    case 'json':
      exportJsonDimensions(dimensions, 'dimensions.json');
      break;
    case 'xml':
      exportXmlDimensions(rows, headers, 'dimensions.xml');
      break;
  }
}
