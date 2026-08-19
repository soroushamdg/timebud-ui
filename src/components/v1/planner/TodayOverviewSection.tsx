import { ChevronDown, ChevronUp } from 'lucide-react'
import { BudgetMeter } from './BudgetMeter'
import { WeekAheadStrip, WeekDayChipData } from './WeekAheadStrip'
import { formatMinutesLabel } from '@/lib/dates'
import { useUIStore } from '@/stores/uiStore'

interface TodayOverviewSectionProps {
  usedMinutes: number
  budgetMinutes: number
  chips: WeekDayChipData[]
  unscheduledCount: number
}

export function TodayOverviewSection({ usedMinutes, budgetMinutes, chips, unscheduledCount }: TodayOverviewSectionProps) {
  const { weekOverviewExpanded, setWeekOverviewExpanded } = useUIStore()
  const weekTaskCount = chips.slice(1).reduce((sum, c) => sum + c.taskCount, 0)

  return (
    <div className="mb-4">
      <button
        onClick={() => setWeekOverviewExpanded(!weekOverviewExpanded)}
        className="w-full flex items-center justify-between px-6 py-2"
      >
        <span className="text-text-sec text-sm truncate">
          {formatMinutesLabel(usedMinutes)} of {formatMinutesLabel(budgetMinutes)} today
          {weekTaskCount > 0 && ` · ${weekTaskCount} more this week`}
          {unscheduledCount > 0 && ` · ${unscheduledCount} won't fit`}
        </span>
        {weekOverviewExpanded ? (
          <ChevronUp className="w-4 h-4 text-text-sec flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-sec flex-shrink-0" />
        )}
      </button>

      {weekOverviewExpanded && (
        <>
          <BudgetMeter usedMinutes={usedMinutes} budgetMinutes={budgetMinutes} />
          <WeekAheadStrip days={chips} unscheduledCount={unscheduledCount} />
        </>
      )}
    </div>
  )
}
