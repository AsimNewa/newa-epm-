import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrencies } from '../hooks/useCurrencies';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';

interface FormState {
  baseCurrencyCode: string;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  passwordExpiryDays: string; // '' = never expires
  lockoutThreshold: number;
  mfaRequiredByDefault: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string; // write-only; blank = leave unchanged
  smtpFromAddress: string;
  smtpFromName: string;
  emailHeaderText: string;
}

const EMPTY_FORM: FormState = {
  baseCurrencyCode: '',
  passwordMinLength: 12,
  passwordRequireUppercase: true,
  passwordRequireNumber: true,
  passwordRequireSymbol: false,
  passwordExpiryDays: '',
  lockoutThreshold: 5,
  mfaRequiredByDefault: false,
  smtpHost: '',
  smtpPort: '',
  smtpUsername: '',
  smtpPassword: '',
  smtpFromAddress: '',
  smtpFromName: '',
  emailHeaderText: '',
};

export function SystemSettingsPage(): JSX.Element {
  const { data: settings, isLoading } = useSettings();
  const { data: currencies } = useCurrencies();
  const updateSettings = useUpdateSettings();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [smtpPasswordSet, setSmtpPasswordSet] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      baseCurrencyCode: settings.baseCurrencyCode ?? '',
      passwordMinLength: settings.passwordMinLength,
      passwordRequireUppercase: settings.passwordRequireUppercase,
      passwordRequireNumber: settings.passwordRequireNumber,
      passwordRequireSymbol: settings.passwordRequireSymbol,
      passwordExpiryDays: settings.passwordExpiryDays?.toString() ?? '',
      lockoutThreshold: settings.lockoutThreshold,
      mfaRequiredByDefault: settings.mfaRequiredByDefault,
      smtpHost: settings.smtpHost ?? '',
      smtpPort: settings.smtpPort?.toString() ?? '',
      smtpUsername: settings.smtpUsername ?? '',
      smtpPassword: '',
      smtpFromAddress: settings.smtpFromAddress ?? '',
      smtpFromName: settings.smtpFromName ?? '',
      emailHeaderText: settings.emailHeaderText ?? '',
    });
    setSmtpPasswordSet(settings.smtpPasswordSet);
  }, [settings]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = (): void => {
    updateSettings.mutate({
      baseCurrencyCode: form.baseCurrencyCode || undefined,
      passwordMinLength: form.passwordMinLength,
      passwordRequireUppercase: form.passwordRequireUppercase,
      passwordRequireNumber: form.passwordRequireNumber,
      passwordRequireSymbol: form.passwordRequireSymbol,
      passwordExpiryDays: form.passwordExpiryDays === '' ? null : Number(form.passwordExpiryDays),
      lockoutThreshold: form.lockoutThreshold,
      mfaRequiredByDefault: form.mfaRequiredByDefault,
      smtpHost: form.smtpHost || undefined,
      smtpPort: form.smtpPort === '' ? undefined : Number(form.smtpPort),
      smtpUsername: form.smtpUsername || undefined,
      smtpPassword: form.smtpPassword || undefined,
      smtpFromAddress: form.smtpFromAddress || undefined,
      smtpFromName: form.smtpFromName || undefined,
      emailHeaderText: form.emailHeaderText || undefined,
    });
  };

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading settings...</p>;
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h2 className="text-xl font-semibold">System Settings</h2>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Fiscal Year</h3>
        <p className="rounded border border-slate-200 p-3 text-sm text-slate-600">
          Fiscal year start month, period count, and naming convention are managed on the{' '}
          <Link to="/calendar" className="text-brand-primary underline">
            Calendar &amp; Periods
          </Link>{' '}
          page.
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Base Currency</h3>
        <p className="mb-2 text-sm text-slate-600">Default currency for group-level reporting.</p>
        <select
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={form.baseCurrencyCode}
          onChange={(e) => set('baseCurrencyCode', e.target.value)}
        >
          <option value="">(not set)</option>
          {(currencies ?? []).map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Password Policy</h3>
        <div className="space-y-3 rounded border border-slate-200 p-3">
          <label className="flex items-center justify-between text-sm">
            Minimum length
            <input
              type="number"
              min={6}
              max={64}
              className="w-20 rounded border border-slate-300 px-2 py-1 text-right"
              value={form.passwordMinLength}
              onChange={(e) => set('passwordMinLength', Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.passwordRequireUppercase}
              onChange={(e) => set('passwordRequireUppercase', e.target.checked)}
            />
            Require uppercase letter
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.passwordRequireNumber}
              onChange={(e) => set('passwordRequireNumber', e.target.checked)}
            />
            Require number
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.passwordRequireSymbol}
              onChange={(e) => set('passwordRequireSymbol', e.target.checked)}
            />
            Require symbol
          </label>
          <label className="flex items-center justify-between text-sm">
            Expiry (days, blank = never)
            <input
              type="number"
              min={0}
              className="w-20 rounded border border-slate-300 px-2 py-1 text-right"
              value={form.passwordExpiryDays}
              onChange={(e) => set('passwordExpiryDays', e.target.value)}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            Lockout threshold (failed attempts)
            <input
              type="number"
              min={1}
              max={20}
              className="w-20 rounded border border-slate-300 px-2 py-1 text-right"
              value={form.lockoutThreshold}
              onChange={(e) => set('lockoutThreshold', Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">MFA Policy</h3>
        <div className="rounded border border-slate-200 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.mfaRequiredByDefault}
              onChange={(e) => set('mfaRequiredByDefault', e.target.checked)}
            />
            Require MFA by default for new users
          </label>
          <p className="mt-2 text-xs text-slate-500">
            MFA can also be required per role on the{' '}
            <Link to="/roles" className="text-brand-primary underline">
              Roles &amp; Permissions
            </Link>{' '}
            page.
          </p>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">
          Notification Settings (SMTP)
        </h3>
        <div className="grid grid-cols-2 gap-3 rounded border border-slate-200 p-3">
          <label className="text-sm">
            Host
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
              value={form.smtpHost}
              onChange={(e) => set('smtpHost', e.target.value)}
            />
          </label>
          <label className="text-sm">
            Port
            <input
              type="number"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
              value={form.smtpPort}
              onChange={(e) => set('smtpPort', e.target.value)}
            />
          </label>
          <label className="text-sm">
            Username
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
              value={form.smtpUsername}
              onChange={(e) => set('smtpUsername', e.target.value)}
            />
          </label>
          <label className="text-sm">
            Password {smtpPasswordSet && !form.smtpPassword && <span className="text-xs text-slate-500">(set — leave blank to keep)</span>}
            <input
              type="password"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
              placeholder={smtpPasswordSet ? '••••••••' : ''}
              value={form.smtpPassword}
              onChange={(e) => set('smtpPassword', e.target.value)}
            />
          </label>
          <label className="text-sm">
            From Address
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
              value={form.smtpFromAddress}
              onChange={(e) => set('smtpFromAddress', e.target.value)}
            />
          </label>
          <label className="text-sm">
            From Name
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
              value={form.smtpFromName}
              onChange={(e) => set('smtpFromName', e.target.value)}
            />
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Branding</h3>
        <p className="mb-2 text-sm text-slate-600">
          Company logo and primary colour are managed on the{' '}
          <Link to="/settings/theme" className="text-brand-primary underline">
            Theme Settings
          </Link>{' '}
          page.
        </p>
        <label className="text-sm">
          Email header text
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
            value={form.emailHeaderText}
            onChange={(e) => set('emailHeaderText', e.target.value)}
          />
        </label>
      </section>

      <button
        className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        disabled={updateSettings.isPending}
        onClick={handleSave}
      >
        {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
