import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * Hook to guard against multiple running sessions and auto-redirect to active sessions
 */
export const useSessionGuard = (allowSessionPage = false) => {
  const router = useRouter()
  const { sessionId, timerRunning, plannedTasks } = useSessionStore()

  useEffect(() => {
    // Check if there's an active running session
    const hasActiveSession = sessionId && timerRunning && plannedTasks.length > 0
    
    // If we're not on the session page and there's a running session, redirect
    if (hasActiveSession && !allowSessionPage) {
      router.push('/session/focus')
      return
    }

    // If we're on the session page but there's no active session, redirect to home
    if (!hasActiveSession && allowSessionPage) {
      router.push('/')
      return
    }
  }, [sessionId, timerRunning, plannedTasks.length, allowSessionPage, router])

  return {
    hasActiveSession: sessionId && timerRunning && plannedTasks.length > 0,
    sessionId,
    timerRunning,
    plannedTasksCount: plannedTasks.length
  }
}
