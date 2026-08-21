import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface ActiveCalendarBlock {
  eventId: string
  title: string
  endTime: string
  missionLabel: string
  projectIds: string[]
}

// Polls the local event cache (populated by the calendar-sync cron) for a block that's
// active right now — Home's passive path, complementing the cron's proactive push.
export function useActiveCalendarBlock() {
  return useQuery({
    queryKey: ['active-calendar-block'],
    queryFn: async (): Promise<ActiveCalendarBlock | null> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const nowIso = new Date().toISOString()
      const { data: event } = await supabase
        .from('google_calendar_events_cache')
        .select('*')
        .eq('user_id', user.id)
        .lte('start_time', nowIso)
        .gte('end_time', nowIso)
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!event) return null

      const { data: mapping } = await supabase
        .from('calendar_block_mappings')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_title', event.title)
        .eq('confirmed', true)
        .maybeSingle()
      if (!mapping) return null

      const { data: links } = await supabase
        .from('calendar_block_mission_links')
        .select('project_id')
        .eq('mapping_id', mapping.id)
      const projectIds = (links || []).map((l) => l.project_id as string)
      if (projectIds.length === 0) return null

      const { data: missionRows } = await supabase.from('projects').select('name').in('id', projectIds)
      const missionNames = (missionRows || []).map((p) => p.name as string)
      const missionLabel =
        missionNames.length > 1
          ? `${missionNames.slice(0, -1).join(', ')} & ${missionNames[missionNames.length - 1]}`
          : missionNames[0] || 'Mission'

      return { eventId: event.id, title: event.title, endTime: event.end_time, missionLabel, projectIds }
    },
    // Short-lived — an active block starts/ends on its own schedule, not on user action,
    // so this needs to notice on its own rather than waiting for an unrelated refetch.
    refetchInterval: 60_000,
  })
}
