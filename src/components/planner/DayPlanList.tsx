'use client'

import { ReactNode } from 'react'
import { Calendar, Clock } from 'lucide-react'
import { DaySegment, TaskPortion } from '@/lib/planner'
import { formatMinutesLabel } from '@/lib/dates'

// Renders a day's plan the way the calendar shapes it: free windows, walls (busy time
// from other calendars) and TimeBud block lanes, in clock order. It owns the headers
// and the empty states; the job rows themselves come from the caller so Home and Week
// Ahead can keep their own card, gestures and click handling.

export interface DayPlanListProps {
  segments: DaySegment[]
  /** Render one job row. `portion` is set for a free-lane job inside a window (its minutes
   *  there, and whether it continues from / into another window). */
  renderJob: (taskId: string, portion?: TaskPortion) => ReactNode
  /** Labels empty windows "budget reached" rather than "nothing left to plan". */
  budgetReached?: boolean
  /** False when the calendar isn't connected: the single window has no real bounds. */
  showTimes?: boolean
  /** Compact variant for Week Ahead (smaller headers, no wall rows). */
  compact?: boolean
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// "6:00–7:00 AM", "3:00–4:30 PM", "11:30 AM–1:00 PM"
export function formatTimeRange(startIso: string, endIso: string): string {
  const a = clock(startIso)
  const b = clock(endIso)
  const suffixA = a.slice(-2)
  const suffixB = b.slice(-2)
  return suffixA === suffixB ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`
}

function Header({
  icon,
  title,
  meta,
  tone,
  compact,
}: {
  icon?: ReactNode
  title: string
  meta?: string
  tone: 'free' | 'block' | 'muted'
  compact?: boolean
}) {
  const titleColor =
    tone === 'block' ? 'text-status-today' : tone === 'muted' ? 'text-text-tertiary' : 'text-text-primary'
  return (
    <div className={`flex items-center justify-between gap-3 px-1 ${compact ? 'mt-3 mb-1.5' : 'mt-4 mb-2'}`}>
      <span className={`flex items-center gap-1.5 ${compact ? 'text-[11.5px]' : 'text-xs'} font-bold ${titleColor} min-w-0 truncate`}>
        {icon}
        {title}
      </span>
      {meta && <span className="text-text-sec text-[11px] flex-shrink-0 tabular-nums">{meta}</span>}
    </div>
  )
}

export function DayPlanList({ segments, renderJob, budgetReached = false, showTimes = true, compact = false }: DayPlanListProps) {
  if (segments.length === 0) {
    return <p className="text-text-sec text-sm py-2">Nothing planned.</p>
  }

  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        if (seg.kind === 'wall') {
          if (compact) return null
          return (
            <div
              key={`wall-${i}`}
              className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl border border-dashed border-border-card bg-bg-inset text-[11px] text-text-tertiary"
            >
              <span className="truncate">Busy · {formatTimeRange(seg.startTime, seg.endTime)}</span>
              <span className="flex-shrink-0 tabular-nums">{formatMinutesLabel(seg.minutes)}</span>
            </div>
          )
        }

        if (seg.kind === 'block') {
          const range = formatTimeRange(seg.startTime, seg.endTime)
          const meta =
            seg.state === 'active'
              ? `ends ${clock(seg.endTime)}`
              : formatMinutesLabel(seg.budgetMinutes)
          return (
            <div key={seg.blockId}>
              <Header
                tone="block"
                compact={compact}
                icon={<Calendar className="w-3.5 h-3.5 flex-shrink-0" />}
                title={`${range} · ${seg.missionLabel} block`}
                meta={meta}
              />
              {seg.tasks.length === 0 ? (
                <p className="text-text-tertiary text-xs px-1">
                  Nothing to plan for {seg.missionLabel}. Add jobs to it, or shorten the block.
                </p>
              ) : (
                <div className="space-y-3">
                  {seg.tasks.map((t) => (
                    <div key={t.taskId}>{renderJob(t.taskId)}</div>
                  ))}
                  {seg.slackMinutes > 0 && (
                    <p className="text-text-tertiary text-[11px] px-1">
                      {formatMinutesLabel(seg.slackMinutes)} of the block unfilled
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        }

        // Free window
        const empty = seg.portions.length === 0
        const title = showTimes ? `${formatTimeRange(seg.startTime, seg.endTime)} · free` : 'Free time'
        const meta = empty
          ? budgetReached
            ? `${formatMinutesLabel(seg.minutes)} · budget reached`
            : `${formatMinutesLabel(seg.minutes)} · nothing left to plan`
          : showTimes && seg.plannedMinutes < seg.minutes
            ? `${formatMinutesLabel(seg.plannedMinutes)} of ${formatMinutesLabel(seg.minutes)}`
            : formatMinutesLabel(seg.plannedMinutes)
        return (
          <div key={`win-${seg.startTime}`}>
            <Header
              tone={empty ? 'muted' : 'free'}
              compact={compact}
              icon={<Clock className={`w-3.5 h-3.5 flex-shrink-0 ${empty ? '' : 'text-accent-yellow'}`} />}
              title={title}
              meta={meta}
            />
            {!empty && (
              <div className="space-y-3">
                {seg.portions.map((p, j) => (
                  <div key={`${p.taskId}-${j}`}>
                    {renderJob(p.taskId, p)}
                    {p.continues && (
                      <p className="text-text-tertiary text-[11px] px-1 mt-1">continues in the next free window</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
