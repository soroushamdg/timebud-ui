import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toUtcString } from '@/lib/dates'
import { DbFocusSession, DbSessionTaskLog } from '@/types/database'
import { useReplan } from '@/contexts/ReplanContext'

type FocusSession = DbFocusSession
type FocusSessionInsert = Omit<DbFocusSession, 'id' | 'user_id'>
type FocusSessionUpdate = Partial<Omit<DbFocusSession, 'id' | 'user_id'>>

export type SessionTaskLogInsert = Omit<DbSessionTaskLog, 'id' | 'created_at'>

export async function insertSessionTaskLogs(logs: SessionTaskLogInsert[]): Promise<void> {
  if (logs.length === 0) return
  const supabase = createClient()
  const { error } = await supabase
    .from('session_task_logs')
    .insert(logs)
  if (error) throw error
}

export const useSessionsWithLogs = () => {
  return useQuery({
    queryKey: ['sessions', 'with-logs'],
    queryFn: async (): Promise<{ sessions: FocusSession[]; taskLogsBySessionId: Map<string, DbSessionTaskLog[]> }> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { sessions: [], taskLogsBySessionId: new Map() }

      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
      if (sessionsError) throw sessionsError

      if (!sessions || sessions.length === 0) {
        return { sessions: [], taskLogsBySessionId: new Map() }
      }

      const sessionIds = sessions.map(s => s.id)
      const { data: taskLogs, error: logsError } = await supabase
        .from('session_task_logs')
        .select('*')
        .in('session_id', sessionIds)
      if (logsError) throw logsError

      const taskLogsBySessionId = new Map<string, DbSessionTaskLog[]>()
      for (const log of taskLogs ?? []) {
        if (!taskLogsBySessionId.has(log.session_id)) {
          taskLogsBySessionId.set(log.session_id, [])
        }
        taskLogsBySessionId.get(log.session_id)!.push(log)
      }

      return { sessions, taskLogsBySessionId }
    },
  })
}

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
