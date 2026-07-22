import { useEffect, useMemo, useRef, useState } from 'react';

export interface ComboboxOption {
  label: string;
  value: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
}

/** Type-ahead single-select: shows the selected option's label, filters as you type, click to pick. */
export function Combobox({ value, onChange, options, placeholder }: ComboboxProps): JSX.Element {
  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);
  const [query, setQuery] = useState(selected?.label ?? '');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the displayed text in sync when the underlying value changes externally (form reset, edit prefill).
  useEffect(() => {
    setQuery(selected?.label ?? '');
  }, [selected]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === (selected?.label ?? '').toLowerCase()) return options.slice(0, 30);
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 30);
  }, [query, options, selected]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (e.target.value === '') onChange('');
        }}
        onFocus={() => setOpen(true)}
        onBlur={() =>
          setTimeout(() => {
            setOpen(false);
            // Discard unmatched typed text — revert to the last confirmed selection's label.
            setQuery(selected?.label ?? '');
          }, 150)
        }
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded border border-slate-300 bg-white text-sm shadow-lg">
          {suggestions.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                className="block w-full px-2 py-1.5 text-left hover:bg-slate-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.value);
                  setQuery(o.label);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
