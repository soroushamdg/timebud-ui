import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface PlannedTask {
  position: number;
  taskId: string;
  projectId: string | null;
  projectName: string | undefined;
  projectColor: string | undefined;
  isSolo: boolean;
  tier1: boolean;
  milestoneTitle: string | null;
  title: string;
  priority: boolean;
  scheduledMinutes: number;
  partial: boolean;
  carryOverMinutes: number;
  done: boolean;
  estimatedMinutes?: number;
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
  getElapsedTime: () => number;
  resumeTimer: () => void;
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
      
      setSession: (id: string, tasks: PlannedTask[], budget: number) => {
        // Clear any existing session before setting new one
        const currentState = get();
        if (currentState.sessionId && currentState.timerRunning) {
          console.warn('Attempting to set new session while one is already running');
          return;
        }
        
        set({
          sessionId: id,
          plannedTasks: tasks,
          budgetMinutes: budget,
        });
      },

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

      getElapsedTime: () => {
        const { timerSeconds, sessionStartTime } = get();
        if (sessionStartTime) {
          const startTime = typeof sessionStartTime === 'string' 
            ? new Date(sessionStartTime) 
            : sessionStartTime;
          return Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
        }
        return timerSeconds;
      },

      resumeTimer: () => {
        const { sessionStartTime } = get();
        if (sessionStartTime) {
          set({
            timerRunning: true,
          });
        }
      },

      // Helper to ensure sessionStartTime is always a Date object
      _ensureDateObject: () => {
        const { sessionStartTime } = get();
        if (sessionStartTime && typeof sessionStartTime === 'string') {
          set({
            sessionStartTime: new Date(sessionStartTime),
          });
        }
      },
    }),
    {
      name: 'timebud-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        plannedTasks: state.plannedTasks,
        budgetMinutes: state.budgetMinutes,
        timerRunning: state.timerRunning,
        sessionStartTime: state.sessionStartTime,
      }),
      onRehydrateStorage: () => (state) => {
        // Convert sessionStartTime back to Date object after rehydration
        if (state?.sessionStartTime && typeof state.sessionStartTime === 'string') {
          state.sessionStartTime = new Date(state.sessionStartTime);
        }
      },
    }
  )
);

export const sessionStore = useSessionStore;
