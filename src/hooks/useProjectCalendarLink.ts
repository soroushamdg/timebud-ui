import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// Whether this mission is linked to at least one confirmed calendar time block —
// drives a small badge on Mission Detail, not the block-detection logic itself
// (that lives in useActiveCalendarBlock / the calendar-sync cron).
export function useProjectCalendarLink(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-calendar-link', projectId],
    queryFn: async (): Promise<boolean> => {
      if (!projectId) return false
      const supabase = createClient()

      const { data: links } = await supabase
        .from('calendar_block_mission_links')
        .select('mapping_id')
        .eq('project_id', projectId)
      if (!links || links.length === 0) return false

      const { count } = await supabase
        .from('calendar_block_mappings')
        .select('id', { count: 'exact', head: true })
        .eq('confirmed', true)
        .in('id', links.map((l) => l.mapping_id))

      return (count ?? 0) > 0
    },
    enabled: !!projectId,
  })
}
