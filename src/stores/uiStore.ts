import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIStore {
  preferredBudgetMinutes: number;
  allowPartialTasks: boolean;
  setBudget: (m: number) => void;
  setPreferredBudgetMinutes: (m: number) => void;
  setAllowPartialTasks: (allow: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      preferredBudgetMinutes: 60,
      allowPartialTasks: true,
      
      setBudget: (m: number) =>
        set({
          preferredBudgetMinutes: m,
        }),
      
      setPreferredBudgetMinutes: (m: number) =>
        set({
          preferredBudgetMinutes: m,
        }),
      
      setAllowPartialTasks: (allow: boolean) =>
        set({
          allowPartialTasks: allow,
        }),
    }),
    {
      name: 'timebud-ui',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const uiStore = useUIStore;
