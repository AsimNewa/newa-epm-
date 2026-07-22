import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PeriodState {
  periodId: string | null;
  setPeriodId: (periodId: string) => void;
  clearPeriodId: () => void;
}

export const usePeriodStore = create<PeriodState>()(
  persist(
    (set) => ({
      periodId: null,
      setPeriodId: (periodId) => set({ periodId }),
      clearPeriodId: () => set({ periodId: null }),
    }),
    { name: 'newa-epm-period' },
  ),
);
