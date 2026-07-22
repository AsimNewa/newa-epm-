import { useState } from 'react';
import { useTenantStore } from '../store/tenant-store';

export function TenantBanner(): JSX.Element {
  const tenantId = useTenantStore((state) => state.tenantId);
  const setTenantId = useTenantStore((state) => state.setTenantId);
  const clearTenantId = useTenantStore((state) => state.clearTenantId);
  const [draft, setDraft] = useState('');

  if (tenantId) {
    return (
      <div className="flex items-center justify-between bg-brand-primary px-4 py-2 text-sm text-white">
        <span>
          Tenant: <span className="font-mono">{tenantId}</span>
        </span>
        <button className="text-white/70 hover:text-white" onClick={clearTenantId}>
          Change tenant
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm">
      <span>No tenant selected. Enter a tenant UUID to load master data:</span>
      <input
        className="rounded border border-amber-300 px-2 py-1"
        placeholder="tenant UUID"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        className="rounded bg-amber-600 px-3 py-1 text-white hover:bg-amber-700"
        onClick={() => draft.trim() && setTenantId(draft.trim())}
      >
        Use tenant
      </button>
    </div>
  );
}
