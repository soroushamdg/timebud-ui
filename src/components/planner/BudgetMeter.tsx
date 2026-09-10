import { formatMinutesLabel } from '@/lib/dates'

interface BudgetMeterProps {
  /** Minutes planned against the daily budget — free time only when a calendar is
   *  connected (src/lib/planner/planDay.ts), everything otherwise. */
  usedMinutes: number
  budgetMinutes: number
  /** Calendar-aware extras: minutes reserved by TimeBud blocks that day (on top of the
   *  budget, so named beside the bar rather than drawn into it), and how much free
   *  time the calendar actually has. */
  reservedMinutes?: number
  windowMinutes?: number | null
  reservedLabel?: string
}

export function BudgetMeter({ usedMinutes, budgetMinutes, reservedMinutes = 0, windowMinutes, reservedLabel }: BudgetMeterProps) {
  const calendarMode = windowMinutes !== undefined && windowMinutes !== null
  const percent = budgetMinutes > 0 ? Math.min(100, (usedMinutes / budgetMinutes) * 100) : 0
  const isOverBudget = usedMinutes > budgetMinutes

  const detail = [
    reservedMinutes > 0 ? `+${formatMinutesLabel(reservedMinutes)} reserved${reservedLabel ? ` for ${reservedLabel}` : ''}` : null,
    calendarMode ? `${formatMinutesLabel(windowMinutes as number)} free on calendar` : null,
  ].filter(Boolean)

  return (
    <div className="px-6 mb-4">
      <div className="flex items-center justify-between mb-1.5 gap-3">
        <span className="text-text-sec text-sm min-w-0 truncate">
          {formatMinutesLabel(usedMinutes)} planned of {formatMinutesLabel(budgetMinutes)}
          {calendarMode ? ' free time' : ' today'}
        </span>
        {isOverBudget && (
          <span className="text-accent-yellow text-xs font-semibold flex-shrink-0">Over budget</span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-secondary-surface overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-status-negative' : 'bg-accent-yellow'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {detail.length > 0 && (
        <p className="text-text-tertiary text-[11px] mt-1.5">{detail.join(' · ')}</p>
      )}
    </div>
  )
}
