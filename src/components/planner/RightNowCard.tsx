import { ChevronDown, ChevronUp } from 'lucide-react'
import { ReactNode } from 'react'
import { formatMinutesLabel } from '@/lib/dates'

export interface ActiveBlockInfo {
  missionLabel: string
  endTime: string
}

interface RightNowCardProps {
  usedMinutes: number
  budgetMinutes: number
  activeBlock?: ActiveBlockInfo
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
  activeBlock,
  topJobCard,
  jobCount,
  isExpanded,
  onToggleExpanded,
}: RightNowCardProps) {
  const percent = budgetMinutes > 0 ? Math.min(100, (usedMinutes / budgetMinutes) * 100) : 0
  const isOverBudget = usedMinutes > budgetMinutes
  const endTimeLabel = activeBlock
    ? new Date(activeBlock.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div className="mx-6 mb-6 relative overflow-hidden rounded-2xl border border-[#2a2a2a]" style={{ background: 'linear-gradient(135deg,#1c1c1c,#151515)' }}>
      <div className="absolute right-0 top-0 w-28 h-28 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(245,197,24,0.14), transparent 70%)' }} />
      <div className="relative px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white text-[15px] font-bold">
            {activeBlock ? `🎯 ${activeBlock.missionLabel} block` : 'Right Now'}
          </span>
          {activeBlock ? (
            <span className="text-accent-yellow text-xs font-semibold flex-shrink-0">ends {endTimeLabel}</span>
          ) : (
            <span className="text-text-sec text-xs">Today</span>
          )}
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <span className="text-text-sec text-xs">
            {activeBlock
              ? `${formatMinutesLabel(usedMinutes)} of ${formatMinutesLabel(budgetMinutes)} used`
              : `${formatMinutesLabel(usedMinutes)} of ${formatMinutesLabel(budgetMinutes)} planned`}
          </span>
          {isOverBudget && <span className="text-accent-yellow text-xs font-semibold flex-shrink-0">Over budget</span>}
        </div>
        <div className="h-2 w-full rounded-full bg-black overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${percent}%`,
              background: isOverBudget ? '#e8004d' : 'linear-gradient(90deg,#f5c518,#ffdf6b)',
            }}
          />
        </div>

        {topJobCard && !isExpanded && <div className="mb-3">{topJobCard}</div>}

        {jobCount > 0 && (
          <button
            onClick={onToggleExpanded}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-text-sec text-xs font-semibold hover:text-white transition-colors"
          >
            {isExpanded ? 'Hide jobs' : `Show all ${jobCount} job${jobCount === 1 ? '' : 's'}`}
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  )
}
