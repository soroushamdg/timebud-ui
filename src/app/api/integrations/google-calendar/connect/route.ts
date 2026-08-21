import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getAuthUrl } from '@/lib/google-calendar/client'

const STATE_COOKIE = 'gcal_oauth_state'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const state = randomBytes(16).toString('hex')
  const cs = await cookies()
  cs.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes — long enough for the consent screen round trip
    path: '/',
  })

  return NextResponse.redirect(getAuthUrl(state))
}
