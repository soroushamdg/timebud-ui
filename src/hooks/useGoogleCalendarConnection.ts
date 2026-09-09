import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { DbGoogleCalendarConnection } from '@/types/database'
import { isCalendarStale } from '@/lib/google-calendar/dayCalendar'

export function useGoogleCalendarConnection() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['google-calendar-connection'],
    queryFn: async (): Promise<DbGoogleCalendarConnection | null> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('google_calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      return data
    },
  })

  const connect = () => {
    window.location.href = '/api/integrations/google-calendar/connect'
  }

  const disconnect = async () => {
    const res = await fetch('/api/integrations/google-calendar/disconnect', { method: 'POST' })
    if (!res.ok) throw new Error('Failed to disconnect Google Calendar')
    await queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] })
  }

  // Manual sync — the server throttles to once a minute and reports `skipped` inside
  // that gap, which still counts as success here (the data is already fresh).
  const sync = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/integrations/google-calendar/sync', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to sync Google Calendar')
      return res.json() as Promise<{ skipped?: boolean; lastSyncedAt: string }>
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] }),
        queryClient.invalidateQueries({ queryKey: ['day-calendar'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-block-mappings'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-sources'] }),
      ])
    },
  })

  const lastSyncedAt = query.data?.last_synced_at ?? null

  return {
    connection: query.data,
    isConnected: !!query.data,
    isLoading: query.isLoading,
    connect,
    disconnect,
    syncNow: () => sync.mutateAsync(),
    isSyncing: sync.isPending,
    lastSyncedAt,
    isStale: !!query.data && isCalendarStale(lastSyncedAt),
  }
}
