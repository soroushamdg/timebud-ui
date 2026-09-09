import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchDayCalendar, isCalendarStale, DayCalendarResult } from '@/lib/google-calendar/dayCalendar'
import { useAISettings } from '@/hooks/useAISettings'

export const DAY_CALENDAR_QUERY_KEY = 'day-calendar'

// The planner's and Home's shared view of the calendar for `days` local days starting
// today, read from the local caches. Polls because blocks start and end on their own
// schedule, not on user action.
export function useDayCalendar(days = 1) {
  const settings = useAISettings()
  const timezone = settings.data?.timezone || 'UTC'

  const query = useQuery({
    queryKey: [DAY_CALENDAR_QUERY_KEY, days, timezone],
    queryFn: async (): Promise<DayCalendarResult> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { connected: false, lastSyncedAt: null, days: [] }
      return fetchDayCalendar(supabase, user.id, new Date(), timezone, days)
    },
    refetchInterval: 60_000,
    // Wait for the settings row so the first fetch buckets by the user's real timezone
    // rather than UTC and then refetching.
    enabled: !settings.isLoading && !!timezone,
  })

  const connected = query.data?.connected ?? false
  const lastSyncedAt = query.data?.lastSyncedAt ?? null

  return {
    ...query,
    connected,
    lastSyncedAt,
    isStale: connected && isCalendarStale(lastSyncedAt),
    today: query.data?.days[0],
  }
}
