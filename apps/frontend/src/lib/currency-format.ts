/**
 * Export and import utilities for Currency and ExchangeRate data.
 * Follows the same pattern as coa-format.ts.
 */

import * as XLSX from 'xlsx';
import type { Currency, ExchangeRate } from '@newa-epm/shared';
import type { GridApi } from 'ag-grid-community';
import { detectFormat, FORMAT_LABELS, parseImportFile } from './entity-format';

export type ExportFormat = 'xlsx' | 'csv' | 'tsv' | 'pipe' | 'json' | 'xml';
export type ImportFormat = ExportFormat;
export { FORMAT_LABELS, detectFormat, parseImportFile };

const CURRENCY_HEADERS = ['code', 'name', 'active'];
const RATE_HEADERS = ['fromCurrency', 'toCurrency', 'rateDate', 'rate', 'rateType'];

// ─── Flatten ─────────────────────────────────────────────────────────────────

export function flattenCurrency(c: Currency): Record<string, unknown> {
  return { code: c.code, name: c.name, active: c.active };
}

export function flattenExchangeRate(r: ExchangeRate): Record<string, unknown> {
  return {
    fromCurrency: r.fromCurrency,
    toCurrency: r.toCurrency,
    rateDate: typeof r.rateDate === 'string' ? r.rateDate.slice(0, 10) : r.rateDate,
    rate: r.rate,
    rateType: r.rateType,
  };
}

// ─── Unflatten (import) ───────────────────────────────────────────────────────

export function unflattenToCurrencyDto(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (row.code) result.code = String(row.code).toUpperCase().slice(0, 3);
  if (row.name) result.name = row.name;
  return result;
}

export function unflattenToExchangeRateDto(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (row.fromCurrency) result.fromCurrency = String(row.fromCurrency).toUpperCase().slice(0, 3);
  if (row.toCurrency) result.toCurrency = String(row.toCurrency).toUpperCase().slice(0, 3);
  if (row.rateDate) result.rateDate = row.rateDate;
  if (row.rate != null) result.rate = Number(row.rate);
  if (row.rateType) result.rateType = row.rateType;
  return result;
}

// ─── Read rows from grid ──────────────────────────────────────────────────────

export function readCurrencyGridRows(gridApi: GridApi): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  gridApi.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) rows.push(flattenCurrency(node.data as Currency));
  });
  return rows;
}

export function readExchangeRateGridRows(gridApi: GridApi): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  gridApi.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) rows.push(flattenExchangeRate(node.data as ExchangeRate));
  });
  return rows;
}

// ─── Shared export helpers ────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(rows: Record<string, unknown>[], headers: string[], filename: string): void {
  const wsData = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = headers.map((h) =>
    ({ wch: Math.min(Math.max(h.length + 2, ...rows.map((r) => String(r[h] ?? '').length + 2), 10), 40) }),
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
}

function exportDelimited(
  rows: Record<string, unknown>[],
  headers: string[],
  delimiter: string,
  filename: string,
): void {
  const escape = (v: unknown): string => {
    const s = String(v ?? '');
    return s.includes(delimiter) || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.map(escape).join(delimiter),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(delimiter)),
  ];
  triggerDownload(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), filename);
}

function exportJson(data: unknown[], filename: string): void {
  triggerDownload(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    filename,
  );
}

function exportXml(rows: Record<string, unknown>[], headers: string[], rootTag: string, itemTag: string, filename: string): void {
  const sanitize = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nodes = rows.map(
    (row) =>
      `  <${itemTag}>\n${headers.map((h) => `    <${h}>${sanitize(String(row[h] ?? ''))}</${h}>`).join('\n')}\n  </${itemTag}>`,
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>\n${nodes.join('\n')}\n</${rootTag}>`;
  triggerDownload(new Blob([xml], { type: 'application/xml' }), filename);
}

// ─── Currency export ──────────────────────────────────────────────────────────

export function exportCurrencies(
  format: ExportFormat,
  gridApi: GridApi,
  currencies: Currency[],
): void {
  const rows = readCurrencyGridRows(gridApi);
  switch (format) {
    case 'xlsx': exportExcel(rows, CURRENCY_HEADERS, 'currencies.xlsx'); break;
    case 'csv': exportDelimited(rows, CURRENCY_HEADERS, ',', 'currencies.csv'); break;
    case 'tsv': exportDelimited(rows, CURRENCY_HEADERS, '\t', 'currencies.tsv'); break;
    case 'pipe': exportDelimited(rows, CURRENCY_HEADERS, '|', 'currencies-pipe.txt'); break;
    case 'json': exportJson(currencies, 'currencies.json'); break;
    case 'xml': exportXml(rows, CURRENCY_HEADERS, 'currencies', 'currency', 'currencies.xml'); break;
  }
}

// ─── Exchange rate export ─────────────────────────────────────────────────────

export function exportExchangeRates(
  format: ExportFormat,
  gridApi: GridApi,
  rates: ExchangeRate[],
): void {
  const rows = readExchangeRateGridRows(gridApi);
  switch (format) {
    case 'xlsx': exportExcel(rows, RATE_HEADERS, 'exchange-rates.xlsx'); break;
    case 'csv': exportDelimited(rows, RATE_HEADERS, ',', 'exchange-rates.csv'); break;
    case 'tsv': exportDelimited(rows, RATE_HEADERS, '\t', 'exchange-rates.tsv'); break;
    case 'pipe': exportDelimited(rows, RATE_HEADERS, '|', 'exchange-rates-pipe.txt'); break;
    case 'json': exportJson(rates, 'exchange-rates.json'); break;
    case 'xml': exportXml(rows, RATE_HEADERS, 'exchangeRates', 'rate', 'exchange-rates.xml'); break;
  }
}
