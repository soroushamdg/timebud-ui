import { ChevronDown, ChevronUp } from 'lucide-react'
import { ReactNode } from 'react'
import { formatMinutesLabel } from '@/lib/dates'

export interface ActiveBlockInfo {
  missionLabel: string
  endTime: string
}

// Calendar-aware summary for the day (src/lib/planner/planDay.ts). The daily budget is
// for free time only; calendar blocks are on top of it, so they're reported beside the
// budget rather than as a share of it. All optional so the card still works without a
// calendar.
export interface DaySummaryInfo {
  freePlannedMinutes: number
  reservedMinutes: number
  /** Null when the calendar isn't connected (no cap, nothing to report). */
  windowMinutes: number | null
  /** "French", or "French & Thesis" — for the reserved line. */
  reservedLabel?: string
}

interface RightNowCardProps {
  usedMinutes: number
  budgetMinutes: number
  /** Minutes already spent in earlier runs today — already subtracted out of
   *  `budgetMinutes`, shown separately so it's clear the smaller number isn't a typo. */
  alreadyUsedMinutes?: number
  activeBlock?: ActiveBlockInfo
  daySummary?: DaySummaryInfo
  topJobCard: ReactNode | null
  jobCount: number
  isExpanded: boolean
  onToggleExpanded: () => void
}

// The Home page's centerpiece "report" card: a status line (day budget or active
// calendar block), a preview of just the top-priority job, and a toggle that reveals
// the full planned list in place — Home's job list has no inline checkbox anyway
// (that only exists in Focus Run), so a permanently-expanded list here was never doing
// more than previewing what a "Start Run" tap already commits to.
export function RightNowCard({
  usedMinutes,
  budgetMinutes,
  alreadyUsedMinutes,
  activeBlock,
  daySummary,
  topJobCard,
  jobCount,
  isExpanded,
  onToggleExpanded,
}: RightNowCardProps) {
  const endTimeLabel = activeBlock
    ? new Date(activeBlock.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null

  // With a calendar, the bar and the headline number are about free time: how much of
  // the budget landed in real gaps. Block minutes are named beside it, never mixed in.
  const calendarMode = !activeBlock && !!daySummary && daySummary.windowMinutes !== null
  const planned = calendarMode ? daySummary!.freePlannedMinutes : usedMinutes
  const isOverBudget = planned > budgetMinutes
  const percent = budgetMinutes > 0 ? Math.min(100, (planned / budgetMinutes) * 100) : 0

  const statusLine = (() => {
    if (activeBlock) return `${formatMinutesLabel(usedMinutes)} of ${formatMinutesLabel(budgetMinutes)} used`
    if (calendarMode) {
      const base = `${formatMinutesLabel(planned)} of ${formatMinutesLabel(budgetMinutes)} free time planned`
      return daySummary!.reservedMinutes > 0
        ? `${base} · +${formatMinutesLabel(daySummary!.reservedMinutes)} reserved${daySummary!.reservedLabel ? ` for ${daySummary!.reservedLabel}` : ''}`
        : base
    }
    return `${formatMinutesLabel(usedMinutes)} of ${formatMinutesLabel(budgetMinutes)} planned`
  })()

  // Second line: what the calendar actually has free, and a nudge when the budget is
  // the thing holding the plan back rather than the calendar.
  const calendarLine = (() => {
    if (!calendarMode) return null
    const free = daySummary!.windowMinutes as number
    const line = `${formatMinutesLabel(free)} free on your calendar today`
    return free > budgetMinutes && planned >= budgetMinutes ? `${line} · raise your daily budget to plan more` : line
  })()
  const usedLine = alreadyUsedMinutes
    ? `${formatMinutesLabel(alreadyUsedMinutes)} ${calendarMode ? 'of free time ' : ''}already used today`
    : null

  return (
    <div className="mx-6 mb-6 relative overflow-hidden rounded-2xl border border-subtle-border" style={{ background: 'linear-gradient(135deg, var(--color-bg-card), var(--color-bg-card-locked))' }}>
      <div className="absolute right-0 top-0 w-28 h-28 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(245,197,24,0.14), transparent 70%)' }} />
      <div className="relative px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-text-primary text-[15px] font-bold">
            {activeBlock ? `🎯 ${activeBlock.missionLabel} block` : 'Right Now'}
          </span>
          {activeBlock ? (
            <span className="text-accent-yellow text-xs font-semibold flex-shrink-0">ends {endTimeLabel}</span>
          ) : (
            <span className="text-text-sec text-xs">Today</span>
          )}
        </div>

        <div className="flex items-center justify-between mb-1.5 gap-3">
          <span className="text-text-sec text-xs min-w-0 truncate">{statusLine}</span>
          {isOverBudget && <span className="text-accent-yellow text-xs font-semibold flex-shrink-0">Over budget</span>}
        </div>
        <div className="h-2 w-full rounded-full bg-progress-track overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${percent}%`,
              background: isOverBudget ? 'var(--color-accent-pink)' : 'linear-gradient(90deg, var(--color-accent-yellow), var(--color-accent-yellow-light))',
            }}
          />
        </div>

        {calendarLine || usedLine ? (
          <p className="text-text-sec text-[11px] mt-1.5 mb-4">
            {[calendarLine, usedLine].filter(Boolean).join(' · ')}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {topJobCard && !isExpanded && <div className="mb-3">{topJobCard}</div>}

        {jobCount > 0 && (
          <button
            onClick={onToggleExpanded}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-text-sec text-xs font-semibold hover:text-text-primary transition-colors"
          >
            {isExpanded ? 'Hide jobs' : `Show all ${jobCount} job${jobCount === 1 ? '' : 's'}`}
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  )
}
