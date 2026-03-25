import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIStore {
  preferredBudgetMinutes: number;
  customBudgetMinutes: number | null;
  allowPartialTasks: boolean;
  setBudget: (m: number) => void;
  setPreferredBudgetMinutes: (m: number) => void;
  setCustomBudgetMinutes: (m: number | null) => void;
  setAllowPartialTasks: (allow: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      preferredBudgetMinutes: 60,
      customBudgetMinutes: null,
      allowPartialTasks: true,
      
      setBudget: (m: number) =>
        set({
          preferredBudgetMinutes: m,
        }),
      
      setPreferredBudgetMinutes: (m: number) =>
        set({
          preferredBudgetMinutes: m,
        }),
      
      setCustomBudgetMinutes: (m: number | null) =>
        set({
          customBudgetMinutes: m,
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
