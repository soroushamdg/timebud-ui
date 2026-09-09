import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { DbGoogleCalendarSource } from '@/types/database'
import { DAY_CALENDAR_QUERY_KEY } from '@/hooks/useDayCalendar'

export const CALENDAR_SOURCES_QUERY_KEY = 'calendar-sources'

// Every calendar on the connected Google account, as recorded by the last sync.
export function useCalendarSources() {
  return useQuery({
    queryKey: [CALENDAR_SOURCES_QUERY_KEY],
    queryFn: async (): Promise<DbGoogleCalendarSource[]> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('google_calendar_sources')
        .select('*')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('summary', { ascending: true })

      if (error) throw error
      return data || []
    },
  })
}

// Whether a calendar's events count as busy time. Turning one off takes effect at once
// (the day calendar filters muted sources); turning one on lands with the next sync.
export function useSetCalendarSourceBusy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ calendarId, isBusySource }: { calendarId: string; isBusySource: boolean }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('google_calendar_sources')
        .update({ is_busy_source: isBusySource })
        .eq('user_id', user.id)
        .eq('calendar_id', calendarId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CALENDAR_SOURCES_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: [DAY_CALENDAR_QUERY_KEY] })
    },
  })
}
