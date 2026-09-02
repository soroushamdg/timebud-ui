import { RefreshCw } from 'lucide-react'
import { describeRecurrence } from '@/lib/dates'

export interface RecurringBadgeInfo {
  recurrence_type: 'daily' | 'specific_days' | 'interval' | null
  recurrence_days: number[] | null
  recurrence_interval: number | null
}

interface RecurringBadgeProps {
  task: RecurringBadgeInfo
  onClick?: (e: React.MouseEvent) => void
  /** Icon-only, no cadence text — for tight card layouts. */
  iconOnly?: boolean
  className?: string
}

// The one visual language for "this is a recurring job," used consistently across the
// project page, All Jobs, Home, Planner, and the focus session — previously only the
// project page showed any indicator at all.
export function RecurringBadge({ task, onClick, iconOnly = false, className = '' }: RecurringBadgeProps) {
  if (!task.recurrence_type) return null

  const { short } = describeRecurrence({
    recurrence_type: task.recurrence_type,
    recurrence_days: task.recurrence_days,
    recurrence_interval: task.recurrence_interval,
    recurrence_end_date: null,
    recurrence_end_after: null,
    recurrence_missed_behavior: null,
  })

  const content = (
    <>
      <RefreshCw size={11} className="flex-shrink-0" />
      {!iconOnly && <span className="truncate max-w-[7rem]">{short}</span>}
    </>
  )

  const sharedClasses = `inline-flex items-center gap-1 flex-shrink-0 text-accent-yellow ${className}`

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`Recurring: ${short}`}
        className={`${sharedClasses} hover:text-white transition-colors`}
      >
        {content}
      </button>
    )
  }

  return (
    <span title={`Recurring: ${short}`} className={sharedClasses}>
      {content}
    </span>
  )
}
