import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFocusSessionStore } from '@/stores/sessionStore'

/**
 * Hook to guard against multiple running focus sessions and auto-redirect to active focus sessions
 */
export const useFocusSessionGuard = (allowSessionPage = false) => {
  const router = useRouter()
  const { focusSessionId, status, timerRunning, plannedTasks } = useFocusSessionStore()

  // A run counts as active while paused too — only the local `timerRunning` flag
  // (whether the on-screen clock is currently ticking) turns off during a pause, but
  // the run itself (and the guard that keeps you on/off its screen) shouldn't.
  const hasActiveFocusSession = Boolean(
    focusSessionId && (status === 'running' || status === 'paused') && plannedTasks.length > 0
  )

  useEffect(() => {
    // If we're not on the session page and there's an active focus session, redirect —
    // this also fires when a session started on another device gets synced in here.
    if (hasActiveFocusSession && !allowSessionPage) {
      router.push('/session/focus')
      return
    }

    // If we're on the session page but there's no active focus session, redirect to home
    if (!hasActiveFocusSession && allowSessionPage) {
      router.push('/')
      return
    }
  }, [hasActiveFocusSession, allowSessionPage, router])

  return {
    hasActiveFocusSession,
    focusSessionId,
    timerRunning,
    plannedTasksCount: plannedTasks.length
  }
}
