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
  /** Set only on the one task currently being timed — cleared when its lap is frozen. */
  activeStartedAt?: string | null;
  /** totalPausedSeconds snapshotted when this lap began, so paused time during the lap
   * can be subtracted back out without affecting other tasks' laps. */
  pausedSecondsAtStart?: number;
  /** Seconds banked from this task's previous (already-frozen) laps this session. */
  bankedSeconds?: number;
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
  setPlannedTasksOrder: (tasks: PlannedTask[]) => void;
  clearFocusSession: () => void;
  getElapsedTime: () => number;
  resumeTimer: () => void;
  applyServerSnapshot: (row: FocusSessionServerSnapshot, opts?: { force?: boolean }) => void;
  getTaskElapsedSeconds: (taskId: string) => number;
  setActiveTask: (taskId: string) => void;
  finalizeTaskTime: (taskId: string) => number;
  autoAdvanceActiveTask: () => boolean;
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

// Mirrors the on-the-fly lock resolution in the focus screen's render (a task with no
// explicit isLocked flag is derived from whether its dependency is done yet), so
// auto-advance picks the same "next" task the UI itself treats as available.
const isEffectivelyLocked = (task: PlannedTask, all: PlannedTask[]): boolean => {
  if (task.isLocked !== undefined) return task.isLocked;
  if (!task.dependsOnTaskId) return false;
  const dep = all.find((t) => t.taskId === task.dependsOnTaskId);
  return dep ? !dep.done : false;
};

// Same derivation as getElapsedTime, offset per task: banked time from previous laps
// plus whatever the current lap has accrued, minus any paused time since that lap began.
const computeTaskElapsed = (
  task: PlannedTask,
  session: { status: FocusSessionStatus; pausedAt: Date | null; totalPausedSeconds: number }
): number => {
  const banked = task.bankedSeconds ?? 0;
  if (!task.activeStartedAt) return banked;

  const startTime = asDate(task.activeStartedAt);
  if (!startTime) return banked;

  const referenceTime =
    session.status === 'paused' ? asDate(session.pausedAt) ?? new Date() : new Date();
  const pausedSinceStart = session.totalPausedSeconds - (task.pausedSecondsAtStart ?? 0);
  const rawElapsed = Math.floor((referenceTime.getTime() - startTime.getTime()) / 1000);
  return banked + Math.max(0, rawElapsed - pausedSinceStart);
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

      setPlannedTasksOrder: (tasks: PlannedTask[]) =>
        set({ plannedTasks: tasks }),

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

      getTaskElapsedSeconds: (taskId: string) => {
        const state = get();
        const task = state.plannedTasks.find((t) => t.taskId === taskId);
        if (!task) return 0;
        return computeTaskElapsed(task, state);
      },

      setActiveTask: (taskId: string) => {
        const state = get();
        const target = state.plannedTasks.find((t) => t.taskId === taskId);
        if (!target || target.done || isEffectivelyLocked(target, state.plannedTasks)) return;
        if (target.activeStartedAt) return;

        const nowIso = new Date().toISOString();
        set({
          plannedTasks: state.plannedTasks.map((t) => {
            if (t.taskId === taskId) {
              return { ...t, activeStartedAt: nowIso, pausedSecondsAtStart: state.totalPausedSeconds };
            }
            if (t.activeStartedAt) {
              return { ...t, bankedSeconds: computeTaskElapsed(t, state), activeStartedAt: null };
            }
            return t;
          }),
        });
      },

      finalizeTaskTime: (taskId: string) => {
        const state = get();
        const task = state.plannedTasks.find((t) => t.taskId === taskId);
        if (!task) return 0;

        const finalSeconds = computeTaskElapsed(task, state);
        if (task.activeStartedAt) {
          set({
            plannedTasks: state.plannedTasks.map((t) =>
              t.taskId === taskId ? { ...t, bankedSeconds: finalSeconds, activeStartedAt: null } : t
            ),
          });
        }
        return finalSeconds;
      },

      autoAdvanceActiveTask: () => {
        const state = get();
        if (state.plannedTasks.some((t) => t.activeStartedAt)) return false;

        const next = state.plannedTasks.find(
          (t) => !t.done && !isEffectivelyLocked(t, state.plannedTasks)
        );
        if (!next) return false;

        get().setActiveTask(next.taskId);
        return true;
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
