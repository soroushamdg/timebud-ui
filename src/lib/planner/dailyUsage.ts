import { getLocalDateString } from '@/lib/dates'
import { DbFocusSession } from '@/types/database'

type SessionForUsage = Pick<DbFocusSession, 'start_time' | 'end_time' | 'total_paused_seconds' | 'status'>

export interface UsageInterval {
  startTime: string
  endTime: string
}

// Same elapsed-time formula the live run screen uses for its own timer (see
// getElapsedTime in src/stores/sessionStore.ts) — wall clock minus paused time.
export function getSessionElapsedMinutes(session: Pick<DbFocusSession, 'start_time' | 'end_time' | 'total_paused_seconds'>): number {
  if (!session.start_time || !session.end_time) return 0
  const rawMinutes =
    (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 60000 -
    (session.total_paused_seconds ?? 0) / 60
  return Math.max(0, rawMinutes)
}

// Wall-clock minutes of a session that fall inside any of the given intervals
// (overlaps between intervals are merged first, so a minute never counts twice).
function overlapMinutes(session: Pick<DbFocusSession, 'start_time' | 'end_time'>, intervals: UsageInterval[]): number {
  if (!session.start_time || !session.end_time || intervals.length === 0) return 0
  const s = new Date(session.start_time).getTime()
  const e = new Date(session.end_time).getTime()
  const sorted = intervals
    .map((i) => ({ start: new Date(i.startTime).getTime(), end: new Date(i.endTime).getTime() }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start)
  let total = 0
  let cursor = s
  for (const i of sorted) {
    const start = Math.max(i.start, cursor)
    const end = Math.min(i.end, e)
    if (end > start) {
      total += end - start
      cursor = end
    }
  }
  return total / 60000
}

// Sums actual elapsed time across every run that finished (completed or abandoned —
// both mean real time was spent, regardless of whether the run's tasks were saved)
// today, in the given IANA timezone. A run is attributed to the local calendar date
// its start_time falls on.
//
// `excludeIntervals` (today's calendar blocks) removes the part of a run that happened
// inside a block: that time belongs to the block's mission, not to the free-time
// budget this number is subtracted from.
export function getTodayUsedMinutes(
  sessions: SessionForUsage[],
  timezone: string,
  now: Date = new Date(),
  excludeIntervals: UsageInterval[] = []
): number {
  const todayStr = getLocalDateString(now, timezone)
  const total = sessions
    .filter((s) => (s.status === 'completed' || s.status === 'abandoned') && s.start_time)
    .filter((s) => getLocalDateString(new Date(s.start_time as string), timezone) === todayStr)
    .reduce((sum, s) => sum + Math.max(0, getSessionElapsedMinutes(s) - overlapMinutes(s, excludeIntervals)), 0)
  return Math.round(total)
}
