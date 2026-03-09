'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Square } from 'lucide-react'
import { useSessionStore } from '@/stores/sessionStore'
import { useUpdateTask } from '@/hooks/useTasks'
import { useUpdateSession, useCreateSession } from '@/hooks/useSessions'
import { toUtcString } from '@/lib/dates'
import { PlannedTask } from '@/stores/sessionStore'
import { FocusTaskCard } from '@/components/tasks/FocusTaskCard'

export default function FocusSession() {
  const router = useRouter()
  const sessionStore = useSessionStore()
  const updateTask = useUpdateTask()
  const updateSession = useUpdateSession()
  const createSession = useCreateSession()
  
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [loadingTaskIds, setLoadingTaskIds] = useState<Set<string>>(new Set())
  
  const timerStartRef = useRef(new Date())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const startTimer = () => {
    timerStartRef.current = new Date()
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
      sessionStore.markTaskDone(taskId)
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

  const handleStop = async () => {
    clearTimer()
    const endTime = new Date()
    
    if (sessionStore.sessionId) {
      try {
        await updateSession.mutateAsync({
          id: sessionStore.sessionId,
          start_time: toUtcString(timerStartRef.current),
          end_time: toUtcString(endTime)
        })
      } catch (error) {
        console.error('Failed to update session:', error)
      }
    }
    
    sessionStore.clearSession()
    
    // Re-run planSession flow - create a new session
    try {
      const newSession = await createSession.mutateAsync({
        budget_minutes: 0,
        tasks_list: [],
        end_time: null
      })
      if (newSession) {
        sessionStore.setSession(newSession.id, [], 0)
      }
    } catch (error) {
      console.error('Failed to create new session:', error)
    }
    
    router.push('/')
  }

  const handleEndWithoutSaving = () => {
    clearTimer()
    sessionStore.clearSession()
    router.push('/')
  }

  useEffect(() => {
    startTimer()
    return () => {
      clearTimer()
    }
  }, [])

  return (
    <div className="min-h-screen bg-black relative">
      {/* X button */}
      <button
        onClick={() => setShowConfirmDialog(true)}
        className="absolute top-6 left-6 text-accent-pink"
        style={{ fontSize: '24px' }}
      >
        <X size={24} />
      </button>

      {/* Timer display */}
      <div className="flex flex-col items-center justify-center mt-32">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-accent-pink rounded-full"></div>
          <div className="text-white text-5xl font-bold">
            {formatTime(elapsedSeconds)}
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="px-4 mt-12 max-h-[calc(100vh-300px)] overflow-y-auto">
        <div className="space-y-3">
          {sessionStore.plannedTasks.map((task) => (
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
        onClick={handleStop}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[72px] h-[72px] bg-accent-pink rounded-2xl flex items-center justify-center text-white"
      >
        <Square size={32} />
      </button>

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
