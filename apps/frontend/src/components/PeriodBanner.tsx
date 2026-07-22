import { usePeriodStore } from '../store/period-store';
import { useTenantStore } from '../store/tenant-store';
import { usePeriods } from '../hooks/usePeriods';

export function PeriodBanner(): JSX.Element | null {
  const tenantId = useTenantStore((state) => state.tenantId);
  const periodId = usePeriodStore((state) => state.periodId);
  const setPeriodId = usePeriodStore((state) => state.setPeriodId);
  const clearPeriodId = usePeriodStore((state) => state.clearPeriodId);
  const { data: periods } = usePeriods();

  if (!tenantId) {
    return null; // tenant banner takes precedence
  }

  const currentPeriod = periods?.find((p) => p.id === periodId);

  if (periodId && currentPeriod) {
    return (
      <div className="flex items-center justify-between bg-brand-secondary px-4 py-2 text-sm text-brand-primary">
        <span>
          Period: <span className="font-semibold">{currentPeriod.name}</span>{' '}
          <span className="font-mono text-xs">({currentPeriod.period})</span>
          {currentPeriod.status === 'locked' && (
            <span className="ml-2 rounded bg-brand-primary px-2 py-0.5 text-xs text-white">Locked</span>
          )}
        </span>
        <button className="hover:underline" onClick={clearPeriodId}>
          Change period
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm">
      <span>No period selected. You must select a period before viewing or editing master data:</span>
      <select
        className="rounded border border-amber-300 px-2 py-1"
        value=""
        onChange={(e) => e.target.value && setPeriodId(e.target.value)}
      >
        <option value="" disabled>
          Select a period...
        </option>
        {(periods ?? []).map((period) => (
          <option key={period.id} value={period.id}>
            {period.name} ({period.period})
          </option>
        ))}
      </select>
      {(periods ?? []).length === 0 && (
        <span className="text-amber-700">No periods exist yet — create one on the Calendar &amp; Periods page.</span>
      )}
    </div>
  );
}
