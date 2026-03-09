import { format, parseISO } from 'date-fns'
export const toUtcString  = (d: Date) => d.toISOString()
export const formatLocal  = (s: string, fmt = 'MMM d, yyyy') => format(parseISO(s), fmt)
export const formatLocalTime = (s: string) => format(parseISO(s), 'h:mm a')
export function formatDuration(start: string, end: string): string {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  const h = Math.floor(mins/60), m = mins%60
  return h > 0 ? `${h}h ${m}m` : `${m}m` 
}
