// Thin fetch-based wrapper around the Google OAuth + Calendar REST APIs. No `googleapis`
// SDK dependency — the surface area needed here (auth, token refresh, list/create
// calendar, list events) is small enough that raw REST calls stay easy to audit.

const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'
const DEDICATED_CALENDAR_NAME = 'TimeBud'

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  return `${appUrl}/api/integrations/google-calendar/callback`
}

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

export interface GoogleCalendarListEntry {
  id: string
  summary: string
}

export interface GoogleCalendarEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_OAUTH_BASE}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`)
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`)
  return res.json()
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST' })
}

export async function listCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]> {
  const res = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Failed to list calendars: ${await res.text()}`)
  const json = await res.json()
  return json.items || []
}

export async function createCalendar(accessToken: string, name: string): Promise<{ id: string }> {
  const res = await fetch(`${CALENDAR_API_BASE}/calendars`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ summary: name }),
  })
  if (!res.ok) throw new Error(`Failed to create calendar: ${await res.text()}`)
  return res.json()
}

// Finds the user's existing dedicated "TimeBud" calendar, or creates one if absent —
// so connecting never silently creates duplicates on a reconnect.
export async function findOrCreateDedicatedCalendar(accessToken: string): Promise<string> {
  const calendars = await listCalendars(accessToken)
  const existing = calendars.find((c) => c.summary === DEDICATED_CALENDAR_NAME)
  if (existing) return existing.id

  const created = await createCalendar(accessToken, DEDICATED_CALENDAR_NAME)
  return created.id
}

export async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
  })
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) throw new Error(`Failed to list events: ${await res.text()}`)
  const json = await res.json()
  return json.items || []
}
