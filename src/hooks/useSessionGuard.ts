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
  //
  // Deliberately NOT requiring plannedTasks.length > 0 here: that was safe back when
  // focusSessionId and plannedTasks were only ever set together, atomically, by the old
  // local-only setFocusSession. Now that a session can also arrive via applyServerSnapshot
  // from a fetch, a realtime event, or the cross-device join path (handleStartWork's
  // "activeFocusSession" branch), a real running/paused session is active regardless of
  // how many tasks happen to be in its latest synced snapshot — gating on task count here
  // bounced you straight back out of a genuinely active run.
  const hasActiveFocusSession = Boolean(
    focusSessionId && (status === 'running' || status === 'paused')
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
