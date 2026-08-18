import { getLocalDateString, parseDateLocal, formatDateLocal } from '@/lib/dates'

export interface TemporalContext {
  currentUtcTime: string
  currentLocalTime: string
  userTimezone: string
  todayDate: string
  weekStart: string
  weekEnd: string
  endOfWeek: string
  humanReadable: string
}

export function buildTemporalContext(
  timezone: string = 'UTC',
  firstDayOfWeek: string = 'Monday'
): TemporalContext {
  const now = new Date()
  
  // Format current times
  const currentUtcTime = now.toISOString()
  const currentLocalTime = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
  
  // Today's date in YYYY-MM-DD format, in the user's timezone (not the server's clock)
  const todayDate = getLocalDateString(now, timezone)

  // Calculate week start and end based on first day of week
  const { weekStart, weekEnd, endOfWeek } = getWeekBounds(todayDate, firstDayOfWeek)
  
  // Human readable description
  const dayName = new Intl.DateTimeFormat('en-US', { 
    weekday: 'long',
    timeZone: timezone 
  }).format(now)
  
  const timeStr = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(now)
  
  const humanReadable = `Right now it is ${dayName}, ${timeStr} in your timezone (${timezone})`
  
  return {
    currentUtcTime,
    currentLocalTime,
    userTimezone: timezone,
    todayDate,
    weekStart,
    weekEnd,
    endOfWeek,
    humanReadable,
  }
}

// `todayDateStr` is the user's "today" already resolved to their timezone (see
// getLocalDateString above) — everything from here on is pure calendar-day arithmetic
// on a local-safe Date (via parseDateLocal), not a timezone conversion.
function getWeekBounds(todayDateStr: string, firstDayOfWeek: string): {
  weekStart: string
  weekEnd: string
  endOfWeek: string
} {
  const date = parseDateLocal(todayDateStr)
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
  const isWeekStartMonday = firstDayOfWeek === 'Monday'

  // Calculate days to subtract to get to week start
  let daysToWeekStart: number
  if (isWeekStartMonday) {
    // Week starts Monday (1)
    daysToWeekStart = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  } else {
    // Week starts Sunday (0)
    daysToWeekStart = dayOfWeek
  }

  // Calculate week start
  const weekStartDate = new Date(date)
  weekStartDate.setDate(date.getDate() - daysToWeekStart)

  // Calculate week end (6 days after start)
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekStartDate.getDate() + 6)

  return {
    weekStart: formatDateLocal(weekStartDate),
    weekEnd: formatDateLocal(weekEndDate),
    endOfWeek: formatDateLocal(weekEndDate),
  }
}

export function getEndOfWeek(firstDayOfWeek: string, timezone: string = 'UTC'): Date {
  const { endOfWeek } = getWeekBounds(getLocalDateString(new Date(), timezone), firstDayOfWeek)
  return parseDateLocal(endOfWeek)
}
