import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toUtcString } from '@/lib/dates'
import { DbSession } from '@/types/database'

type Session = DbSession
type SessionInsert = Omit<DbSession, 'id' | 'user_id'>
type SessionUpdate = Partial<Omit<DbSession, 'id' | 'user_id'>>

export const useLatestUnfinished = () => {
  return useQuery({
    queryKey: ['sessions', 'unfinished'],
    queryFn: async (): Promise<Session | null> => {
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
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data || null
    },
  })
}

export const useSessions = () => {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async (): Promise<Session[]> => {
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

export const useCreateSession = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (session: Omit<SessionInsert, 'start_time'>) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      const sessionData = {
        ...session,
        user_id: user.id,
        start_time: toUtcString(new Date()),
      }
      
      const { data, error } = await supabase
        .from('sessions')
        .insert(sessionData)
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

export const useUpdateSession = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...fields }: SessionUpdate & { id: string }) => {
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

export const useCreateCompletedSession = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (session: SessionInsert) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      const sessionData = {
        ...session,
        user_id: user.id,
      }
      
      const { data, error } = await supabase
        .from('sessions')
        .insert(sessionData)
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

export const useDeleteSession = () => {
  const queryClient = useQueryClient()
  
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
    },
  })
}
