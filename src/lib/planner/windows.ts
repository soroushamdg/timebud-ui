import { getLocalDateString } from '@/lib/dates'
import { BusyInterval, DayBlock, PlanningHours } from './calendarTypes'

// Pure time arithmetic for "when is the user actually free today": planning hours minus
// walls (busy intervals from other calendars) minus TimeBud blocks. No planner scoring
// lives here — this only produces the windows planDay pours the free lane into.

export interface Interval {
  start: number // ms epoch
  end: number
}

export interface Window {
  startTime: string // ISO
  endTime: string
  minutes: number
}

export interface ComputeWindowsInput {
  now: Date
  timezone: string
  planningHours: PlanningHours
  busy: BusyInterval[]
  blocks: DayBlock[]
  /** Without a connected calendar there is nothing to subtract, and we deliberately
   *  don't cap the budget by planning hours either — that would silently change the
   *  plan for every user who never touched the calendar feature. */
  calendarConnected: boolean
}

export interface WindowsResult {
  /** Free gaps from `from` to the end of planning hours, in time order. */
  windows: Window[]
  /** Busy intervals (merged, clipped to the remaining day, minus block time) for display. */
  walls: Window[]
  /** Sum of window minutes, or null when the calendar isn't connected (= don't cap). */
  windowMinutes: number | null
  dayStart: string
  dayEnd: string
  /** max(now, dayStart) — where the plannable part of today begins. */
  from: string
}

function tzOffsetMinutes(at: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at)
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
    return Math.round((asUtc - at.getTime()) / 60000)
  } catch {
    return 0
  }
}

// The instant at which a wall-clock 'HH:MM' happens on a given local date in an IANA
// timezone. Two-pass so a DST switch between the naive guess and the answer is absorbed.
export function localTimeToUtc(dateStr: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = hhmm.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0)
  const offset = tzOffsetMinutes(new Date(guess), timeZone)
  let result = guess - offset * 60000
  const offset2 = tzOffsetMinutes(new Date(result), timeZone)
  if (offset2 !== offset) result = guess - offset2 * 60000
  return new Date(result)
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start)
  const merged: Interval[] = []
  for (const cur of sorted) {
    const last = merged[merged.length - 1]
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end)
    } else {
      merged.push({ ...cur })
    }
  }
  return merged
}

// Everything inside [rangeStart, rangeEnd] that is NOT covered by `occupied`.
export function subtractIntervals(rangeStart: number, rangeEnd: number, occupied: Interval[]): Interval[] {
  const gaps: Interval[] = []
  let cursor = rangeStart
  for (const o of mergeIntervals(occupied)) {
    if (o.end <= cursor) continue
    if (o.start >= rangeEnd) break
    if (o.start > cursor) gaps.push({ start: cursor, end: Math.min(o.start, rangeEnd) })
    cursor = Math.max(cursor, o.end)
    if (cursor >= rangeEnd) break
  }
  if (cursor < rangeEnd) gaps.push({ start: cursor, end: rangeEnd })
  return gaps
}

export function clipIntervals(intervals: Interval[], rangeStart: number, rangeEnd: number): Interval[] {
  return intervals
    .map((i) => ({ start: Math.max(i.start, rangeStart), end: Math.min(i.end, rangeEnd) }))
    .filter((i) => i.end > i.start)
}

const toInterval = (i: { startTime: string; endTime: string }): Interval => ({
  start: new Date(i.startTime).getTime(),
  end: new Date(i.endTime).getTime(),
})

const toWindow = (i: Interval): Window => ({
  startTime: new Date(i.start).toISOString(),
  endTime: new Date(i.end).toISOString(),
  minutes: Math.round((i.end - i.start) / 60000),
})

export function computeWindows(input: ComputeWindowsInput): WindowsResult {
  const { now, timezone, planningHours, calendarConnected } = input
  const nowMs = now.getTime()
  const date = getLocalDateString(now, timezone)
  const dayStartMs = localTimeToUtc(date, planningHours.start, timezone).getTime()
  let dayEndMs = localTimeToUtc(date, planningHours.end, timezone).getTime()
  // An end at or before the start means the window wraps past midnight (e.g. 20:00–02:00).
  if (dayEndMs <= dayStartMs) dayEndMs += 24 * 60 * 60 * 1000

  const from = Math.max(nowMs, dayStartMs)
  const base = {
    dayStart: new Date(dayStartMs).toISOString(),
    dayEnd: new Date(dayEndMs).toISOString(),
    from: new Date(from).toISOString(),
  }

  if (!calendarConnected) {
    // One open window from now to the end of planning hours, uncapped — see the field
    // comment on `calendarConnected`.
    const open = from < dayEndMs ? [toWindow({ start: from, end: dayEndMs })] : []
    return { ...base, windows: open, walls: [], windowMinutes: null }
  }

  if (from >= dayEndMs) {
    return { ...base, windows: [], walls: [], windowMinutes: 0 }
  }

  const busy = clipIntervals(input.busy.map(toInterval), from, dayEndMs)
  const blocks = clipIntervals(input.blocks.map(toInterval), from, dayEndMs)

  const minGapMs = Math.max(0, planningHours.minGapMinutes) * 60000
  const windows = subtractIntervals(from, dayEndMs, [...busy, ...blocks])
    .filter((g) => g.end - g.start >= minGapMs)
    .map(toWindow)

  // A block that overlaps a wall wins (it's the user's explicit intent), so walls are
  // shown minus block time to avoid two things claiming the same stretch of the day.
  const walls = mergeIntervals(busy)
    .flatMap((w) => subtractIntervals(w.start, w.end, blocks))
    .map(toWindow)

  const windowMinutes = windows.reduce((sum, w) => sum + w.minutes, 0)
  return { ...base, windows, walls, windowMinutes }
}
