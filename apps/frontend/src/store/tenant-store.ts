import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TenantState {
  tenantId: string | null;
  setTenantId: (tenantId: string) => void;
  clearTenantId: () => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      tenantId: null,
      setTenantId: (tenantId) => set({ tenantId }),
      clearTenantId: () => set({ tenantId: null }),
    }),
    { name: 'newa-epm-tenant' },
  ),
);
