import { addDays } from 'date-fns'
import { getLocalDateString } from '@/lib/dates'

const STREAK_LOOKBACK_DAYS = 120

// Consecutive local days with activity, walking backward from YESTERDAY (not today —
// "today" isn't finished yet, so it only joins the streak once tomorrow's check runs).
// Extracted from what `buildStreakPayload` (src/lib/notifications/producers.ts) already
// computed inline, so the notification and any UI display share one implementation.
export function computeCurrentStreak(activityDates: Set<string>, now: Date, timezone: string): number {
  let streak = 0
  for (let i = 1; i <= STREAK_LOOKBACK_DAYS; i++) {
    const day = getLocalDateString(addDays(now, -i), timezone)
    if (activityDates.has(day)) streak++
    else break
  }
  return streak
}
