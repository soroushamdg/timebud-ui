'use client'

import { useRouter } from 'next/navigation'

interface ThisWeekStripProps {
  streakDays: number
  daysPlanned: number
  daysTotal: number
  calendarLinkedCount: number
}

// Compact report tile matching the 3/4-up stat-strip language already used on Profile
// and Run History — a glance at weekly momentum, tapping through to the full Week
// Ahead view instead of duplicating it inline on Home.
export function ThisWeekStrip({ streakDays, daysPlanned, daysTotal, calendarLinkedCount }: ThisWeekStripProps) {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push('/planner')}
      className="mx-6 w-[calc(100%-3rem)] text-left"
    >
      <div className="text-white text-[13px] font-bold mb-2 px-0.5">This Week</div>
      <div className="grid grid-cols-3 rounded-2xl overflow-hidden border border-[#2a2a2a]">
        <div className="bg-[#0d0d0d] px-2 py-3 text-center">
          <div className="text-white text-lg font-extrabold">{streakDays}</div>
          <div className="text-[#666] text-[10.5px] mt-0.5">day streak</div>
        </div>
        <div className="bg-[#0d0d0d] px-2 py-3 text-center border-l border-r border-[#2a2a2a]">
          <div className="text-white text-lg font-extrabold">{daysPlanned}/{daysTotal}</div>
          <div className="text-[#666] text-[10.5px] mt-0.5">days planned</div>
        </div>
        <div className="bg-[#0d0d0d] px-2 py-3 text-center">
          <div className="text-accent-yellow text-lg font-extrabold">{calendarLinkedCount}</div>
          <div className="text-[#666] text-[10.5px] mt-0.5">calendar-linked</div>
        </div>
      </div>
    </button>
  )
}
