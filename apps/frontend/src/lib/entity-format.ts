/**
 * Utilities for exporting and importing entity data in multiple formats.
 * Handles flattening/unflattening the customFields JSON blob so every
 * custom field becomes its own column (e.g. "customFields.industry").
 */

import * as XLSX from 'xlsx';
import type { CustomFieldDefinition, Entity } from '@newa-epm/shared';
import type { GridApi } from 'ag-grid-community';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportFormat = 'xlsx' | 'csv' | 'tsv' | 'pipe' | 'json' | 'xml';
export type ImportFormat = ExportFormat;

const DELIMITER_MAP: Record<ExportFormat, string | null> = {
  xlsx: null,
  csv: ',',
  tsv: '\t',
  pipe: '|',
  json: null,
  xml: null,
};

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  xlsx: 'Excel (.xlsx)',
  csv: 'CSV (.csv)',
  tsv: 'Tab-delimited (.tsv)',
  pipe: 'Pipe-delimited (.txt)',
  json: 'JSON (.json)',
  xml: 'XML (.xml)',
};

// ─── Standard entity column headers ──────────────────────────────────────────

const STANDARD_HEADERS = ['code', 'name', 'country', 'currency', 'status'];

// ─── Flatten / unflatten helpers ─────────────────────────────────────────────

/** Convert an Entity row into a flat key/value object for spreadsheet export. */
export function flattenEntity(
  entity: Entity,
  customFieldDefs: CustomFieldDefinition[],
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    code: entity.code,
    name: entity.name,
    country: entity.country ?? '',
    currency: entity.currency,
    status: entity.status,
  };

  for (const def of customFieldDefs) {
    row[`customFields.${def.fieldKey}`] =
      (entity.customFields as Record<string, unknown> | undefined | null)?.[def.fieldKey] ?? '';
  }

  return row;
}

/**
 * Build headers for the export: standard fields + one column per custom field.
 * Also collects any ad-hoc custom-field keys present in the data that have no definition.
 */
export function buildHeaders(
  rows: Record<string, unknown>[],
  customFieldDefs: CustomFieldDefinition[],
): string[] {
  const definedCfKeys = new Set(customFieldDefs.map((d) => `customFields.${d.fieldKey}`));

  // Collect any extra custom-field keys found in actual row data but not yet defined
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

/**
 * Convert a flat exported row (with "customFields.key" columns) back into a
 * shape suitable for the Create/Update Entity DTO.
 * Also handles columns that match known custom-field keys without the prefix.
 */
export function unflattenToEntityDto(
  row: Record<string, unknown>,
  customFieldDefs: CustomFieldDefinition[],
): Record<string, unknown> {
  const knownCfKeys = new Set(customFieldDefs.map((d) => d.fieldKey));
  const customFields: Record<string, unknown> = {};
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (STANDARD_HEADERS.includes(key)) {
      result[key] = value;
    } else if (key.startsWith('customFields.')) {
      customFields[key.slice('customFields.'.length)] = value;
    } else if (knownCfKeys.has(key)) {
      // Column name matches a custom-field key directly (without prefix)
      customFields[key] = value;
    }
  }

  if (Object.keys(customFields).length > 0) {
    result.customFields = customFields;
  }

  return result;
}

// ─── Read rows from the grid (respects filters / sort) ───────────────────────

export function readGridRows(
  gridApi: GridApi,
  customFieldDefs: CustomFieldDefinition[],
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  gridApi.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) {
      rows.push(flattenEntity(node.data as Entity, customFieldDefs));
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

/** Export to Excel (.xlsx) via SheetJS — includes all custom field columns. */
export function exportExcel(
  rows: Record<string, unknown>[],
  headers: string[],
  filename = 'entities.xlsx',
): void {
  const wsData = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-width columns
  const colWidths = headers.map((h) =>
    Math.max(h.length + 2, ...rows.map((r) => String(r[h] ?? '').length + 2), 10),
  );
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w, 40) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Entities');
  XLSX.writeFile(wb, filename);
}

/** Export to CSV / TSV / pipe-delimited. */
export function exportDelimited(
  rows: Record<string, unknown>[],
  headers: string[],
  delimiter = ',',
  filename = 'entities.csv',
): void {
  const escape = (v: unknown): string => {
    const s = String(v ?? '');
    // Quote if contains delimiter, quotes, or newlines
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

/** Export to JSON (structured: preserves nested customFields). */
export function exportJSON(entities: Entity[], filename = 'entities.json'): void {
  const json = JSON.stringify(entities, null, 2);
  triggerDownload(new Blob([json], { type: 'application/json' }), filename);
}

/** Export to XML. */
export function exportXML(
  rows: Record<string, unknown>[],
  headers: string[],
  filename = 'entities.xml',
): void {
  const sanitize = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const tagName = (key: string) =>
    key.startsWith('customFields.')
      ? `cf_${key.slice('customFields.'.length)}`
      : key;

  const entityNodes = rows.map((row) => {
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
      cfLines.length > 0
        ? `\n    <customFields>\n${cfLines.join('\n')}\n    </customFields>`
        : '';

    return `  <entity>\n${stdLines.join('\n')}${cfBlock}\n  </entity>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<entities>\n${entityNodes.join('\n')}\n</entities>`;
  triggerDownload(new Blob([xml], { type: 'application/xml' }), filename);
}

/** Route to the correct exporter based on format. */
export function exportEntities(
  format: ExportFormat,
  gridApi: GridApi,
  entities: Entity[],
  customFieldDefs: CustomFieldDefinition[],
): void {
  const rows = readGridRows(gridApi, customFieldDefs);
  const headers = buildHeaders(rows, customFieldDefs);

  switch (format) {
    case 'xlsx':
      exportExcel(rows, headers, 'entities.xlsx');
      break;
    case 'csv':
      exportDelimited(rows, headers, ',', 'entities.csv');
      break;
    case 'tsv':
      exportDelimited(rows, headers, '\t', 'entities.tsv');
      break;
    case 'pipe':
      exportDelimited(rows, headers, '|', 'entities-pipe.txt');
      break;
    case 'json':
      exportJSON(entities, 'entities.json');
      break;
    case 'xml':
      exportXML(rows, headers, 'entities.xml');
      break;
  }
}

// ─── Import ───────────────────────────────────────────────────────────────────

/** Detect the format of an uploaded file from its extension. */
export function detectFormat(filename: string): ImportFormat {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'tsv') return 'tsv';
  if (ext === 'json') return 'json';
  if (ext === 'xml') return 'xml';
  return 'csv'; // .csv, .txt, .pipe, default
}

/** Read an uploaded file as text or ArrayBuffer. */
function readFileAs(file: File, as: 'text' | 'binary'): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as string | ArrayBuffer);
    reader.onerror = reject;
    if (as === 'text') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse an uploaded file into an array of flat row objects.
 * Supports xlsx, csv, tsv, pipe-delimited, json, and xml.
 * Returns { rows, detectedHeaders } for preview.
 */
export async function parseImportFile(
  file: File,
  options: { format?: ImportFormat; delimiter?: string } = {},
): Promise<{ rows: Record<string, unknown>[]; headers: string[] }> {
  const format = options.format ?? detectFormat(file.name);

  // ── Excel (.xlsx / .xls) ──────────────────────────────────────────────────
  if (format === 'xlsx') {
    const buffer = (await readFileAs(file, 'binary')) as ArrayBuffer;
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: '',
      raw: false,
    });
    const headers = raw.length > 0 ? Object.keys(raw[0]) : [];
    return { rows: raw, headers };
  }

  // ── JSON ──────────────────────────────────────────────────────────────────
  if (format === 'json') {
    const text = (await readFileAs(file, 'text')) as string;
    const parsed = JSON.parse(text) as unknown;
    const arr = (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[];
    // Flatten nested customFields if present
    const flat = arr.map((row) => {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'customFields' && typeof v === 'object' && v !== null) {
          for (const [ck, cv] of Object.entries(v as Record<string, unknown>)) {
            result[`customFields.${ck}`] = cv;
          }
        } else {
          result[k] = v;
        }
      }
      return result;
    });
    const headers = flat.length > 0 ? Object.keys(flat[0]) : [];
    return { rows: flat, headers };
  }

  // ── XML ───────────────────────────────────────────────────────────────────
  if (format === 'xml') {
    const text = (await readFileAs(file, 'text')) as string;
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    const entityNodes = Array.from(doc.querySelectorAll('entity'));

    const rows = entityNodes.map((el) => {
      const row: Record<string, unknown> = {};
      for (const child of Array.from(el.children)) {
        if (child.tagName === 'customFields') {
          for (const cf of Array.from(child.children)) {
            // Convert cf_fieldKey or fieldKey back to customFields.fieldKey
            const key = cf.tagName.startsWith('cf_')
              ? `customFields.${cf.tagName.slice(3)}`
              : `customFields.${cf.tagName}`;
            row[key] = cf.textContent ?? '';
          }
        } else {
          row[child.tagName] = child.textContent ?? '';
        }
      }
      return row;
    });

    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, headers };
  }

  // ── CSV / TSV / Pipe-delimited ─────────────────────────────────────────────
  {
    const delimiter =
      options.delimiter ??
      DELIMITER_MAP[format] ??
      (format === 'tsv' ? '\t' : format === 'pipe' ? '|' : ',');

    const text = (await readFileAs(file, 'text')) as string;
    // Use SheetJS for robust CSV parsing (handles quoted fields correctly)
    const wb = XLSX.read(text, { type: 'string', FS: delimiter });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: '',
      raw: false,
    });
    const headers = raw.length > 0 ? Object.keys(raw[0]) : [];
    return { rows: raw, headers };
  }
}
