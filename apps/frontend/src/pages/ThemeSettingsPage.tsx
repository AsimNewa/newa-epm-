import { useEffect, useState } from 'react';
import { useTheme, useUpdateTheme } from '../hooks/useTheme';
import { THEME_PRESETS, type ThemeColors } from '../lib/theme-presets';

const COLOR_FIELDS: Array<{ key: keyof ThemeColors; label: string }> = [
  { key: 'primaryColor', label: 'Primary (sidebar / chrome)' },
  { key: 'secondaryColor', label: 'Secondary' },
  { key: 'accentColor', label: 'Accent (active nav, highlights)' },
  { key: 'backgroundColor', label: 'Page Background' },
  { key: 'surfaceColor', label: 'Content Surface' },
  { key: 'textColor', label: 'Text' },
];

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

export function ThemeSettingsPage(): JSX.Element {
  const { data: theme, isLoading } = useTheme();
  const updateTheme = useUpdateTheme();

  const [presetName, setPresetName] = useState('newa-dark');
  const [colors, setColors] = useState<ThemeColors>(THEME_PRESETS['newa-dark']);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    if (!theme) return;
    setPresetName(theme.presetName);
    setColors({
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      accentColor: theme.accentColor,
      backgroundColor: theme.backgroundColor,
      surfaceColor: theme.surfaceColor,
      textColor: theme.textColor,
    });
    setLogoUrl(theme.logoUrl ?? undefined);
  }, [theme]);

  const applyPreset = (name: string): void => {
    setPresetName(name);
    if (THEME_PRESETS[name]) {
      setColors(THEME_PRESETS[name]);
    }
  };

  const setColor = (key: keyof ThemeColors, value: string): void => {
    setPresetName('custom');
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoChange = (file: File | undefined): void => {
    setLogoError(null);

    if (!file) return;

    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Logo must be smaller than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = (): void => {
    updateTheme.mutate({ presetName, logoUrl, ...colors });
  };

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading theme...</p>;
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h2 className="text-xl font-semibold">Theme Settings</h2>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Logo</h3>
        <div className="flex items-center gap-4 rounded border border-slate-200 bg-brand-primary p-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo preview" className="h-12 w-auto object-contain" />
          ) : (
            <span className="text-sm text-white/70">No logo uploaded — using default mark</span>
          )}
        </div>
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="mt-2 text-sm"
          onChange={(e) => handleLogoChange(e.target.files?.[0])}
        />
        {logoUrl && (
          <button className="ml-2 text-sm text-red-600 hover:underline" onClick={() => setLogoUrl(undefined)}>
            Remove logo
          </button>
        )}
        {logoError && <p className="mt-1 text-xs text-red-600">{logoError}</p>}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Preset</h3>
        <div className="flex gap-2">
          {Object.keys(THEME_PRESETS).map((name) => (
            <button
              key={name}
              className={`rounded border px-3 py-1.5 text-sm capitalize ${
                presetName === name ? 'border-brand-primary bg-brand-primary text-white' : 'border-slate-300'
              }`}
              onClick={() => applyPreset(name)}
            >
              {name.replace('newa-', '')}
            </button>
          ))}
          <button
            className={`rounded border px-3 py-1.5 text-sm ${
              presetName === 'custom' ? 'border-brand-primary bg-brand-primary text-white' : 'border-slate-300'
            }`}
            onClick={() => setPresetName('custom')}
          >
            Custom
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Colors</h3>
        <div className="grid grid-cols-2 gap-4">
          {COLOR_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center justify-between rounded border border-slate-200 p-2">
              <label className="text-sm">{field.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colors[field.key]}
                  onChange={(e) => setColor(field.key, e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-slate-300"
                />
                <span className="font-mono text-xs text-slate-500">{colors[field.key]}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <button
        className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        disabled={updateTheme.isPending}
        onClick={handleSave}
      >
        {updateTheme.isPending ? 'Saving...' : 'Save Theme'}
      </button>
    </div>
  );
}
