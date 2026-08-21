import { ChevronDown, ChevronUp } from 'lucide-react'
import { WeekAheadStrip, WeekDayChipData } from './WeekAheadStrip'
import { formatMinutesLabel } from '@/lib/dates'
import { useUIStore } from '@/stores/uiStore'

export interface ActiveBlockInfo {
  missionLabel: string
  endTime: string
}

interface TodayOverviewSectionProps {
  usedMinutes: number
  budgetMinutes: number
  chips: WeekDayChipData[]
  unscheduledCount: number
  activeBlock?: ActiveBlockInfo
}

export function TodayOverviewSection({ usedMinutes, budgetMinutes, chips, unscheduledCount, activeBlock }: TodayOverviewSectionProps) {
  const { weekOverviewExpanded, setWeekOverviewExpanded } = useUIStore()
  const weekTaskCount = chips.slice(1).reduce((sum, c) => sum + c.taskCount, 0)
  const percent = budgetMinutes > 0 ? Math.min(100, (usedMinutes / budgetMinutes) * 100) : 0
  const isOverBudget = usedMinutes > budgetMinutes
  const endTimeLabel = activeBlock
    ? new Date(activeBlock.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div className="mx-6 mb-6 relative overflow-hidden rounded-2xl border border-[#2a2a2a]" style={{ background: 'linear-gradient(135deg,#1c1c1c,#151515)' }}>
      <div className="absolute right-0 top-0 w-28 h-28 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(245,197,24,0.14), transparent 70%)' }} />
      <div className="relative px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-white text-[15px] font-bold">
            {activeBlock ? `🎯 ${activeBlock.missionLabel} block` : "Today's Briefing"}
          </span>
          <button
            onClick={() => setWeekOverviewExpanded(!weekOverviewExpanded)}
            className="flex items-center gap-1 text-text-sec text-xs font-medium hover:text-white transition-colors"
          >
            This week
            {weekOverviewExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center justify-between mt-3 mb-1.5">
          <span className="text-text-sec text-xs">
            {activeBlock
              ? `${formatMinutesLabel(usedMinutes)} of ${formatMinutesLabel(budgetMinutes)} used · until ${endTimeLabel}`
              : `${formatMinutesLabel(usedMinutes)} of ${formatMinutesLabel(budgetMinutes)} planned${weekTaskCount > 0 ? ` · ${weekTaskCount} more this week` : ''}`}
          </span>
          {isOverBudget && <span className="text-accent-yellow text-xs font-semibold flex-shrink-0">Over budget</span>}
        </div>
        <div className="h-2 w-full rounded-full bg-black overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${percent}%`,
              background: isOverBudget ? '#e8004d' : 'linear-gradient(90deg,#f5c518,#ffdf6b)',
            }}
          />
        </div>
        {unscheduledCount > 0 && (
          <p className="text-[11px] text-accent-pink mt-1.5 font-medium">{unscheduledCount} won&apos;t fit today</p>
        )}
      </div>

      {weekOverviewExpanded && (
        <div className="relative border-t border-[#2a2a2a] pt-1">
          <WeekAheadStrip days={chips} unscheduledCount={unscheduledCount} />
        </div>
      )}
    </div>
  )
}
