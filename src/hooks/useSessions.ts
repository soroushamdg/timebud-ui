import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toUtcString } from '@/lib/dates'
import { DbFocusSession, DbSessionTaskLog } from '@/types/database'
import { useReplan } from '@/contexts/ReplanContext'
import { useFocusSessionStore, PlannedTask } from '@/stores/sessionStore'

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

      // Before sessions gained live status (see useActiveFocusSession), end_time being
      // null only ever meant "abandoned mid-run" — rows were written retroactively at
      // stop time. Now a row is created at start and stays end_time=null for the whole
      // run, so a currently running/paused session matches too unless excluded here;
      // that case is handled separately by useActiveFocusSession's auto-resume, not by
      // this "you left something unfinished" prompt.
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .is('end_time', null)
        .neq('status', 'running')
        .neq('status', 'paused')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data || null
    },
  })
}

// The session a run screen on any device should attach to: whichever row is still
// running or paused. There is at most one per user (enforced client-side in
// handleStartWork, since a plain unique-partial-index would also need to exclude
// abandoned/completed rows).
export const useActiveFocusSession = () => {
  return useQuery({
    queryKey: ['sessions', 'active'],
    queryFn: async (): Promise<FocusSession | null> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['running', 'paused'])
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data || null
    },
    // Realtime (useFocusSessionRealtime) is the primary propagation path across
    // devices; this interval is only a fallback for when that channel silently drops
    // (e.g. after a laptop sleep/wake or a flaky connection).
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })
}

// Subscribes to live changes on the signed-in user's session rows so that pausing,
// resuming, stopping, or checking off a task on one device is reflected on every other
// device within about a second, instead of only on the next reload or poll tick. Mount
// once near the app root (see Providers.tsx) so it's active even when the run screen
// itself isn't mounted, e.g. so Home notices a run that started on another device.
export const useFocusSessionRealtime = (userId: string | undefined) => {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`sessions-sync-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as FocusSession | undefined
          if (!row) return

          const isActive = payload.eventType !== 'DELETE' && (row.status === 'running' || row.status === 'paused')
          queryClient.setQueryData(['sessions', 'active'], isActive ? row : null)
          queryClient.invalidateQueries({ queryKey: ['sessions'] })

          if (isActive) {
            useFocusSessionStore.getState().applyServerSnapshot({
              id: row.id,
              status: row.status,
              start_time: row.start_time,
              paused_at: row.paused_at,
              total_paused_seconds: row.total_paused_seconds,
              budget_minutes: row.budget_minutes,
              planned_tasks: row.planned_tasks as unknown as PlannedTask[],
            })
          } else if (useFocusSessionStore.getState().focusSessionId === row.id) {
            // The active session we were tracking just ended (or was abandoned) from
            // another device — clear it here too so this device isn't stuck showing it.
            useFocusSessionStore.getState().clearFocusSession()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient])
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

// Unused by the main app tree since sessions are now created at start time (see
// useCreateFocusSession's call site in the Home page) rather than retroactively at
// stop time. Kept only because the frozen src/app/v1 duplicate of the focus-run screen
// still imports it and hasn't been migrated to the new flow — its insert predates the
// status/paused_at/total_paused_seconds/planned_tasks columns, so those are left
// optional here and simply fall back to their DB column defaults.
type LegacyFocusSessionInsert = Partial<FocusSessionInsert> & Pick<FocusSessionInsert, 'budget_minutes' | 'tasks_list'>

export const useCreateCompletedFocusSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (focusSession: LegacyFocusSessionInsert) => {
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
