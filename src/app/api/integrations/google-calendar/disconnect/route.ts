import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revokeToken } from '@/lib/google-calendar/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: connection } = await supabase
    .from('google_calendar_connections')
    .select('access_token')
    .eq('user_id', user.id)
    .maybeSingle()

  if (connection?.access_token) {
    // Best-effort — a revoke failure (e.g. token already expired) shouldn't block
    // removing the local connection record.
    await revokeToken(connection.access_token).catch((err) =>
      console.error('Google token revoke failed:', err)
    )
  }

  const { error } = await supabase
    .from('google_calendar_connections')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
