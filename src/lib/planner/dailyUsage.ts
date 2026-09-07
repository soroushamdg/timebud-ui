import { getLocalDateString } from '@/lib/dates'
import { DbFocusSession } from '@/types/database'

type SessionForUsage = Pick<DbFocusSession, 'start_time' | 'end_time' | 'total_paused_seconds' | 'status'>

// Same elapsed-time formula the live run screen uses for its own timer (see
// getElapsedTime in src/stores/sessionStore.ts) — wall clock minus paused time.
export function getSessionElapsedMinutes(session: Pick<DbFocusSession, 'start_time' | 'end_time' | 'total_paused_seconds'>): number {
  if (!session.start_time || !session.end_time) return 0
  const rawMinutes =
    (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 60000 -
    (session.total_paused_seconds ?? 0) / 60
  return Math.max(0, rawMinutes)
}

// Sums actual elapsed time across every run that finished (completed or abandoned —
// both mean real time was spent, regardless of whether the run's tasks were saved)
// today, in the given IANA timezone. A run is attributed to the local calendar date
// its start_time falls on.
export function getTodayUsedMinutes(sessions: SessionForUsage[], timezone: string, now: Date = new Date()): number {
  const todayStr = getLocalDateString(now, timezone)
  const total = sessions
    .filter((s) => (s.status === 'completed' || s.status === 'abandoned') && s.start_time)
    .filter((s) => getLocalDateString(new Date(s.start_time as string), timezone) === todayStr)
    .reduce((sum, s) => sum + getSessionElapsedMinutes(s), 0)
  return Math.round(total)
}
