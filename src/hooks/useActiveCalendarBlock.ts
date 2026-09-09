import { useMemo } from 'react'
import { useDayCalendar } from '@/hooks/useDayCalendar'
import { DayBlock } from '@/lib/planner/calendarTypes'

// Home invalidates this key on the notification deep link; it now lives in useDayCalendar
// and is re-exported so callers can switch without a second import.
export { DAY_CALENDAR_QUERY_KEY } from '@/hooks/useDayCalendar'

export interface ActiveCalendarBlock {
  eventId: string
  title: string
  endTime: string
  missionLabel: string
  projectIds: string[]
}

export function findActiveBlock(blocks: DayBlock[], now: Date): DayBlock | null {
  const nowMs = now.getTime()
  return (
    blocks.find(
      (b) => new Date(b.startTime).getTime() <= nowMs && nowMs < new Date(b.endTime).getTime()
    ) || null
  )
}

// A block that's active right now — Home's passive path, complementing the cron's
// proactive push. Derived from today's DayCalendar rather than its own query so Home,
// the planner and Settings all see the same snapshot of the calendar.
export function useActiveCalendarBlock() {
  const { data: calendar, dataUpdatedAt, isLoading, isFetching, error, refetch } = useDayCalendar(1)

  // "Active as of the last fetch" — the same instant the old cache query used — and
  // dataUpdatedAt moves on every 60s refetch even when the data is structurally the
  // same, so the block still flips at its start/end boundary.
  const data = useMemo((): ActiveCalendarBlock | null => {
    const block = calendar?.days[0]
      ? findActiveBlock(calendar.days[0].blocks, new Date(dataUpdatedAt))
      : null
    if (!block) return null
    return {
      eventId: block.id,
      title: block.title,
      endTime: block.endTime,
      missionLabel: block.missionLabel,
      projectIds: block.projectIds,
    }
  }, [calendar, dataUpdatedAt])

  return { data, isLoading, isFetching, error, refetch }
}
