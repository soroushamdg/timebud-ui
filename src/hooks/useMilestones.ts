import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { DbMilestone } from '@/types/database'

type Milestone = DbMilestone

export const useMilestones = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async (): Promise<Milestone[]> => {
      if (!projectId) return []
      const supabase = createClient()
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('order', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
