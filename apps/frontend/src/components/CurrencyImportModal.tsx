import { useRef, useState } from 'react';
import type { ImportFormat } from '../lib/currency-format';
import { FORMAT_LABELS, detectFormat, parseImportFile, unflattenToCurrencyDto } from '../lib/currency-format';
import type { ImportResult } from '@newa-epm/shared';

const ALL_FORMATS: ImportFormat[] = ['xlsx', 'csv', 'tsv', 'pipe', 'json', 'xml'];
const ACCEPT = '.xlsx,.xls,.csv,.tsv,.txt,.json,.xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DELIMITER_OPTIONS = [
  { label: 'Comma (,)', value: ',' },
  { label: 'Tab (↹)', value: '\t' },
  { label: 'Pipe (|)', value: '|' },
  { label: 'Semicolon (;)', value: ';' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (rows: Record<string, unknown>[]) => Promise<ImportResult>;
}

export function CurrencyImportModal({ open, onClose, onImport }: Props): JSX.Element | null {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImportFormat>('csv');
  const [delimiter, setDelimiter] = useState(',');
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = async (f: File | undefined) => {
    setResult(null); setParseError(null); setParsedRows([]); setPreview([]); setHeaders([]);
    if (!f) return;
    setFile(f);
    const detected = detectFormat(f.name);
    setFormat(detected);
    try {
      const { rows, headers: hdrs } = await parseImportFile(f, { format: detected, delimiter: detected === 'csv' ? delimiter : undefined });
      setParsedRows(rows); setPreview(rows.slice(0, 5)); setHeaders(hdrs);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  };

  const handleReparse = async () => {
    if (!file) return;
    setParseError(null);
    try {
      const { rows, headers: hdrs } = await parseImportFile(file, { format, delimiter });
      setParsedRows(rows); setPreview(rows.slice(0, 5)); setHeaders(hdrs);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  };

  const handleImport = async () => {
    if (!parsedRows.length) return;
    setIsImporting(true); setResult(null);
    try {
      const r = await onImport(parsedRows.map(unflattenToCurrencyDto));
      setResult(r);
    } finally { setIsImporting(false); }
  };

  const handleClose = () => {
    setFile(null); setParsedRows([]); setPreview([]); setHeaders([]);
    setResult(null); setParseError(null);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Import Currencies</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={handleClose}>✕</button>
        </div>

        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <strong>Columns:</strong> code (3-letter ISO), name
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Format</label>
            <select className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={format} onChange={(e) => setFormat(e.target.value as ImportFormat)}>
              {ALL_FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
            </select>
          </div>
          {(format === 'csv' || format === 'tsv' || format === 'pipe') && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Delimiter</label>
              <select className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={delimiter} onChange={(e) => setDelimiter(e.target.value)}>
                {DELIMITER_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-col justify-end">
            {file && !result && (
              <button className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50" onClick={handleReparse}>Re-parse</button>
            )}
          </div>
        </div>

        <input ref={fileRef} type="file" accept={ACCEPT} className="text-sm" onChange={(e) => handleFileChange(e.target.files?.[0])} />

        {parseError && <div className="rounded bg-red-50 p-3 text-sm text-red-700">⚠ {parseError}</div>}

        {preview.length > 0 && (
          <div className="overflow-x-auto">
            <p className="mb-1 text-xs text-slate-500">Preview: {preview.length} of {parsedRows.length} rows · {headers.length} columns</p>
            <table className="w-full border-collapse text-xs">
              <thead><tr>{headers.map((h) => <th key={h} className="border border-slate-200 bg-slate-100 px-2 py-1 text-left text-slate-700">{h}</th>)}</tr></thead>
              <tbody>{preview.map((row, i) => <tr key={i}>{headers.map((h) => <td key={h} className="border border-slate-200 px-2 py-1 text-slate-700">{String(row[h] ?? '')}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}

        {result && (
          <div className={`rounded p-3 text-sm ${result.errors.length === 0 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
            <strong>✅ {result.created} currencies imported</strong>
            {result.errors.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs">
                {result.errors.slice(0, 10).map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-400">{parsedRows.length > 0 && !result && `${parsedRows.length} rows ready`}</span>
          <div className="flex gap-2">
            <button className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" onClick={handleClose}>{result ? 'Close' : 'Cancel'}</button>
            {!result && (
              <button disabled={!parsedRows.length || isImporting} className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40" onClick={handleImport}>
                {isImporting ? 'Importing…' : `Import ${parsedRows.length} rows`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
