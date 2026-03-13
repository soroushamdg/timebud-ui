import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toUtcString } from '@/lib/dates'
import { DbFocusSession } from '@/types/database'
import { useReplan } from '@/contexts/ReplanContext'

type FocusSession = DbFocusSession
type FocusSessionInsert = Omit<DbFocusSession, 'id' | 'user_id'>
type FocusSessionUpdate = Partial<Omit<DbFocusSession, 'id' | 'user_id'>>

export const useLatestUnfinishedFocusSession = () => {
  return useQuery({
    queryKey: ['sessions', 'unfinished'],
    queryFn: async (): Promise<FocusSession | null> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data || null
    },
  })
}

export const useFocusSessions = () => {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async (): Promise<FocusSession[]> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export const useCreateFocusSession = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (focusSession: Omit<FocusSessionInsert, 'start_time'>) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      const focusSessionData = {
        ...focusSession,
        user_id: user.id,
        start_time: toUtcString(new Date()),
      }
      
      const { data, error } = await supabase
        .from('sessions')
        .insert(focusSessionData)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}

export const useUpdateFocusSession = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...fields }: FocusSessionUpdate & { id: string }) => {
      const supabase = createClient()
      const updateData = {
        ...fields,
      }
      
      const { data, error } = await supabase
        .from('sessions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}

export const useCreateCompletedFocusSession = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (focusSession: FocusSessionInsert) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      const focusSessionData = {
        ...focusSession,
        user_id: user.id,
      }
      
      const { data, error } = await supabase
        .from('sessions')
        .insert(focusSessionData)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}

export const useDeleteFocusSession = () => {
  const queryClient = useQueryClient()
  const { triggerReplan } = useReplan()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      triggerReplan()
    },
  })
}
