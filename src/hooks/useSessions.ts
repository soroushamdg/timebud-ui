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

// Real time spent on a project, summed across every run it's ever appeared in —
// including runs from finished projects — since session_task_logs.actual_minutes is
// now a genuine per-task measurement rather than a copy of the plan (see the focus
// screen's per-task lap timer). Also breaks the total down per task so the project
// page can show "X spent" next to each job without a second round trip.
export const useProjectTimeStats = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ['sessions', 'project-time-stats', projectId],
    queryFn: async (): Promise<{ actualMinutes: number; perTask: Map<string, number> }> => {
      if (!projectId) return { actualMinutes: 0, perTask: new Map() }

      const supabase = createClient()
      const { data, error } = await supabase
        .from('session_task_logs')
        .select('task_id, actual_minutes')
        .eq('project_id', projectId)
        .neq('outcome', 'skipped')
      if (error) throw error

      const perTask = new Map<string, number>()
      let actualMinutes = 0
      for (const row of data ?? []) {
        const minutes = row.actual_minutes ?? 0
        actualMinutes += minutes
        perTask.set(row.task_id, (perTask.get(row.task_id) ?? 0) + minutes)
      }
      return { actualMinutes, perTask }
    },
    enabled: !!projectId,
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
        // Defense in depth: a row marked running/paused but already ended is a
        // contradiction (e.g. a legacy insert that forgot to set status — see
        // useCreateCompletedFocusSession below) — never treat it as "the active session."
        .is('end_time', null)
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
            // force: true — a live event reporting running/paused is server truth about
            // the current session, and should win over a stale local session id (see
            // sessionStore's applyServerSnapshot for why that guard was blocking sync).
            useFocusSessionStore.getState().applyServerSnapshot({
              id: row.id,
              status: row.status,
              start_time: row.start_time,
              paused_at: row.paused_at,
              total_paused_seconds: row.total_paused_seconds,
              budget_minutes: row.budget_minutes,
              planned_tasks: row.planned_tasks as unknown as PlannedTask[],
            }, { force: true })
          } else if (useFocusSessionStore.getState().focusSessionId === row.id) {
            // The active session we were tracking just ended (or was abandoned) from
            // another device — clear it here too so this device isn't stuck showing it.
            useFocusSessionStore.getState().clearFocusSession()
          }
        }
      )
      .subscribe((status, err) => {
        // Otherwise a dropped/failed channel (expired auth, blocked WebSocket,
        // connection limit) is silently indistinguishable from "working, just relying on
        // the 15s poll fallback" — this at least makes it observable.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error('[useFocusSessionRealtime] channel', status, err)
        }
      })

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
        // Every call site logs an already-finished run retroactively — without this,
        // it falls through to the status column's 'running' default (added by the
        // cross-device-sync migration, after this legacy path was written) despite
        // end_time already being set, creating a permanent phantom "active session"
        // that useActiveFocusSession would surface on every device.
        status: 'completed' as const,
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
