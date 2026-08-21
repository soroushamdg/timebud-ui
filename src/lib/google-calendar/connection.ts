import { SupabaseClient } from '@supabase/supabase-js'
import { DbGoogleCalendarConnection } from '@/types/database'
import { refreshAccessToken } from './client'

// Returns a live access token for this user's calendar connection, transparently
// refreshing (and persisting the refreshed token) if the cached one has expired —
// mirrors the look-up-or-create-then-persist shape already used for Stripe customers
// (`src/lib/stripe/customer.ts`), extended with the refresh step calendar tokens need.
export async function getValidAccessToken(
  userId: string,
  supabase: SupabaseClient
): Promise<{ accessToken: string; calendarId: string } | null> {
  const { data: connection } = await supabase
    .from('google_calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<DbGoogleCalendarConnection>()

  if (!connection) return null

  const expiresAt = new Date(connection.token_expiry).getTime()
  const isExpired = Date.now() >= expiresAt - 60_000 // refresh a minute early

  if (!isExpired) {
    return { accessToken: connection.access_token, calendarId: connection.google_calendar_id }
  }

  const refreshed = await refreshAccessToken(connection.refresh_token)
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

  await supabase
    .from('google_calendar_connections')
    .update({ access_token: refreshed.access_token, token_expiry: newExpiry })
    .eq('user_id', userId)

  return { accessToken: refreshed.access_token, calendarId: connection.google_calendar_id }
}
