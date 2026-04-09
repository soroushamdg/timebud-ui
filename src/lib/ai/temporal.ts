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
  
  // Today's date in YYYY-MM-DD format
  const todayDate = now.toISOString().split('T')[0]
  
  // Calculate week start and end based on first day of week
  const { weekStart, weekEnd, endOfWeek } = getWeekBounds(now, firstDayOfWeek)
  
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

function getWeekBounds(date: Date, firstDayOfWeek: string): {
  weekStart: string
  weekEnd: string
  endOfWeek: string
} {
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
  weekStartDate.setHours(0, 0, 0, 0)
  
  // Calculate week end (6 days after start)
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekStartDate.getDate() + 6)
  weekEndDate.setHours(23, 59, 59, 999)
  
  // End of week is the last day (same as weekEnd but formatted differently)
  const endOfWeekDate = new Date(weekEndDate)
  endOfWeekDate.setHours(23, 59, 59, 999)
  
  return {
    weekStart: formatDate(weekStartDate),
    weekEnd: formatDate(weekEndDate),
    endOfWeek: formatDate(endOfWeekDate),
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getEndOfWeek(firstDayOfWeek: string): Date {
  const now = new Date()
  const { endOfWeek } = getWeekBounds(now, firstDayOfWeek)
  return new Date(endOfWeek)
}
