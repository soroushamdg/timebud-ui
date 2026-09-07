'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Square, Pause, Play } from 'lucide-react'
import { Reorder } from 'motion/react'
import { AppShell } from '@/components/layout/AppShell'
import { useFocusSessionStore } from '@/stores/sessionStore'
import { useUpdateTask } from '@/hooks/useTasks'
import { useUpdateFocusSession, insertSessionTaskLogs } from '@/hooks/useSessions'
import { toUtcString } from '@/lib/dates'
import { createClient } from '@/lib/supabase/client'
import { PlannedTask } from '@/stores/sessionStore'
import { FocusTaskCard } from '@/components/tasks/FocusTaskCard'
import { PartialTaskCompletionDialog } from '@/components/dialogs/PartialTaskCompletionDialog'
import { TaskOverviewDialog } from '@/components/dialogs/TaskOverviewDialog'
import { SimpleToast } from '@/components/ui/SimpleToast'
import { Timer } from 'lucide-react'
import { useFocusSessionGuard } from '@/hooks/useSessionGuard'
import { useReplan } from '@/contexts/ReplanContext'
import { useProjects } from '@/hooks/useProjects'
import { getJobXpPreview } from '@/lib/gamification/xp'
import { MissionDifficulty } from '@/types/database'

export default function FocusSession() {
  const router = useRouter()
  const focusSessionStore = useFocusSessionStore()
  const updateTask = useUpdateTask()
  const updateFocusSession = useUpdateFocusSession()
  const { triggerReplan } = useReplan()
  const { data: projects } = useProjects()

  // Pushes the current in-run task list (done/partial flags) to the session row so any
  // other device looking at the same run sees the same checklist live. Reads fresh
  // from the store rather than a closed-over `focusSessionStore` snapshot, since it's
  // always called right after a synchronous store mutation (markTaskDone, etc.) that
  // this render hasn't picked up yet.
  const syncTaskProgress = () => {
    const { focusSessionId, plannedTasks } = useFocusSessionStore.getState()
    if (!focusSessionId) return
    updateFocusSession.mutate({
      id: focusSessionId,
      planned_tasks: plannedTasks as unknown as Record<string, unknown>[],
    })
  }

  const xpForTask = (task: PlannedTask) => {
    const difficulty = (task.projectId ? projects?.find(p => p.id === task.projectId)?.difficulty : undefined) as MissionDifficulty | undefined
    return getJobXpPreview(difficulty || 'medium')
  }
  const xpSoFar = focusSessionStore.plannedTasks
    .filter(t => t.done)
    .reduce((sum, t) => sum + xpForTask(t), 0)

  // Debug: Log session data
  console.log('[FocusSession] Session data:', {
    taskCount: focusSessionStore.plannedTasks.length,
    tasks: focusSessionStore.plannedTasks.map(t => ({
      title: t.title,
      dependsOnTaskId: t.dependsOnTaskId,
      isPartOfChain: t.isPartOfChain,
      chainPosition: t.chainPosition,
      isLocked: t.isLocked
    }))
  });
  
  // Focus session guard - allow this page but redirect if no active focus session
  useFocusSessionGuard(true);
  
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showStopConfirmDialog, setShowStopConfirmDialog] = useState(false)
  const [showPartialCompletionDialog, setShowPartialCompletionDialog] = useState(false)
  const [showTaskOverview, setShowTaskOverview] = useState(false)
  const [selectedTask, setSelectedTask] = useState<PlannedTask | null>(null)
  const [loadingTaskIds, setLoadingTaskIds] = useState<Set<string>>(new Set())
  const [isTogglingPause, setIsTogglingPause] = useState(false)
  const [breakToast, setBreakToast] = useState<string | null>(null)

  const formatShort = (seconds: number): string => {
    const totalMinutes = Math.max(0, Math.round(seconds / 60))
    if (totalMinutes < 60) return `${totalMinutes}m`
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  const formatLap = (seconds: number): string => {
    const s = Math.max(0, Math.floor(seconds))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
      : `${m}:${sec.toString().padStart(2, '0')}`
  }

  const promptBreak = (title: string, seconds: number) => {
    setBreakToast(`Nice, "${title}" logged ${formatShort(seconds)}. Want a quick break before the next one?`)
  }

  // The run's timer follows whichever task is "active" — auto-starts on the first
  // eligible task the moment this screen mounts (fresh session, a reload, or joining a
  // run already in progress on another device), and is a no-op once someone already is.
  useEffect(() => {
    const started = useFocusSessionStore.getState().autoAdvanceActiveTask()
    if (started) syncTaskProgress()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleActivateTask = (taskId: string) => {
    focusSessionStore.setActiveTask(taskId)
    syncTaskProgress()
  }

  // Elapsed time is always derived from the session's start/pause timestamps (see
  // sessionStore.getElapsedTime), never accumulated locally — that's what lets it stay
  // correct across a reload, a pause originating on another device, or a tab that was
  // backgrounded for a while. This interval just forces a re-render once a second while
  // running so the on-screen number keeps advancing; while paused it stays frozen with
  // no interval needed at all.
  const [, forceTick] = useState(0)
  useEffect(() => {
    if (focusSessionStore.status !== 'running') return
    const interval = setInterval(() => forceTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [focusSessionStore.status])

  const elapsedSeconds = focusSessionStore.getElapsedTime()
  const isPaused = focusSessionStore.status === 'paused'
  const activeTask = focusSessionStore.plannedTasks.find(t => t.activeStartedAt)
  const activeTaskSeconds = activeTask ? focusSessionStore.getTaskElapsedSeconds(activeTask.taskId) : 0

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const sec = seconds % 60
    return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const handleTogglePause = async () => {
    if (!focusSessionStore.focusSessionId || isTogglingPause) return
    setIsTogglingPause(true)
    try {
      const updated = isPaused
        ? await updateFocusSession.mutateAsync({
            id: focusSessionStore.focusSessionId,
            status: 'running',
            paused_at: null,
            total_paused_seconds:
              focusSessionStore.totalPausedSeconds +
              (focusSessionStore.pausedAt
                ? Math.floor((Date.now() - new Date(focusSessionStore.pausedAt).getTime()) / 1000)
                : 0),
          })
        : await updateFocusSession.mutateAsync({
            id: focusSessionStore.focusSessionId,
            status: 'paused',
            paused_at: toUtcString(new Date()),
          })

      // Apply the row Supabase actually wrote (not a locally-recomputed guess) so this
      // device's clock matches exactly what every other device will read.
      focusSessionStore.applyServerSnapshot({
        id: updated.id,
        status: updated.status,
        start_time: updated.start_time,
        paused_at: updated.paused_at,
        total_paused_seconds: updated.total_paused_seconds,
        budget_minutes: updated.budget_minutes,
        planned_tasks: updated.planned_tasks as unknown as PlannedTask[],
      })
    } catch (error) {
      console.error('Failed to toggle pause:', error)
    } finally {
      setIsTogglingPause(false)
    }
  }

  const handleTaskCheckmark = async (taskId: string) => {
    const task = focusSessionStore.plannedTasks.find(t => t.taskId === taskId)
    
    if (!task) return
    
    // If task is already done, undo it
    if (task.done) {
      setLoadingTaskIds(prev => new Set(prev).add(taskId))
      
      try {
        await updateTask.mutateAsync({ id: taskId, status: 'pending' })
        focusSessionStore.markTaskUndone(taskId)
        syncTaskProgress()
      } catch (error) {
        console.error('Failed to undo task:', error)
      } finally {
        setLoadingTaskIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(taskId)
          return newSet
        })
      }
      return
    }
    
    // If task is partial and not done, show partial completion dialog
    if (task.partial && !task.done) {
      setSelectedTask(task)
      setShowPartialCompletionDialog(true)
      return
    }
    
    // Mark task as done
    setLoadingTaskIds(prev => new Set(prev).add(taskId))

    try {
      const finalSeconds = focusSessionStore.finalizeTaskTime(taskId)
      await updateTask.mutateAsync({ id: taskId, status: 'completed' })
      focusSessionStore.markTaskDone(taskId)
      // Unlock any tasks that depend on this one
      focusSessionStore.unlockDependentTasks(taskId)
      focusSessionStore.autoAdvanceActiveTask()
      syncTaskProgress()
      promptBreak(task.title, finalSeconds)
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setLoadingTaskIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }

  const handleTaskHold = async (taskId: string) => {
    const task = focusSessionStore.plannedTasks.find(t => t.taskId === taskId)
    
    if (!task || task.partial || task.done) return
    
    // For non-partial tasks, we want to open the partial completion dialog
    // but we need to modify the task to act like a partial task temporarily
    setSelectedTask(task)
    setShowPartialCompletionDialog(true)
  }

  const handleTaskClick = (task: PlannedTask) => {
    setSelectedTask(task);
    setShowTaskOverview(true);
  };

  const handleStopClick = () => {
    setShowStopConfirmDialog(true)
  }

  const handleStopConfirm = async () => {
    setShowStopConfirmDialog(false)
    await handleStop()
  }

  const handleStop = async () => {
    const endTime = new Date()

    // Freeze whatever task is still actively being timed so its partial progress up to
    // this moment is captured, then re-read state fresh (the destructured store value
    // above this render hasn't picked up that mutation yet).
    const stillActive = focusSessionStore.plannedTasks.find(t => t.activeStartedAt)
    if (stillActive) {
      focusSessionStore.finalizeTaskTime(stillActive.taskId)
    }

    // Snapshot planned tasks before clearing session store
    const plannedTasksSnapshot = [...useFocusSessionStore.getState().plannedTasks]
    const savedSessionId = focusSessionStore.focusSessionId

    // The row already exists from the moment the run started (see handleStartWork in
    // the Home page) — finishing is just marking it completed, not creating it.
    if (savedSessionId) {
      try {
        await updateFocusSession.mutateAsync({
          id: savedSessionId,
          status: 'completed',
          end_time: toUtcString(endTime),
          planned_tasks: plannedTasksSnapshot as unknown as Record<string, unknown>[],
        })
      } catch (error) {
        console.error('Failed to update session:', error)
      }
    }

    // Write per-task outcome logs
    if (savedSessionId && plannedTasksSnapshot.length > 0) {
      try {
        const taskIds = plannedTasksSnapshot.map(t => t.taskId)
        const supabase = createClient()
        const { data: dbTasks } = await supabase
          .from('tasks')
          .select('id, status')
          .in('id', taskIds)

        const statusMap = new Map((dbTasks ?? []).map((t: { id: string; status: string | null }) => [t.id, t.status]))

        const logs = plannedTasksSnapshot.map(task => {
          let outcome: 'completed' | 'partial' | 'skipped'
          if (!task.done) {
            outcome = 'skipped'
          } else if (statusMap.get(task.taskId) === 'completed') {
            outcome = 'completed'
          } else {
            outcome = 'partial'
          }
          return {
            session_id: savedSessionId!,
            task_id: task.taskId,
            task_title: task.title,
            project_id: task.projectId ?? null,
            project_name: task.projectName ?? null,
            outcome,
            scheduled_minutes: task.scheduledMinutes,
            actual_minutes: outcome !== 'skipped' ? Math.round((task.bankedSeconds ?? 0) / 60) : null,
          }
        })

        await insertSessionTaskLogs(logs)
      } catch (error) {
        console.error('Failed to write session task logs:', error)
      }
    }
    
    focusSessionStore.clearFocusSession()

    // Trigger planner re-run after session ends
    triggerReplan()

    // runEnded=1 tells Home to show a toast confirming how much of today's budget is
    // left now that this run's actual elapsed time has been subtracted (see the
    // dynamic-budget effect in src/app/(main)/page.tsx).
    router.push('/?runEnded=1')
  }

  const handleEndWithoutSaving = async () => {
    const sessionId = focusSessionStore.focusSessionId

    focusSessionStore.clearFocusSession()
    triggerReplan()
    router.push('/?runEnded=1')

    // Mark it abandoned server-side (fire-and-forget, after navigating away) so any
    // other device sees the run actually ended instead of being stuck showing it —
    // previously this was a purely local wipe with no trace left in the database.
    if (sessionId) {
      try {
        await updateFocusSession.mutateAsync({
          id: sessionId,
          status: 'abandoned',
          end_time: toUtcString(new Date()),
        })
      } catch (error) {
        console.error('Failed to mark session abandoned:', error)
      }
    }
  }

  const handleUpdateEstimatedTime = async (remainingMinutes: number) => {
    if (!selectedTask) return

    const newEstimatedMinutes = remainingMinutes

    try {
      const finalSeconds = focusSessionStore.finalizeTaskTime(selectedTask.taskId)
      await updateTask.mutateAsync({
        id: selectedTask.taskId,
        estimated_minutes: newEstimatedMinutes
      })

      focusSessionStore.markTaskDone(selectedTask.taskId)
      // Unlock any tasks that depend on this one
      focusSessionStore.unlockDependentTasks(selectedTask.taskId)
      focusSessionStore.autoAdvanceActiveTask()
      syncTaskProgress()
      promptBreak(selectedTask.title, finalSeconds)
    } catch (error) {
      console.error('Failed to update task estimated time:', error)
    }
  }

  const handleMarkTaskComplete = async () => {
    if (!selectedTask) return

    setLoadingTaskIds(prev => new Set(prev).add(selectedTask.taskId))

    try {
      const finalSeconds = focusSessionStore.finalizeTaskTime(selectedTask.taskId)
      await updateTask.mutateAsync({ id: selectedTask.taskId, status: 'completed' })
      focusSessionStore.markTaskDone(selectedTask.taskId)
      // Unlock any tasks that depend on this one
      focusSessionStore.unlockDependentTasks(selectedTask.taskId)
      focusSessionStore.autoAdvanceActiveTask()
      syncTaskProgress()
      promptBreak(selectedTask.title, finalSeconds)
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setLoadingTaskIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(selectedTask.taskId)
        return newSet
      })
    }
  }

  const handlePartialCompletionForNonPartialTask = async (remainingMinutes: number) => {
    if (!selectedTask) return

    const newEstimatedMinutes = remainingMinutes

    try {
      const finalSeconds = focusSessionStore.finalizeTaskTime(selectedTask.taskId)
      // Update the task's estimated time
      await updateTask.mutateAsync({
        id: selectedTask.taskId,
        estimated_minutes: newEstimatedMinutes
      })

      // Mark the task as done in the current session (but not completed in the database)
      focusSessionStore.markTaskDone(selectedTask.taskId)
      focusSessionStore.autoAdvanceActiveTask()
      syncTaskProgress()
      promptBreak(selectedTask.title, finalSeconds)
    } catch (error) {
      console.error('Failed to update task estimated time:', error)
    }
  }

  return (
    <AppShell showTabBar={false}>
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-bg-primary relative">
      {/* Floating X button - Top left corner */}
      <button
        onClick={() => setShowConfirmDialog(true)}
        className="fixed top-4 left-4 w-12 h-12 bg-bg-primary/50 backdrop-blur-sm rounded-full flex items-center justify-center text-accent-pink hover:bg-bg-primary/70 hover:opacity-80 transition-all z-50 border border-accent-pink/20"
      >
        <X size={20} />
      </button>

      {/* Pause/Resume button - Top right corner */}
      <button
        onClick={handleTogglePause}
        disabled={isTogglingPause}
        className="fixed top-4 right-4 w-12 h-12 bg-bg-primary/50 backdrop-blur-sm rounded-full flex items-center justify-center text-text-primary hover:bg-bg-primary/70 hover:opacity-80 transition-all z-50 border border-cta-outline/20 disabled:opacity-40"
      >
        {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
      </button>

      {/* Timer display */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center mt-32">
        <div className="text-[11px] font-extrabold tracking-[0.14em] text-text-sec uppercase mb-2">
          {isPaused ? 'Paused' : 'Run in progress'}
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-text-sec' : 'bg-accent-pink animate-pulse'}`}></div>
          <div className="text-text-primary text-5xl font-bold">
            {formatTime(elapsedSeconds)}
          </div>
        </div>
        {xpSoFar > 0 && (
          <div className="mt-3 text-xs font-bold text-accent-yellow bg-accent-yellow/10 px-3.5 py-1.5 rounded-full">
            &#9889; +{xpSoFar} XP so far this run
          </div>
        )}
        {activeTask && (
          <div className="mt-3 flex items-center gap-2 bg-bg-card border border-border-card rounded-xl px-3 py-2 max-w-[280px]">
            <Timer size={14} className="text-accent-yellow flex-shrink-0" />
            <span className="text-text-sec text-xs truncate min-w-0 flex-1">
              Now timing &middot; {activeTask.title}
            </span>
            <span className="text-accent-yellow text-sm font-bold font-mono tabular-nums flex-shrink-0">
              {formatLap(activeTaskSeconds)}
            </span>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 mt-12">
        <Reorder.Group
          as="div"
          axis="y"
          values={focusSessionStore.plannedTasks}
          onReorder={focusSessionStore.setPlannedTasksOrder}
          className="space-y-3 max-w-full"
        >
          {focusSessionStore.plannedTasks.map((task, index) => {
            // Compute chain metadata on-the-fly if missing (for backward compatibility)
            const enhancedTask = {
              ...task,
              isPartOfChain: task.isPartOfChain ?? (task.dependsOnTaskId != null || focusSessionStore.plannedTasks.some(t => t.dependsOnTaskId === task.taskId)),
              chainPosition: task.chainPosition ?? (task.dependsOnTaskId != null ? index : 0),
              isLocked: task.isLocked ?? (task.dependsOnTaskId != null && focusSessionStore.plannedTasks.find(t => t.taskId === task.dependsOnTaskId)?.done !== true),
            };

            // Live adjacency, not the planner's static chainPosition — so the connector
            // line honestly reflects reality (and just disappears) if a drag ever
            // separates a chained task from the task right above it.
            const prevTask = index > 0 ? focusSessionStore.plannedTasks[index - 1] : undefined;
            const showChainConnector = !!task.dependsOnTaskId && prevTask?.taskId === task.dependsOnTaskId;

            const isActive = !!task.activeStartedAt;
            const elapsedSeconds = task.done || isActive
              ? focusSessionStore.getTaskElapsedSeconds(task.taskId)
              : undefined;

            return (
              <FocusTaskCard
                key={task.taskId}
                task={enhancedTask}
                onCheckmark={() => handleTaskCheckmark(task.taskId)}
                onClick={() => handleTaskClick(task)}
                onDragEnd={() => syncTaskProgress()}
                isLoading={loadingTaskIds.has(task.taskId)}
                xpReward={xpForTask(task)}
                showChainConnector={showChainConnector}
                isActive={isActive}
                elapsedSeconds={elapsedSeconds}
                onActivate={
                  !task.done && !isActive && !enhancedTask.isLocked
                    ? () => handleActivateTask(task.taskId)
                    : undefined
                }
              />
            );
          })}
        </Reorder.Group>
      </div>

      {/* Stop button */}
      <button
        onClick={handleStopClick}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[72px] h-[72px] bg-accent-pink rounded-none flex items-center justify-center text-on-dark-accent border border-cta-outline"
      >
        <Square size={32} fill="currentColor" />
      </button>

      {/* Stop confirmation dialog */}
      {showStopConfirmDialog && (
        <div className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-[100]">
          <div className="bg-bg-card rounded-2xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-xl font-semibold mb-2">Finish this run?</h2>
            <p className="text-disabled-text mb-6">This run will be saved and completed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStopConfirmDialog(false)}
                className="flex-1 px-4 py-2 border border-border-card rounded-lg text-text-sec hover:bg-bg-card-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStopConfirm}
                className="flex-1 px-4 py-2 bg-accent-pink text-on-dark-accent font-bold rounded-lg hover:bg-accent-pink/90 transition-colors"
              >
                Finish Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-[100]">
          <div className="bg-bg-card rounded-2xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-xl font-semibold mb-2">End this run?</h2>
            <p className="text-disabled-text mb-6">This run won't be saved.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 px-4 py-2 border border-border-card rounded-lg text-text-sec hover:bg-bg-card-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEndWithoutSaving}
                className="flex-1 px-4 py-2 bg-accent-pink text-on-dark-accent font-bold rounded-lg hover:bg-accent-pink/90 transition-colors"
              >
                End without saving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial task completion dialog */}
      {selectedTask && (
        <PartialTaskCompletionDialog
          task={selectedTask}
          isOpen={showPartialCompletionDialog}
          onClose={() => {
            setShowPartialCompletionDialog(false)
            setSelectedTask(null)
          }}
          onUpdateEstimatedTime={handleUpdateEstimatedTime}
          onMarkComplete={handleMarkTaskComplete}
          onPartialCompletionForNonPartialTask={handlePartialCompletionForNonPartialTask}
        />
      )}

      {/* Task overview dialog */}
      {showTaskOverview && selectedTask && (
        <TaskOverviewDialog
          isOpen={showTaskOverview}
          onClose={() => setShowTaskOverview(false)}
          task={selectedTask}
          onMarkPartial={
            !selectedTask.done && !selectedTask.partial
              ? () => {
                  setShowTaskOverview(false)
                  handleTaskHold(selectedTask.taskId)
                }
              : undefined
          }
        />
      )}

      {/* Break suggestion toast — appearing never pauses anything on its own; only the
       * action button does, by reusing the same pause control as the top-right button. */}
      <SimpleToast
        isVisible={!!breakToast}
        message={breakToast ?? ''}
        type="info"
        duration={15000}
        onDismiss={() => setBreakToast(null)}
        action={{
          label: 'Pause',
          onClick: () => {
            setBreakToast(null)
            handleTogglePause()
          },
        }}
      />
    </div>
    </AppShell>
  )
}
