/**
 * Export and import utilities for Consolidation Group data.
 * Follows the same pattern as entity-format.ts (customFields flatten to "customFields.key" columns).
 */

import * as XLSX from 'xlsx';
import type { ConsolidationGroup, CustomFieldDefinition, OwnershipStructureEntry } from '@newa-epm/shared';
import type { GridApi } from 'ag-grid-community';
import { detectFormat, FORMAT_LABELS, parseImportFile } from './entity-format';

export type ExportFormat = 'xlsx' | 'csv' | 'tsv' | 'pipe' | 'json' | 'xml';
export type ImportFormat = ExportFormat;
export { FORMAT_LABELS, detectFormat, parseImportFile };

const STANDARD_HEADERS = ['code', 'name', 'reportingCurrency', 'status'];

const STRUCTURE_HEADERS = [
  'subsidiaryEntityCode',
  'parentEntityCode',
  'consolidationMethod',
  'directPercentage',
  'effectivePercentage',
  'nciPercentage',
  'effectiveFromPeriod',
  'effectiveToPeriod',
  'acquisitionCost',
  'acquisitionDate',
];

// ─── Flatten / unflatten ──────────────────────────────────────────────────────

export function flattenGroup(
  group: ConsolidationGroup,
  customFieldDefs: CustomFieldDefinition[],
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    code: group.code,
    name: group.name,
    reportingCurrency: group.reportingCurrency ?? '',
    status: group.status,
  };

  for (const def of customFieldDefs) {
    row[`customFields.${def.fieldKey}`] =
      (group.customFields as Record<string, unknown> | undefined | null)?.[def.fieldKey] ?? '';
  }

  return row;
}

export function buildGroupHeaders(
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

/** Convert a flat import row back into a ConsolidationGroup DTO shape. */
export function unflattenToGroupDto(
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

export function readGridRowsGroup(
  gridApi: GridApi,
  customFieldDefs: CustomFieldDefinition[],
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  gridApi.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) {
      rows.push(flattenGroup(node.data as ConsolidationGroup, customFieldDefs));
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

function exportExcelGroups(rows: Record<string, unknown>[], headers: string[], filename = 'consolidation-groups.xlsx'): void {
  const wsData = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const colWidths = headers.map((h) =>
    Math.max(h.length + 2, ...rows.map((r) => String(r[h] ?? '').length + 2), 10),
  );
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w, 40) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Consolidation Groups');
  XLSX.writeFile(wb, filename);
}

function exportDelimitedGroups(
  rows: Record<string, unknown>[],
  headers: string[],
  delimiter = ',',
  filename = 'consolidation-groups.csv',
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

function exportJsonGroups(groups: ConsolidationGroup[], filename = 'consolidation-groups.json'): void {
  triggerDownload(new Blob([JSON.stringify(groups, null, 2)], { type: 'application/json' }), filename);
}

function exportXmlGroups(rows: Record<string, unknown>[], headers: string[], filename = 'consolidation-groups.xml'): void {
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
    return `  <group>\n${stdLines.join('\n')}${cfBlock}\n  </group>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<consolidationGroups>\n${nodes.join('\n')}\n</consolidationGroups>`;
  triggerDownload(new Blob([xml], { type: 'application/xml' }), filename);
}

export function exportConsolidationGroups(
  format: ExportFormat,
  gridApi: GridApi,
  groups: ConsolidationGroup[],
  customFieldDefs: CustomFieldDefinition[],
): void {
  const rows = readGridRowsGroup(gridApi, customFieldDefs);
  const headers = buildGroupHeaders(rows, customFieldDefs);

  switch (format) {
    case 'xlsx':
      exportExcelGroups(rows, headers);
      break;
    case 'csv':
      exportDelimitedGroups(rows, headers, ',', 'consolidation-groups.csv');
      break;
    case 'tsv':
      exportDelimitedGroups(rows, headers, '\t', 'consolidation-groups.tsv');
      break;
    case 'pipe':
      exportDelimitedGroups(rows, headers, '|', 'consolidation-groups-pipe.txt');
      break;
    case 'json':
      exportJsonGroups(groups);
      break;
    case 'xml':
      exportXmlGroups(rows, headers);
      break;
  }
}

// ─── Ownership Structure (combined OwnershipPeriod + GroupEntity entries) ────

/**
 * Flattens to entity/period business CODES (not raw ids) so exported files are human-editable
 * and re-importable — mirrors the parentCode convention used by Chart of Accounts/Dimensions.
 */
export function flattenOwnershipStructureEntry(entry: OwnershipStructureEntry): Record<string, unknown> {
  return {
    subsidiaryEntityCode: entry.subsidiaryEntity?.code ?? entry.subsidiaryEntityId,
    parentEntityCode: entry.parentEntity?.code ?? entry.parentEntityId,
    consolidationMethod: entry.consolidationMethod,
    directPercentage: entry.directPercentage,
    effectivePercentage: entry.effectivePercentage ?? '',
    nciPercentage: entry.nciPercentage ?? '',
    effectiveFromPeriod: entry.effectiveFromPeriod?.period ?? entry.effectiveFromPeriodId,
    effectiveToPeriod: entry.effectiveToPeriod?.period ?? '',
    acquisitionCost: entry.acquisitionCost ?? '',
    acquisitionDate: entry.acquisitionDate ?? '',
  };
}

export function buildOwnershipStructureHeaders(rows: Record<string, unknown>[]): string[] {
  const extraKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!STRUCTURE_HEADERS.includes(key)) extraKeys.add(key);
    }
  }
  return [...STRUCTURE_HEADERS, ...extraKeys];
}

/** Convert a flat import row back into an ImportOwnershipStructureRowDto shape. */
export function unflattenToOwnershipStructureDto(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of STRUCTURE_HEADERS) {
    const value = row[key];
    if (value !== '' && value != null) {
      result[key] = value;
    }
  }
  return result;
}

export function readGridRowsOwnershipStructure(gridApi: GridApi): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  gridApi.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) {
      rows.push(flattenOwnershipStructureEntry(node.data as OwnershipStructureEntry));
    }
  });
  return rows;
}

function exportExcelStructure(
  rows: Record<string, unknown>[],
  headers: string[],
  filename = 'ownership-structure.xlsx',
): void {
  const wsData = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const colWidths = headers.map((h) =>
    Math.max(h.length + 2, ...rows.map((r) => String(r[h] ?? '').length + 2), 10),
  );
  ws['!cols'] = colWidths.map((w) => ({ wch: Math.min(w, 40) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ownership Structure');
  XLSX.writeFile(wb, filename);
}

function exportDelimitedStructure(
  rows: Record<string, unknown>[],
  headers: string[],
  delimiter = ',',
  filename = 'ownership-structure.csv',
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

function exportJsonStructure(entries: OwnershipStructureEntry[], filename = 'ownership-structure.json'): void {
  triggerDownload(new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' }), filename);
}

function exportXmlStructure(
  rows: Record<string, unknown>[],
  headers: string[],
  filename = 'ownership-structure.xml',
): void {
  const sanitize = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const nodes = rows.map((row) => {
    const lines = headers.map((h) => `    <${h}>${sanitize(String(row[h] ?? ''))}</${h}>`);
    return `  <entry>\n${lines.join('\n')}\n  </entry>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ownershipStructure>\n${nodes.join('\n')}\n</ownershipStructure>`;
  triggerDownload(new Blob([xml], { type: 'application/xml' }), filename);
}

export function exportOwnershipStructure(
  format: ExportFormat,
  gridApi: GridApi,
  entries: OwnershipStructureEntry[],
): void {
  const rows = readGridRowsOwnershipStructure(gridApi);
  const headers = buildOwnershipStructureHeaders(rows);

  switch (format) {
    case 'xlsx':
      exportExcelStructure(rows, headers);
      break;
    case 'csv':
      exportDelimitedStructure(rows, headers, ',', 'ownership-structure.csv');
      break;
    case 'tsv':
      exportDelimitedStructure(rows, headers, '\t', 'ownership-structure.tsv');
      break;
    case 'pipe':
      exportDelimitedStructure(rows, headers, '|', 'ownership-structure-pipe.txt');
      break;
    case 'json':
      exportJsonStructure(entries);
      break;
    case 'xml':
      exportXmlStructure(rows, headers);
      break;
  }
}
