import { getLocalDateString } from '@/lib/dates'

export const ACTIVITY_LOOKBACK_MS = 121 * 24 * 60 * 60 * 1000 // covers the 120-day streak walk-back

interface ActivityTask {
  created_at: string | null
}
interface ActivitySession {
  start_time: string | null
}

// Local (YYYY-MM-DD, in `timezone`) dates with any task-created or session-started
// activity — the "did the user touch the app that day" signal shared by the streak
// walk-back (computeCurrentStreak) and the inactivity-nudge notification. Extracted
// from what the cron route (src/app/api/cron/daily-reminder/route.ts) already built
// inline, so any client-side display of the same streak reuses the identical rule.
export function buildActivityDates(
  tasks: ActivityTask[],
  sessions: ActivitySession[],
  timezone: string,
  now: Date = new Date()
): Set<string> {
  const lookbackSince = now.getTime() - ACTIVITY_LOOKBACK_MS
  const activityDates = new Set<string>()
  for (const t of tasks) {
    if (t.created_at && new Date(t.created_at).getTime() >= lookbackSince) {
      activityDates.add(getLocalDateString(new Date(t.created_at), timezone))
    }
  }
  for (const s of sessions) {
    if (s.start_time && new Date(s.start_time).getTime() >= lookbackSince) {
      activityDates.add(getLocalDateString(new Date(s.start_time), timezone))
    }
  }
  return activityDates
}
