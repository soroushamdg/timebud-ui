import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIStore {
  preferredBudgetMinutes: number;
  setBudget: (m: number) => void;
  setPreferredBudgetMinutes: (m: number) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      preferredBudgetMinutes: 60,
      
      setBudget: (m: number) =>
        set({
          preferredBudgetMinutes: m,
        }),
      
      setPreferredBudgetMinutes: (m: number) =>
        set({
          preferredBudgetMinutes: m,
        }),
    }),
    {
      name: 'timebud-ui',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const uiStore = useUIStore;
