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

// The safe inverse of parseDateLocal: reads local Y/M/D components directly rather than
// round-tripping through .toISOString() (which re-expresses the date in UTC and silently
// shifts it a day for positive-UTC-offset users — the same class of bug parseDateLocal
// exists to prevent on the way in).
export const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Genuine per-user-timezone-aware variants (not just "local to this device/server") —
// use these when you actually need to know the date/hour in a specific IANA timezone,
// e.g. server-side code deciding what's "today" for a given user.
export const getLocalDateString = (date: Date, timeZone: string): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(date)
  }
}

export const getLocalHour = (date: Date, timeZone: string): number => {
  try {
    return parseInt(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit' }).format(date), 10)
  } catch {
    return date.getUTCHours()
  }
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
  recurrence_completed_count?: number;
}

// Anchored to whichever is later, the task's own due date or today — never to a stale
// past due date alone. Anchoring purely to `currentDueDate` meant a task missed for N
// periods needed N separate completions to reach today (each one only advancing a
// single period from an already-stale date); anchoring to today instead lets one
// completion jump straight to the correct next occurrence no matter how far behind it is.
// `todayOverride` lets a caller supply "today" as a specific calendar date (e.g. a
// `parseDateLocal`-style Y/M/D object for one user's IANA timezone, from server-side
// cron) instead of defaulting to the current process's own local date — needed because
// the server process's local date and an individual user's local date can differ.
export function calculateNextDueDate(currentDueDate: string | null, config: RecurrenceConfig, todayOverride?: Date): string | null {
  if (!config.recurrence_type) return null;

  const today = todayOverride ? new Date(todayOverride) : new Date();
  today.setHours(0, 0, 0, 0);
  const current = currentDueDate ? parseDateLocal(currentDueDate) : today;
  current.setHours(0, 0, 0, 0);
  const anchor = current > today ? current : today;

  let nextDate: Date;

  if (config.recurrence_type === 'daily') {
    nextDate = new Date(anchor);
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (config.recurrence_type === 'specific_days' && config.recurrence_days) {
    const anchorDay = anchor.getDay();
    const sortedDays = [...config.recurrence_days].sort((a, b) => a - b);
    const nextDayIndex = sortedDays.findIndex(d => d > anchorDay);

    if (nextDayIndex !== -1) {
      nextDate = new Date(anchor);
      nextDate.setDate(anchor.getDate() + (sortedDays[nextDayIndex] - anchorDay));
    } else {
      nextDate = new Date(anchor);
      nextDate.setDate(anchor.getDate() + (7 - anchorDay + sortedDays[0]));
    }
  } else if (config.recurrence_type === 'interval' && config.recurrence_interval) {
    nextDate = new Date(anchor);
    nextDate.setDate(nextDate.getDate() + config.recurrence_interval);
  } else {
    return null;
  }

  // Check end date condition
  if (config.recurrence_end_date) {
    const endDate = parseDateLocal(config.recurrence_end_date);
    endDate.setHours(0, 0, 0, 0);
    if (nextDate > endDate) return null;
  }

  // Check end-after-N-occurrences condition
  if (config.recurrence_end_after) {
    const completedCount = config.recurrence_completed_count ?? 0;
    if (completedCount + 1 >= config.recurrence_end_after) return null;
  }

  return formatDateLocal(nextDate);
}

const RECURRENCE_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface RecurrenceDescription {
  pattern: string;
  end: string;
  missed: string;
  // Compact form for badges/cards, e.g. "Daily", "Mon, Wed, Fri", "Every 3d"
  short: string;
}

export function describeRecurrence(config: RecurrenceConfig): RecurrenceDescription {
  let pattern = '…';
  let short = '…';

  if (config.recurrence_type === 'daily') {
    pattern = 'Repeats every day';
    short = 'Daily';
  } else if (config.recurrence_type === 'specific_days' && config.recurrence_days?.length) {
    const names = [...config.recurrence_days].sort((a, b) => a - b).map(d => RECURRENCE_DAY_NAMES[d]).join(', ');
    pattern = `Repeats every ${names}`;
    short = names;
  } else if (config.recurrence_type === 'interval' && config.recurrence_interval) {
    pattern = `Repeats every ${config.recurrence_interval} days`;
    short = `Every ${config.recurrence_interval}d`;
  }

  let end = 'No end date';
  if (config.recurrence_end_date) {
    end = `Ends on ${parseDateLocal(config.recurrence_end_date).toLocaleDateString()}`;
  } else if (config.recurrence_end_after) {
    end = `Ends after ${config.recurrence_end_after} times`;
  }

  const missed = config.recurrence_missed_behavior === 'skip' ? 'Skips missed days' : 'Shows missed days as overdue';

  return { pattern, end, missed, short };
}
