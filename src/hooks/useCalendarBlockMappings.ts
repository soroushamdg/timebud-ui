import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { DbCalendarBlockMapping } from '@/types/database'

// Fetches mappings and their linked missions as two separate queries, then attaches
// client-side — the same split-then-attach pattern already used for task dependencies
// in `src/hooks/useTasks.ts`, rather than a Postgres view/RPC for a simple join.
export function useCalendarBlockMappings() {
  return useQuery({
    queryKey: ['calendar-block-mappings'],
    queryFn: async (): Promise<DbCalendarBlockMapping[]> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data: mappings, error } = await supabase
        .from('calendar_block_mappings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!mappings || mappings.length === 0) return []

      const { data: links } = await supabase
        .from('calendar_block_mission_links')
        .select('mapping_id, project_id')
        .in('mapping_id', mappings.map((m) => m.id))

      const linksByMapping = new Map<string, string[]>()
      for (const link of links || []) {
        if (!linksByMapping.has(link.mapping_id)) linksByMapping.set(link.mapping_id, [])
        linksByMapping.get(link.mapping_id)!.push(link.project_id)
      }

      return mappings.map((m) => ({ ...m, project_ids: linksByMapping.get(m.id) || [] }))
    },
  })
}

// Confirms (or edits) which mission(s) a calendar-event title maps to — one block
// title can cover several missions (e.g. a "Study" block spanning multiple subjects).
export function useConfirmBlockMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ eventTitle, projectIds }: { eventTitle: string; projectIds: string[] }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: mapping, error } = await supabase
        .from('calendar_block_mappings')
        .upsert(
          { user_id: user.id, event_title: eventTitle, confirmed: true },
          { onConflict: 'user_id,event_title' }
        )
        .select()
        .single()

      if (error) throw error

      // Replace the linked missions wholesale — simpler and safer than diffing given
      // these lists are always small (a handful of missions per block at most).
      await supabase.from('calendar_block_mission_links').delete().eq('mapping_id', mapping.id)
      if (projectIds.length > 0) {
        await supabase
          .from('calendar_block_mission_links')
          .insert(projectIds.map((projectId) => ({ mapping_id: mapping.id, project_id: projectId })))
      }

      return mapping
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-block-mappings'] })
    },
  })
}
