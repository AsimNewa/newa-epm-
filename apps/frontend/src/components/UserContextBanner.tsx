import { useUserContextStore } from '../store/user-context-store';
import { useTenantStore } from '../store/tenant-store';
import { useUsers } from '../hooks/useUsers';

export function UserContextBanner(): JSX.Element | null {
  const tenantId = useTenantStore((state) => state.tenantId);
  const actingAsUserId = useUserContextStore((state) => state.actingAsUserId);
  const setActingAsUserId = useUserContextStore((state) => state.setActingAsUserId);
  const clearActingAsUserId = useUserContextStore((state) => state.clearActingAsUserId);
  const { data: users } = useUsers();

  if (!tenantId) {
    return null;
  }

  const activeUser = users?.find((u) => u.id === actingAsUserId);

  if (actingAsUserId && activeUser) {
    return (
      <div className="flex items-center justify-between bg-slate-700 px-4 py-1 text-xs text-slate-200">
        <span>
          Acting as:{' '}
          <span className="font-semibold text-white">
            {activeUser.fullName} ({activeUser.email})
          </span>
          {' '}— entity/group access is filtered by this user's role scopes
        </span>
        <button className="text-slate-300 hover:text-white" onClick={clearActingAsUserId}>
          Reset to admin view
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-slate-800/60 px-4 py-1 text-xs text-slate-300">
      <span>View as user:</span>
      <select
        className="rounded border border-slate-600 bg-slate-700 px-1 py-0.5 text-xs text-white"
        value=""
        onChange={(e) => e.target.value && setActingAsUserId(e.target.value)}
      >
        <option value="">All (admin view)</option>
        {(users ?? []).map((u) => (
          <option key={u.id} value={u.id}>
            {u.fullName}
          </option>
        ))}
      </select>
    </div>
  );
}
