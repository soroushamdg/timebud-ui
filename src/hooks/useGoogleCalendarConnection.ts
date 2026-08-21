import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { DbGoogleCalendarConnection } from '@/types/database'

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

  return {
    connection: query.data,
    isConnected: !!query.data,
    isLoading: query.isLoading,
    connect,
    disconnect,
  }
}
