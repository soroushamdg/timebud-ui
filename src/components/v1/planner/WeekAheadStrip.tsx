import { format, isSameDay } from 'date-fns'
import { useRouter } from 'next/navigation'

export interface WeekDayChipData {
  date: Date
  taskCount: number
  usedMinutes: number
  budgetMinutes: number
}

interface WeekAheadStripProps {
  days: WeekDayChipData[]
  unscheduledCount: number
}

function dayLabel(date: Date, today: Date, index: number): string {
  if (index === 0) return 'Today'
  if (index === 1) return 'Tmrw'
  return format(date, 'EEE')
}

export function WeekAheadStrip({ days, unscheduledCount }: WeekAheadStripProps) {
  const router = useRouter()
  const today = days[0]?.date ?? new Date()

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 px-6">
        <h2 className="text-white text-xl font-bold">Week ahead</h2>
        <button
          onClick={() => router.push('/planner')}
          className="text-text-sec text-sm font-medium hover:text-white transition-colors"
        >
          See full week
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-6 pb-1 snap-x">
        {days.map((day, index) => {
          const percent = day.budgetMinutes > 0 ? Math.min(100, (day.usedMinutes / day.budgetMinutes) * 100) : 0
          const isOverBudget = day.usedMinutes > day.budgetMinutes
          const isToday = isSameDay(day.date, today)

          return (
            <button
              key={day.date.toISOString()}
              onClick={() => router.push(`/planner?day=${format(day.date, 'yyyy-MM-dd')}`)}
              className={`flex-shrink-0 min-w-[64px] snap-start rounded-2xl px-2 py-3 flex flex-col items-center gap-1.5 transition-colors ${
                isToday ? 'bg-[#2A2A2A] border border-accent-yellow' : 'bg-[#2A2A2A] border border-transparent'
              }`}
            >
              <span className="text-text-sec text-xs font-medium">{dayLabel(day.date, today, index)}</span>
              <span className="text-white text-sm font-semibold">{format(day.date, 'd')}</span>
              <div className="h-1.5 w-8 rounded-full bg-black/40 overflow-hidden">
                <div
                  className={`h-full rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-accent-yellow'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-text-sec text-[10px]">{day.taskCount} tasks</span>
            </button>
          )
        })}
      </div>

      {unscheduledCount > 0 && (
        <div className="mx-6 mt-3 bg-bg-card border border-border-card rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-text-sec text-sm">
            {unscheduledCount} task{unscheduledCount === 1 ? '' : 's'} won&apos;t fit in the next 7 days at this pace.
          </p>
          <button
            onClick={() => router.push('/planner')}
            className="text-accent-yellow text-sm font-semibold whitespace-nowrap hover:opacity-80 transition-opacity"
          >
            Review
          </button>
        </div>
      )}
    </div>
  )
}
