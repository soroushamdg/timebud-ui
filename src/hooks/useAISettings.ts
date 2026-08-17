import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DbUserAISettings } from '@/types/database'
import { useUIStore } from '@/stores/uiStore'

const DEFAULT_AI_SETTINGS = {
  provider: 'anthropic' as const,
  model: 'claude-sonnet-4-20250514',
  thinking_mode: false,
}

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
    // Partial so callers (like the daily-budget dialog) can update a single field
    // without clobbering the rest of the user's AI settings row.
    mutationFn: async (settings: Partial<Omit<DbUserAISettings, 'user_id'>>) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: existing } = await supabase
        .from('user_ai_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      const { data, error } = await supabase
        .from('user_ai_settings')
        .upsert({
          ...DEFAULT_AI_SETTINGS,
          ...existing,
          ...settings,
          user_id: user.id,
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

// Hydrates the client-side daily budget (uiStore) from the persisted
// user_ai_settings.preferred_session_minutes value once, on load. Guarded by a
// ref so it doesn't fight later local edits or re-fire on background refetches.
export function useSyncDailyBudget() {
  const { data: aiSettings } = useAISettings()
  const setPreferredBudgetMinutes = useUIStore((s) => s.setPreferredBudgetMinutes)
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current) return
    if (aiSettings?.preferred_session_minutes == null) return
    hydrated.current = true
    setPreferredBudgetMinutes(aiSettings.preferred_session_minutes)
  }, [aiSettings, setPreferredBudgetMinutes])
}
