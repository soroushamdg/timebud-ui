import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { DbUserAISettings } from '@/types/database'

export function useAISettings() {
  return useQuery({
    queryKey: ['ai-settings'],
    queryFn: async (): Promise<DbUserAISettings | null> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('user_ai_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data
    },
  })
}

export function useUpsertAISettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Omit<DbUserAISettings, 'user_id'>) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('user_ai_settings')
        .upsert({
          user_id: user.id,
          ...settings,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
    },
  })
}
