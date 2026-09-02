import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FocusSessionStatus } from '@/types/database';

export interface PlannedTask {
  position: number;
  taskId: string;
  projectId: string | null;
  projectName: string | undefined;
  projectColor: string | undefined;
  projectAvatarUrl: string | undefined;
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
  deadline?: string;
  isPinned?: boolean;
  isManual?: boolean;
  isPartOfChain?: boolean;
  chainPosition?: number;
  dependsOnTaskId?: string | null;
  isLocked?: boolean;
  recurrenceType?: 'daily' | 'specific_days' | 'interval' | null;
  recurrenceDays?: number[] | null;
  recurrenceInterval?: number | null;
}

// The subset of a `sessions` row (src/types/database.ts) needed to mirror server state
// into this store — arrives from either a fetch or a realtime postgres_changes event.
export interface FocusSessionServerSnapshot {
  id: string;
  status: FocusSessionStatus;
  start_time: string | null;
  paused_at: string | null;
  total_paused_seconds: number;
  budget_minutes: number;
  planned_tasks: PlannedTask[];
}

interface FocusSessionStore {
  focusSessionId: string | null;
  budgetMinutes: number;
  plannedTasks: PlannedTask[];
  timerRunning: boolean;
  timerSeconds: number;
  sessionStartTime: Date | null;
  status: FocusSessionStatus;
  pausedAt: Date | null;
  totalPausedSeconds: number;
  setFocusSession: (id: string, tasks: PlannedTask[], budget: number) => void;
  startTimer: () => void;
  stopTimer: () => void;
  pauseTimer: () => void;
  markTaskDone: (taskId: string) => void;
  markTaskUndone: (taskId: string) => void;
  unlockDependentTasks: (completedTaskId: string) => void;
  clearFocusSession: () => void;
  getElapsedTime: () => number;
  resumeTimer: () => void;
  applyServerSnapshot: (row: FocusSessionServerSnapshot, opts?: { force?: boolean }) => void;
}

const initialState = {
  focusSessionId: null,
  budgetMinutes: 0,
  plannedTasks: [],
  timerRunning: false,
  timerSeconds: 0,
  sessionStartTime: null,
  // 'completed' doubles as "no active session" for the initial/cleared state — it never
  // satisfies the `status === 'running' || status === 'paused'` active-session check.
  status: 'completed' as FocusSessionStatus,
  pausedAt: null,
  totalPausedSeconds: 0,
};

const asDate = (value: Date | string | null): Date | null => {
  if (!value) return null;
  return typeof value === 'string' ? new Date(value) : value;
};

export const useFocusSessionStore = create<FocusSessionStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setFocusSession: (id: string, tasks: PlannedTask[], budget: number) => {
        // Clear any existing session before setting new one
        const currentState = get();
        if (currentState.focusSessionId && currentState.timerRunning) {
          console.warn('Attempting to set new session while one is already running');
          return;
        }

        set({
          focusSessionId: id,
          plannedTasks: tasks,
          budgetMinutes: budget,
        });
      },

      startTimer: () =>
        set({
          timerRunning: true,
          status: 'running',
          sessionStartTime: new Date(),
          pausedAt: null,
          totalPausedSeconds: 0,
        }),

      stopTimer: () =>
        set({
          timerRunning: false,
          status: 'completed',
        }),

      pauseTimer: () => {
        if (get().status !== 'running') return;
        set({
          status: 'paused',
          timerRunning: false,
          pausedAt: new Date(),
        });
      },

      resumeTimer: () => {
        const { status, pausedAt, totalPausedSeconds } = get();
        if (status !== 'paused') return;
        const resumedAt = asDate(pausedAt);
        const additionalPause = resumedAt
          ? Math.floor((new Date().getTime() - resumedAt.getTime()) / 1000)
          : 0;
        set({
          status: 'running',
          timerRunning: true,
          pausedAt: null,
          totalPausedSeconds: totalPausedSeconds + additionalPause,
        });
      },

      markTaskDone: (taskId: string) =>
        set((state) => ({
          plannedTasks: state.plannedTasks.map((task) =>
            task.taskId === taskId ? { ...task, done: true } : task
          ),
        })),

      markTaskUndone: (taskId: string) =>
        set((state) => ({
          plannedTasks: state.plannedTasks.map((task) =>
            task.taskId === taskId ? { ...task, done: false } : task
          ),
        })),

      unlockDependentTasks: (completedTaskId: string) =>
        set((state) => ({
          plannedTasks: state.plannedTasks.map((task) =>
            task.dependsOnTaskId === completedTaskId
              ? { ...task, isLocked: false }
              : task
          ),
        })),

      clearFocusSession: () =>
        set({
          ...initialState,
        }),

      getElapsedTime: () => {
        const { sessionStartTime, status, pausedAt, totalPausedSeconds } = get();
        const startTime = asDate(sessionStartTime);
        if (!startTime) return 0;

        const referenceTime = status === 'paused' ? asDate(pausedAt) ?? new Date() : new Date();
        const rawElapsed = Math.floor((referenceTime.getTime() - startTime.getTime()) / 1000);
        return Math.max(0, rawElapsed - totalPausedSeconds);
      },

      applyServerSnapshot: (row: FocusSessionServerSnapshot, opts) => {
        // Ignore snapshots for a different session than the one we're tracking locally
        // (e.g. a stale event arriving after this device already started a new run) —
        // unless the caller passes force: true, for the two authoritative cross-device
        // sync paths (the "what's my active session" poll/reconciliation in
        // FocusSessionSync, and a live realtime event reporting a running/paused row).
        // Both represent server truth about the current session and should win over a
        // stale local pointer (e.g. a crashed tab that never cleared its old session id)
        // — that mismatch was silently and permanently blocking real cross-device sync.
        const { focusSessionId } = get();
        if (!opts?.force && focusSessionId && focusSessionId !== row.id) return;

        set({
          focusSessionId: row.id,
          status: row.status,
          sessionStartTime: asDate(row.start_time),
          pausedAt: asDate(row.paused_at),
          totalPausedSeconds: row.total_paused_seconds,
          budgetMinutes: row.budget_minutes,
          plannedTasks: row.planned_tasks,
          timerRunning: row.status === 'running',
        });
      },
    }),
    {
      name: 'timebud-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        focusSessionId: state.focusSessionId,
        plannedTasks: state.plannedTasks,
        budgetMinutes: state.budgetMinutes,
        timerRunning: state.timerRunning,
        sessionStartTime: state.sessionStartTime,
        status: state.status,
        pausedAt: state.pausedAt,
        totalPausedSeconds: state.totalPausedSeconds,
      }),
      onRehydrateStorage: () => (state) => {
        // Convert timestamps back to Date objects after rehydration
        if (state?.sessionStartTime && typeof state.sessionStartTime === 'string') {
          state.sessionStartTime = new Date(state.sessionStartTime);
        }
        if (state?.pausedAt && typeof state.pausedAt === 'string') {
          state.pausedAt = new Date(state.pausedAt);
        }
      },
    }
  )
);

export const focusSessionStore = useFocusSessionStore;
