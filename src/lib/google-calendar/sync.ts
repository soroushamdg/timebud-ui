import { SupabaseClient } from '@supabase/supabase-js'
import { getValidAccessToken } from './connection'
import { isHolidayCalendar, listCalendars, listEvents, queryFreeBusy } from './client'

// One events.list on the TimeBud calendar plus one freeBusy call across the other
// calendars covers this whole window per sync. A day back so a block that just ended
// still counts for today; eight days ahead so Week Ahead can see a full week.
export const SYNC_WINDOW_PAST_HOURS = 24
export const SYNC_WINDOW_FUTURE_DAYS = 8

export interface CalendarSyncResult {
  eventsSynced: number
  mappingsCreated: number
  busyIntervals: number
  sourcesSeen: number
}

export function getSyncWindow(now: Date): { timeMin: string; timeMax: string } {
  return {
    timeMin: new Date(now.getTime() - SYNC_WINDOW_PAST_HOURS * 60 * 60 * 1000).toISOString(),
    timeMax: new Date(now.getTime() + SYNC_WINDOW_FUTURE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  }
}

// PostgREST `in` filter value — quoted so calendar ids containing `#` or `@` survive.
function toInList(values: string[]): string {
  return `(${values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(',')})`
}

// Pulls one user's calendar into the local caches: TimeBud events (reservations, kept
// by title) and busy intervals from every other calendar the user counts (walls, no
// titles). Needs the service client — the caches only grant users select. Throws if
// the connection is missing or its token can't be refreshed; the caller decides.
export async function syncUserCalendar(
  userId: string,
  now: Date,
  supabase: SupabaseClient
): Promise<CalendarSyncResult> {
  const tokenInfo = await getValidAccessToken(userId, supabase)
  if (!tokenInfo) throw new Error('No Google Calendar connection')
  const { accessToken, calendarId: timebudCalendarId } = tokenInfo
  const { timeMin, timeMax } = getSyncWindow(now)
  const syncedAt = now.toISOString()

  // Sources: remember every calendar on the account so Settings can offer the toggle.
  // ignoreDuplicates keeps the user's existing choices — only brand-new rows take the
  // default (everything counts except the TimeBud calendar and holiday feeds).
  const calendars = await listCalendars(accessToken)
  if (calendars.length > 0) {
    await supabase.from('google_calendar_sources').upsert(
      calendars.map((c) => ({
        user_id: userId,
        calendar_id: c.id,
        summary: c.summary || null,
        is_primary: !!c.primary,
        is_busy_source: c.id !== timebudCalendarId && !isHolidayCalendar(c),
      })),
      { onConflict: 'user_id,calendar_id', ignoreDuplicates: true }
    )
    // A calendar removed from the Google account shouldn't linger in the toggle list.
    await supabase
      .from('google_calendar_sources')
      .delete()
      .eq('user_id', userId)
      .not('calendar_id', 'in', toInList(calendars.map((c) => c.id)))
  }

  const { data: sources } = await supabase
    .from('google_calendar_sources')
    .select('calendar_id, is_busy_source')
    .eq('user_id', userId)
  // The TimeBud calendar is never a freeBusy source — its events arrive titled, below.
  const busySourceIds = (sources || [])
    .filter((s) => s.is_busy_source && s.calendar_id !== timebudCalendarId)
    .map((s) => s.calendar_id as string)

  // TimeBud events → reservations.
  const events = await listEvents(accessToken, timebudCalendarId, timeMin, timeMax)
  const seenEventIds: string[] = []
  let eventsSynced = 0
  let mappingsCreated = 0

  for (const event of events) {
    const startTime = event.start.dateTime || event.start.date
    const endTime = event.end.dateTime || event.end.date
    if (!startTime || !endTime || !event.summary) continue

    await supabase.from('google_calendar_events_cache').upsert(
      {
        user_id: userId,
        google_event_id: event.id,
        title: event.summary,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        synced_at: syncedAt,
      },
      { onConflict: 'user_id,google_event_id' }
    )
    seenEventIds.push(event.id)
    eventsSynced++

    // First time this exact block title has been seen for this user — surface it in
    // Settings for a one-time "which mission(s)?" confirmation rather than guessing.
    const { data: existingMapping } = await supabase
      .from('calendar_block_mappings')
      .select('id')
      .eq('user_id', userId)
      .eq('event_title', event.summary)
      .maybeSingle()

    if (!existingMapping) {
      await supabase
        .from('calendar_block_mappings')
        .insert({ user_id: userId, event_title: event.summary, confirmed: false })
      mappingsCreated++
    }
  }

  // Anything cached in the window that Google no longer returns was deleted or moved —
  // it must stop reserving time.
  let staleEvents = supabase
    .from('google_calendar_events_cache')
    .delete()
    .eq('user_id', userId)
    .gte('start_time', timeMin)
    .lte('start_time', timeMax)
  if (seenEventIds.length > 0) {
    staleEvents = staleEvents.not('google_event_id', 'in', toInList(seenEventIds))
  }
  await staleEvents

  // Busy intervals → walls. Fetched before the cache is cleared so a Google failure
  // leaves the previous snapshot in place rather than an empty one.
  const busyRows: Array<{
    user_id: string
    calendar_id: string
    start_time: string
    end_time: string
    synced_at: string
  }> = []
  if (busySourceIds.length > 0) {
    const freeBusy = await queryFreeBusy(accessToken, busySourceIds, timeMin, timeMax)
    for (const [calendarId, intervals] of Object.entries(freeBusy)) {
      for (const interval of intervals) {
        busyRows.push({
          user_id: userId,
          calendar_id: calendarId,
          start_time: new Date(interval.start).toISOString(),
          end_time: new Date(interval.end).toISOString(),
          synced_at: syncedAt,
        })
      }
    }
  }
  // The busy cache is only ever a snapshot of the sync window (no per-row state like
  // notified_at), so replace it wholesale — freeBusy clips long events to timeMin,
  // which a start_time-bounded delete would leave behind as duplicates.
  await supabase.from('google_calendar_busy_cache').delete().eq('user_id', userId)
  if (busyRows.length > 0) {
    await supabase.from('google_calendar_busy_cache').insert(busyRows)
  }

  await supabase
    .from('google_calendar_connections')
    .update({ last_synced_at: syncedAt })
    .eq('user_id', userId)

  return {
    eventsSynced,
    mappingsCreated,
    busyIntervals: busyRows.length,
    sourcesSeen: calendars.length,
  }
}
