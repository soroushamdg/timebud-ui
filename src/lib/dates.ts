import { format } from 'date-fns'
export const toUtcString  = (d: Date) => d.toISOString()
export const formatLocalTime = (s: string) => {
  const d = new Date(s)
  return format(d, 'h:mm a')
}

// Always parse a date string as a local calendar date, regardless of time/timezone component.
// This prevents "2026-06-30T00:00:00Z" from displaying as Jun 29 in UTC-4 timezones.
export const parseDateLocal = (s: string): Date => {
  const datePart = s.split('T')[0]
  const [year, month, day] = datePart.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const formatLocal  = (s: string, fmt = 'MMM d, yyyy') => format(parseDateLocal(s), fmt)

export const formatLocalSmart = (s: string) => {
  const date = parseDateLocal(s)
  const currentYear = new Date().getFullYear()
  const dateYear = date.getFullYear()

  if (dateYear === currentYear) {
    return format(date, 'MMM d')
  } else {
    return format(date, 'MMM d, yyyy')
  }
}

export function formatDuration(start: string, end: string): string {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  const h = Math.floor(mins/60), m = mins%60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function formatMinutesLabel(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(minutes / 60), m = minutes % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

interface RecurrenceConfig {
  recurrence_type: 'daily' | 'specific_days' | 'interval' | null;
  recurrence_days: number[] | null;
  recurrence_interval: number | null;
  recurrence_end_date: string | null;
  recurrence_end_after: number | null;
  recurrence_missed_behavior: 'skip' | 'overdue' | null;
}

export function calculateNextDueDate(currentDueDate: string | null, config: RecurrenceConfig): string | null {
  if (!config.recurrence_type) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const current = currentDueDate ? new Date(currentDueDate) : today;
  current.setHours(0, 0, 0, 0);

  let nextDate: Date;

  if (config.recurrence_type === 'daily') {
    nextDate = new Date(current);
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (config.recurrence_type === 'specific_days' && config.recurrence_days) {
    const currentDay = current.getDay();
    const sortedDays = [...config.recurrence_days].sort((a, b) => a - b);
    const nextDayIndex = sortedDays.findIndex(d => d > currentDay);
    
    if (nextDayIndex !== -1) {
      nextDate = new Date(current);
      nextDate.setDate(current.getDate() + (sortedDays[nextDayIndex] - currentDay));
    } else {
      nextDate = new Date(current);
      nextDate.setDate(current.getDate() + (7 - currentDay + sortedDays[0]));
    }
  } else if (config.recurrence_type === 'interval' && config.recurrence_interval) {
    nextDate = new Date(current);
    nextDate.setDate(nextDate.getDate() + config.recurrence_interval);
  } else {
    return null;
  }

  // Check end date condition
  if (config.recurrence_end_date) {
    const endDate = new Date(config.recurrence_end_date);
    endDate.setHours(0, 0, 0, 0);
    if (nextDate > endDate) return null;
  }

  return nextDate.toISOString().split('T')[0];
}
