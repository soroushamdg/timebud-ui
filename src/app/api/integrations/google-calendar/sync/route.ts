import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { syncUserCalendar } from '@/lib/google-calendar/sync'

// Anything more frequent than this is the cron's job — a "Sync now" that lands inside
// the gap just reports the sync that already happened.
const MIN_SYNC_INTERVAL_MS = 60_000

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: connection } = await supabase
    .from('google_calendar_connections')
    .select('last_synced_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!connection) {
    return NextResponse.json({ error: 'Not connected' }, { status: 404 })
  }

  const now = new Date()
  if (
    connection.last_synced_at &&
    now.getTime() - new Date(connection.last_synced_at).getTime() < MIN_SYNC_INTERVAL_MS
  ) {
    return NextResponse.json({ skipped: true, lastSyncedAt: connection.last_synced_at })
  }

  try {
    // Service client: the caches only have select policies for the user, and the sync
    // writes them on the user's behalf exactly as the cron does.
    const counts = await syncUserCalendar(user.id, now, createServiceClient())
    return NextResponse.json({ ...counts, lastSyncedAt: now.toISOString() })
  } catch (err) {
    console.error(`[google-calendar/sync] Failed for user ${user.id}:`, err)
    // Say which side failed. A refresh failure means Google rejected the server's OAuth
    // credentials or the saved token — the fix is in the deployment's env or a
    // reconnect, not "try again"; Google's error bodies carry no secrets.
    const message = err instanceof Error ? err.message : 'Sync failed'
    const isRefresh = /token refresh failed/i.test(message)
    const isGoogle = isRefresh || /^(Failed to (list|fetch)|Google )/i.test(message)
    return NextResponse.json(
      {
        error: isRefresh ? 'google_refresh_failed' : isGoogle ? 'google_error' : 'sync_failed',
        message: isRefresh
          ? `Google refused to renew the connection (${message.replace(/^Google token refresh failed:\s*/i, '').slice(0, 200)}). Check GOOGLE_CALENDAR_CLIENT_ID / GOOGLE_CALENDAR_CLIENT_SECRET on this server, or disconnect and reconnect.`
          : message.slice(0, 300),
      },
      { status: isGoogle ? 502 : 500 }
    )
  }
}
