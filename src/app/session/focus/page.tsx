'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Square } from 'lucide-react'
import { useFocusSessionStore } from '@/stores/sessionStore'
import { useUpdateTask } from '@/hooks/useTasks'
import { useUpdateFocusSession, useCreateFocusSession, useCreateCompletedFocusSession } from '@/hooks/useSessions'
import { toUtcString } from '@/lib/dates'
import { PlannedTask } from '@/stores/sessionStore'
import { FocusTaskCard } from '@/components/tasks/FocusTaskCard'
import { useFocusSessionGuard } from '@/hooks/useSessionGuard'

export default function FocusSession() {
  const router = useRouter()
  const focusSessionStore = useFocusSessionStore()
  const updateTask = useUpdateTask()
  const updateFocusSession = useUpdateFocusSession()
  const createFocusSession = useCreateFocusSession()
  const createCompletedFocusSession = useCreateCompletedFocusSession()
  
  // Focus session guard - allow this page but redirect if no active focus session
  useFocusSessionGuard(true);
  
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showStopConfirmDialog, setShowStopConfirmDialog] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [loadingTaskIds, setLoadingTaskIds] = useState<Set<string>>(new Set())
  
  const timerStartRef = useRef(new Date())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const startTimer = () => {
    // Don't set new start time if session was already running (resuming)
    if (!focusSessionStore.sessionStartTime) {
      timerStartRef.current = new Date()
      focusSessionStore.startTimer()
    } else {
      // Use existing start time for resumed sessions (handle both Date and string)
      const startTime = typeof focusSessionStore.sessionStartTime === 'string' 
        ? new Date(focusSessionStore.sessionStartTime) 
        : focusSessionStore.sessionStartTime;
      timerStartRef.current = startTime;
    }
    intervalRef.current = setInterval(() => {
      tickTimer()
    }, 1000)
  }

  const tickTimer = () => {
    const now = new Date()
    const elapsed = Math.floor((now.getTime() - timerStartRef.current.getTime()) / 1000)
    setElapsedSeconds(elapsed)
  }

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const sec = seconds % 60
    return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const handleTaskCheckmark = async (taskId: string) => {
    setLoadingTaskIds(prev => new Set(prev).add(taskId))
    
    try {
      await updateTask.mutateAsync({ id: taskId, status: 'completed' })
      focusSessionStore.markTaskDone(taskId)
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

  const handleTaskClick = (projectId: string | null) => {
    if (projectId) {
      router.push('/projects/' + projectId)
    }
  }

  const handleStopClick = () => {
    setShowStopConfirmDialog(true)
  }

  const handleStopConfirm = async () => {
    setShowStopConfirmDialog(false)
    await handleStop()
  }

  const handleStop = async () => {
    clearTimer()
    const endTime = new Date()
    
    // Only save to database if session was actually started (has a real session ID)
    if (focusSessionStore.focusSessionId && !focusSessionStore.focusSessionId.startsWith('local-')) {
      try {
        await updateFocusSession.mutateAsync({
          id: focusSessionStore.focusSessionId,
          start_time: toUtcString(timerStartRef.current),
          end_time: toUtcString(endTime)
        })
      } catch (error) {
        console.error('Failed to update session:', error)
      }
    } else if (focusSessionStore.focusSessionId && focusSessionStore.focusSessionId.startsWith('local-')) {
      // Create and save session to database only now that it's completed
      try {
        const completedSession = await createCompletedFocusSession.mutateAsync({
          budget_minutes: focusSessionStore.budgetMinutes,
          tasks_list: focusSessionStore.plannedTasks.map(t => t.taskId),
          start_time: toUtcString(timerStartRef.current),
          end_time: toUtcString(endTime)
        })
        console.log('Session saved to database:', completedSession)
      } catch (error) {
        console.error('Failed to create completed session:', error)
      }
    }
    
    focusSessionStore.clearFocusSession()
    router.push('/')
  }

  const handleEndWithoutSaving = () => {
    clearTimer()
    focusSessionStore.clearFocusSession()
    router.push('/')
  }

  useEffect(() => {
    // Resume timer if session was running
    if (focusSessionStore.timerRunning && focusSessionStore.sessionStartTime) {
      // Ensure sessionStartTime is a Date object
      const startTime = typeof focusSessionStore.sessionStartTime === 'string' 
        ? new Date(focusSessionStore.sessionStartTime) 
        : focusSessionStore.sessionStartTime;
      
      // Calculate elapsed time since session started
      const elapsed = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
      setElapsedSeconds(elapsed);
      startTimer();
    }
    return () => {
      clearTimer();
    };
  }, [focusSessionStore.timerRunning, focusSessionStore.sessionStartTime]);

  return (
    <div className="min-h-screen bg-black relative">
      {/* Floating X button - Top left corner */}
      <button
        onClick={() => setShowConfirmDialog(true)}
        className="fixed top-4 left-4 w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-accent-pink hover:bg-black/70 hover:opacity-80 transition-all z-50 border border-accent-pink/20"
      >
        <X size={20} />
      </button>

      {/* Timer display */}
      <div className="flex flex-col items-center justify-center mt-32">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-accent-pink rounded-full"></div>
          <div className="text-white text-5xl font-bold">
            {formatTime(elapsedSeconds)}
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="px-4 mt-12 max-h-[calc(100vh-300px)] overflow-y-auto">
        <div className="space-y-3">
          {focusSessionStore.plannedTasks.map((task) => (
            <FocusTaskCard
              key={task.taskId}
              task={task}
              onCheckmark={() => handleTaskCheckmark(task.taskId)}
              onClick={() => handleTaskClick(task.projectId)}
              isLoading={loadingTaskIds.has(task.taskId)}
            />
          ))}
        </div>
      </div>

      {/* Stop button */}
      <button
        onClick={handleStopClick}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[72px] h-[72px] bg-accent-pink rounded-none flex items-center justify-center text-white border border-[#ffffff]"
      >
        <Square size={32} fill="currentColor" />
      </button>

      {/* Stop confirmation dialog */}
      {showStopConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card rounded-2xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-xl font-semibold mb-2">Finish session?</h2>
            <p className="text-gray-400 mb-6">This session will be saved and completed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStopConfirmDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStopConfirm}
                className="flex-1 px-4 py-2 bg-accent-pink text-white font-bold rounded-lg hover:bg-accent-pink/90 transition-colors"
              >
                Finish Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card rounded-2xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-xl font-semibold mb-2">End session?</h2>
            <p className="text-gray-400 mb-6">This session won't be saved.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEndWithoutSaving}
                className="flex-1 px-4 py-2 bg-accent-pink text-white font-bold rounded-lg hover:bg-accent-pink/90 transition-colors"
              >
                End without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
