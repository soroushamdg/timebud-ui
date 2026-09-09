import { formatMinutesLabel } from '@/lib/dates'

interface BudgetMeterProps {
  usedMinutes: number
  budgetMinutes: number
  /** Calendar-aware extras (src/lib/planner/planDay.ts): minutes reserved by TimeBud
   *  blocks that day, and how much free time the calendar actually has. */
  reservedMinutes?: number
  windowMinutes?: number | null
  reservedLabel?: string
}

export function BudgetMeter({ usedMinutes, budgetMinutes, reservedMinutes = 0, windowMinutes, reservedLabel }: BudgetMeterProps) {
  const isOverBudget = usedMinutes > budgetMinutes
  const freeUsed = Math.max(0, usedMinutes - reservedMinutes)
  const freePercent = budgetMinutes > 0 ? Math.min(100, (freeUsed / budgetMinutes) * 100) : 0
  const reservedPercent = budgetMinutes > 0 ? Math.min(100 - freePercent, (reservedMinutes / budgetMinutes) * 100) : 0

  const detail = [
    reservedMinutes > 0 ? `${formatMinutesLabel(reservedMinutes)} reserved${reservedLabel ? ` for ${reservedLabel}` : ''}` : null,
    windowMinutes !== undefined && windowMinutes !== null ? `${formatMinutesLabel(windowMinutes)} free on calendar` : null,
  ].filter(Boolean)

  return (
    <div className="px-6 mb-4">
      <div className="flex items-center justify-between mb-1.5 gap-3">
        <span className="text-text-sec text-sm min-w-0 truncate">
          {formatMinutesLabel(usedMinutes)} planned of {formatMinutesLabel(budgetMinutes)} today
        </span>
        {isOverBudget && (
          <span className="text-accent-yellow text-xs font-semibold flex-shrink-0">Over budget</span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-secondary-surface overflow-hidden flex">
        <div
          className={`h-full transition-all ${isOverBudget ? 'bg-status-negative' : 'bg-accent-yellow'}`}
          style={{ width: `${freePercent}%` }}
        />
        {reservedPercent > 0 && (
          <div className="h-full transition-all bg-status-today" style={{ width: `${reservedPercent}%` }} />
        )}
      </div>
      {detail.length > 0 && (
        <p className="text-text-tertiary text-[11px] mt-1.5">{detail.join(' · ')}</p>
      )}
    </div>
  )
}
