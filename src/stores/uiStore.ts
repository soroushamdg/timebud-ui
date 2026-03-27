import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIStore {
  preferredBudgetMinutes: number;
  customBudgetMinutes: number | null;
  allowPartialTasks: boolean;
  pinnedTaskIds: string[];
  manualTaskIds: string[];
  setBudget: (m: number) => void;
  setPreferredBudgetMinutes: (m: number) => void;
  setCustomBudgetMinutes: (m: number | null) => void;
  setAllowPartialTasks: (allow: boolean) => void;
  addPinnedTask: (taskId: string) => void;
  removePinnedTask: (taskId: string) => void;
  addManualTask: (taskId: string) => void;
  removeManualTask: (taskId: string) => void;
  clearCompletedTasks: (completedTaskIds: string[]) => void;
  isPinned: (taskId: string) => boolean;
  isManual: (taskId: string) => boolean;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      preferredBudgetMinutes: 60,
      customBudgetMinutes: null,
      allowPartialTasks: true,
      pinnedTaskIds: [],
      manualTaskIds: [],
      
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
      
      addPinnedTask: (taskId: string) =>
        set((state) => ({
          pinnedTaskIds: state.pinnedTaskIds.includes(taskId)
            ? state.pinnedTaskIds
            : [...state.pinnedTaskIds, taskId],
        })),
      
      removePinnedTask: (taskId: string) =>
        set((state) => ({
          pinnedTaskIds: state.pinnedTaskIds.filter((id) => id !== taskId),
        })),
      
      addManualTask: (taskId: string) =>
        set((state) => ({
          manualTaskIds: state.manualTaskIds.includes(taskId)
            ? state.manualTaskIds
            : [...state.manualTaskIds, taskId],
        })),
      
      removeManualTask: (taskId: string) =>
        set((state) => ({
          manualTaskIds: state.manualTaskIds.filter((id) => id !== taskId),
        })),
      
      clearCompletedTasks: (completedTaskIds: string[]) =>
        set((state) => ({
          pinnedTaskIds: state.pinnedTaskIds.filter(
            (id) => !completedTaskIds.includes(id)
          ),
          manualTaskIds: state.manualTaskIds.filter(
            (id) => !completedTaskIds.includes(id)
          ),
        })),
      
      isPinned: (taskId: string) => get().pinnedTaskIds.includes(taskId),
      
      isManual: (taskId: string) => get().manualTaskIds.includes(taskId),
    }),
    {
      name: 'timebud-ui',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const uiStore = useUIStore;
