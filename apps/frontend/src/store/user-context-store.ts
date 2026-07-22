import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserContextState {
  actingAsUserId: string | null;
  setActingAsUserId: (userId: string) => void;
  clearActingAsUserId: () => void;
}

export const useUserContextStore = create<UserContextState>()(
  persist(
    (set) => ({
      actingAsUserId: null,
      setActingAsUserId: (actingAsUserId) => set({ actingAsUserId }),
      clearActingAsUserId: () => set({ actingAsUserId: null }),
    }),
    { name: 'newa-epm-user-context' },
  ),
);
