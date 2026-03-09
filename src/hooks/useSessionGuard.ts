import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFocusSessionStore } from '@/stores/sessionStore'

/**
 * Hook to guard against multiple running focus sessions and auto-redirect to active focus sessions
 */
export const useFocusSessionGuard = (allowSessionPage = false) => {
  const router = useRouter()
  const { focusSessionId, timerRunning, plannedTasks } = useFocusSessionStore()

  useEffect(() => {
    // Check if there's an active running focus session
    const hasActiveFocusSession = focusSessionId && timerRunning && plannedTasks.length > 0
    
    // If we're not on the session page and there's a running focus session, redirect
    if (hasActiveFocusSession && !allowSessionPage) {
      router.push('/session/focus')
      return
    }

    // If we're on the session page but there's no active focus session, redirect to home
    if (!hasActiveFocusSession && allowSessionPage) {
      router.push('/')
      return
    }
  }, [focusSessionId, timerRunning, plannedTasks.length, allowSessionPage, router])

  return {
    hasActiveFocusSession: focusSessionId && timerRunning && plannedTasks.length > 0,
    focusSessionId,
    timerRunning,
    plannedTasksCount: plannedTasks.length
  }
}
