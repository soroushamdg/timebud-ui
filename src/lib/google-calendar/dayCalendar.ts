import { SupabaseClient } from '@supabase/supabase-js'
import { getLocalDateString } from '@/lib/dates'
import { BusyInterval, DayBlock, DayCalendar } from '@/lib/planner/calendarTypes'
import { DbCalendarEventCache, DbGoogleCalendarBusyCache } from '@/types/database'

export interface DayCalendarResult {
  connected: boolean
  lastSyncedAt: string | null
  days: DayCalendar[]
}

// The cron syncs every 15 minutes; anything older than this means it has stopped
// reaching Google (expired token, paused job) and the calendar view can't be trusted.
export const CALENDAR_STALE_MS = 60 * 60 * 1000

export function isCalendarStale(lastSyncedAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastSyncedAt) return true
  return now - new Date(lastSyncedAt).getTime() > CALENDAR_STALE_MS
}

// "French" / "French & Thesis" / "A, B & C" — the label Home has always shown for a block.
export function buildMissionLabel(names: string[]): string {
  if (names.length === 0) return 'Mission'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// Calendar arithmetic on the 'YYYY-MM-DD' string itself — stepping `now` by 24h and
// re-localising would double up a date on a 25-hour DST day.
function addDaysToDateString(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function emptyDays(now: Date, timezone: string, days: number): DayCalendar[] {
  const today = getLocalDateString(now, timezone)
  return Array.from({ length: days }, (_, i) => ({
    date: addDaysToDateString(today, i),
    blocks: [],
    busy: [],
  }))
}

// Assembles the planner's view of `days` local days starting today from the local
// caches (never Google directly). Works with the browser client (RLS scopes the rows)
// or the service client with an explicit userId. Always returns one entry per day —
// empty when not connected — so callers can index by offset.
export async function fetchDayCalendar(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
  timezone: string,
  days = 1
): Promise<DayCalendarResult> {
  const dayList = emptyDays(now, timezone, days)

  const { data: connection } = await supabase
    .from('google_calendar_connections')
    .select('last_synced_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (!connection) return { connected: false, lastSyncedAt: null, days: dayList }

  // Wide UTC window; the local-date bucketing below does the precise cut.
  const windowStart = new Date(now.getTime() - 36 * HOUR_MS).toISOString()
  const windowEnd = new Date(now.getTime() + (days + 1) * DAY_MS).toISOString()

  const [eventsRes, busyRes, mappingsRes, sourcesRes] = await Promise.all([
    supabase
      .from('google_calendar_events_cache')
      .select('*')
      .eq('user_id', userId)
      .gte('end_time', windowStart)
      .lte('start_time', windowEnd),
    supabase
      .from('google_calendar_busy_cache')
      .select('*')
      .eq('user_id', userId)
      .gte('end_time', windowStart)
      .lte('start_time', windowEnd),
    supabase
      .from('calendar_block_mappings')
      .select('id, event_title')
      .eq('user_id', userId)
      .eq('confirmed', true),
    supabase
      .from('google_calendar_sources')
      .select('calendar_id')
      .eq('user_id', userId)
      .eq('is_busy_source', false),
  ])

  const events = (eventsRes.data || []) as DbCalendarEventCache[]
  const busyRows = (busyRes.data || []) as DbGoogleCalendarBusyCache[]
  const mappings = (mappingsRes.data || []) as Array<{ id: string; event_title: string }>
  // A calendar toggled off since the last sync still has rows in the cache until the
  // next sync replaces them — drop those here so un-ticking takes effect immediately.
  const mutedCalendarIds = new Set((sourcesRes.data || []).map((s) => s.calendar_id as string))

  const links =
    mappings.length > 0
      ? ((
          await supabase
            .from('calendar_block_mission_links')
            .select('mapping_id, project_id')
            .in('mapping_id', mappings.map((m) => m.id))
        ).data as Array<{ mapping_id: string; project_id: string }> | null) || []
      : []

  const linkedProjectIds = [...new Set(links.map((l) => l.project_id))]
  const projects =
    linkedProjectIds.length > 0
      ? ((
          await supabase
            .from('projects')
            .select('id, name')
            .in('id', linkedProjectIds)
            .eq('status', 'active')
        ).data as Array<{ id: string; name: string }> | null) || []
      : []
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]))

  // title → active mission ids. A mapping whose missions are all paused/archived drops
  // out here, so its events fall through to plain busy time.
  const missionIdsByTitle = new Map<string, string[]>()
  for (const mapping of mappings) {
    const ids = links
      .filter((l) => l.mapping_id === mapping.id)
      .map((l) => l.project_id)
      .filter((id) => projectNameById.has(id))
    if (ids.length > 0) missionIdsByTitle.set(mapping.event_title, ids)
  }

  // A block or interval belongs to the local date it starts on.
  const dayByDate = new Map(dayList.map((d) => [d.date, d]))
  for (const event of events) {
    const day = dayByDate.get(getLocalDateString(new Date(event.start_time), timezone))
    if (!day) continue
    const missionIds = missionIdsByTitle.get(event.title)
    if (missionIds) {
      const block: DayBlock = {
        id: event.id,
        title: event.title,
        projectIds: missionIds,
        missionLabel: buildMissionLabel(missionIds.map((id) => projectNameById.get(id)!)),
        startTime: event.start_time,
        endTime: event.end_time,
      }
      day.blocks.push(block)
    } else {
      // Unmapped (or not yet confirmed) — still busy until the user maps it.
      day.busy.push({ startTime: event.start_time, endTime: event.end_time })
    }
  }
  for (const row of busyRows) {
    if (mutedCalendarIds.has(row.calendar_id)) continue
    const day = dayByDate.get(getLocalDateString(new Date(row.start_time), timezone))
    if (!day) continue
    const interval: BusyInterval = { startTime: row.start_time, endTime: row.end_time }
    day.busy.push(interval)
  }

  const byStart = (a: { startTime: string }, b: { startTime: string }) =>
    a.startTime.localeCompare(b.startTime)
  for (const day of dayList) {
    day.blocks.sort(byStart)
    day.busy.sort(byStart)
  }

  return { connected: true, lastSyncedAt: connection.last_synced_at, days: dayList }
}
