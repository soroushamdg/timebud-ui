import { formatMinutesLabel } from '@/lib/dates'

interface BudgetMeterProps {
  usedMinutes: number
  budgetMinutes: number
}

export function BudgetMeter({ usedMinutes, budgetMinutes }: BudgetMeterProps) {
  const percent = budgetMinutes > 0 ? Math.min(100, (usedMinutes / budgetMinutes) * 100) : 0
  const isOverBudget = usedMinutes > budgetMinutes

  return (
    <div className="px-6 mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-text-sec text-sm">
          {formatMinutesLabel(usedMinutes)} planned of {formatMinutesLabel(budgetMinutes)} today
        </span>
        {isOverBudget && (
          <span className="text-accent-yellow text-xs font-semibold">Over budget</span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-[#2A2A2A] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-500' : 'bg-accent-yellow'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
