import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, findOrCreateDedicatedCalendar } from '@/lib/google-calendar/client'

const STATE_COOKIE = 'gcal_oauth_state'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  const redirectTo = (params: string) => NextResponse.redirect(new URL(`/profile/calendar${params}`, request.url))

  if (oauthError) {
    return redirectTo(`?error=${encodeURIComponent(oauthError)}`)
  }

  const cs = await cookies()
  const expectedState = cs.get(STATE_COOKIE)?.value
  cs.delete(STATE_COOKIE)

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectTo('?error=invalid_state')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return redirectTo('?error=unauthorized')
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      // Google only returns a refresh token on the FIRST consent for a given client/user
      // pair (with prompt=consent this should always happen, but guard anyway — without
      // one we can't keep the connection alive past the initial access token's lifetime).
      return redirectTo('?error=no_refresh_token')
    }

    const calendarId = await findOrCreateDedicatedCalendar(tokens.access_token)
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const { error } = await supabase.from('google_calendar_connections').upsert({
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokenExpiry,
      google_calendar_id: calendarId,
      google_account_email: user.email,
      last_synced_at: null,
    })

    if (error) throw error

    return redirectTo('?connected=true')
  } catch (err) {
    console.error('Google Calendar connect failed:', err)
    return redirectTo('?error=connect_failed')
  }
}
