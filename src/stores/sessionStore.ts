import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface PlannedTask {
  position: number;
  taskId: string;
  projectId: string | null;
  isSolo: boolean;
  tier1: boolean;
  milestoneTitle: string | null;
  title: string;
  priority: boolean;
  scheduledMinutes: number;
  partial: boolean;
  carryOverMinutes: number;
  done: boolean;
}

interface SessionStore {
  sessionId: string | null;
  budgetMinutes: number;
  plannedTasks: PlannedTask[];
  timerRunning: boolean;
  timerSeconds: number;
  sessionStartTime: Date | null;
  setSession: (id: string, tasks: PlannedTask[], budget: number) => void;
  startTimer: () => void;
  stopTimer: () => void;
  tickTimer: () => void;
  markTaskDone: (taskId: string) => void;
  clearSession: () => void;
}

const initialState = {
  sessionId: null,
  budgetMinutes: 0,
  plannedTasks: [],
  timerRunning: false,
  timerSeconds: 0,
  sessionStartTime: null,
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setSession: (id: string, tasks: PlannedTask[], budget: number) =>
        set({
          sessionId: id,
          plannedTasks: tasks,
          budgetMinutes: budget,
        }),

      startTimer: () =>
        set({
          timerRunning: true,
          sessionStartTime: new Date(),
        }),

      stopTimer: () =>
        set({
          timerRunning: false,
        }),

      tickTimer: () => {
        const { timerRunning } = get();
        if (timerRunning) {
          set((state) => ({
            timerSeconds: state.timerSeconds + 1,
          }));
        }
      },

      markTaskDone: (taskId: string) =>
        set((state) => ({
          plannedTasks: state.plannedTasks.map((task) =>
            task.taskId === taskId ? { ...task, done: true } : task
          ),
        })),

      clearSession: () =>
        set({
          ...initialState,
        }),
    }),
    {
      name: 'timebud-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        plannedTasks: state.plannedTasks,
        budgetMinutes: state.budgetMinutes,
      }),
    }
  )
);

export const sessionStore = useSessionStore;
