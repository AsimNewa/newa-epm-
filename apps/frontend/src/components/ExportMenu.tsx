import { useRef, useState } from 'react';
import type { ExportFormat } from '../lib/entity-format';
import { FORMAT_LABELS } from '../lib/entity-format';

const FORMATS: ExportFormat[] = ['xlsx', 'csv', 'tsv', 'pipe', 'json', 'xml'];

const FORMAT_ICONS: Record<ExportFormat, string> = {
  xlsx: '📊',
  csv: '📄',
  tsv: '📄',
  pipe: '📄',
  json: '{ }',
  xml: '</>',
};

interface ExportMenuProps {
  onExport: (format: ExportFormat) => void;
  disabled?: boolean;
}

export function ExportMenu({ onExport, disabled }: ExportMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleExport = (format: ExportFormat): void => {
    setOpen(false);
    onExport(format);
  };

  return (
    <div className="relative" ref={ref} onBlur={(e) => {
      if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
    }}>
      <button
        disabled={disabled}
        className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
        onClick={() => setOpen((v) => !v)}
      >
        <span>⬇</span> Export
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Export current view as…
          </div>
          <ul className="py-1">
            {FORMATS.map((fmt) => (
              <li key={fmt}>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => handleExport(fmt)}
                >
                  <span className="w-7 text-center font-mono text-xs">{FORMAT_ICONS[fmt]}</span>
                  {FORMAT_LABELS[fmt]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
