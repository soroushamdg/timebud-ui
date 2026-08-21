'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { NotificationSettingsRow } from '@/components/settings/NotificationSettingsRow'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useAISettings, useUpsertAISettings } from '@/hooks/useAISettings'
import { DbUserAISettings } from '@/types/database'

const DEFAULT_MORNING_TIME = '07:00'
const DEFAULT_REMINDER_TIME = '20:00'

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}

// Plain toggle, no per-row time control — each notification's relevant setting (a
// shared section time, its own time, or nothing at all for event-driven types) is
// shown once at the right level instead of repeated on every row.
function ToggleRow({ label, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div className="bg-bg-card rounded-none px-4 py-4 mb-2">
      <div className="flex justify-between items-center gap-3">
        <div className="min-w-0">
          <span className="text-white">{label}</span>
          <p className="text-text-sec text-xs mt-0.5">{description}</p>
        </div>
        <button
          onClick={() => onChange(!checked)}
          disabled={disabled}
          className={`w-12 h-6 rounded-full transition-colors disabled:opacity-50 flex-shrink-0 ${
            checked ? 'bg-accent-yellow' : 'bg-border-card'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform ${
              checked ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

function TimeRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="bg-bg-card-hover border border-border-card rounded-none px-4 py-3 mb-2 flex items-center justify-between">
      <span className="text-text-sec text-sm">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-black border border-border-card text-white px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:border-accent-yellow"
      />
    </div>
  )
}

export default function NotificationSettingsPage() {
  const router = useRouter()
  const { isSubscribed } = usePushSubscription()
  const { data: aiSettings } = useAISettings()
  const upsertSettings = useUpsertAISettings()

  const update = (fields: Partial<Omit<DbUserAISettings, 'user_id'>>) => upsertSettings.mutate(fields)

  const morningTime = aiSettings?.morning_briefing_time ?? DEFAULT_MORNING_TIME
  const reminderTime = aiSettings?.reminder_time ?? DEFAULT_REMINDER_TIME
  const firstDayOfWeek = aiSettings?.first_day_of_week === 'Sunday' ? 'Sunday' : 'Monday'

  const morningBriefingOn = aiSettings?.morning_briefing_enabled !== false
  const deadlineAlertsOn = aiSettings?.deadline_alerts_enabled !== false
  const weeklyLookaheadOn = aiSettings?.weekly_lookahead_enabled !== false
  const inactivityNudgeOn = aiSettings?.reminder_enabled === true
  const anyMorningTypeOn = morningBriefingOn || deadlineAlertsOn || weeklyLookaheadOn

  return (
    <AppShell showTabBar={false}>
      <div className="px-6 pt-4 mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-xl font-bold">Notifications</h1>
      </div>

      <div className="px-4 pb-8">
        <NotificationSettingsRow />

        {isSubscribed && (
          <>
            <h2 className="text-white text-sm font-semibold mt-6 mb-2 px-1">Morning</h2>

            <ToggleRow
              label="Morning briefing"
              description="Today's job count, planned time, and what to start with"
              checked={morningBriefingOn}
              onChange={(v) => update({ morning_briefing_enabled: v })}
            />

            <ToggleRow
              label="Deadline alerts"
              description="A heads-up when something is due tomorrow"
              checked={deadlineAlertsOn}
              onChange={(v) => update({ deadline_alerts_enabled: v })}
            />

            <ToggleRow
              label="Weekly look-ahead"
              description={`${firstDayOfWeek}s: a week summary instead of the daily briefing`}
              checked={weeklyLookaheadOn}
              onChange={(v) => update({ weekly_lookahead_enabled: v })}
            />

            {anyMorningTypeOn && (
              <TimeRow label="Sent at" value={morningTime} onChange={(v) => update({ morning_briefing_time: v })} />
            )}

            <h2 className="text-white text-sm font-semibold mt-6 mb-2 px-1">Throughout the day</h2>

            <ToggleRow
              label="Inactivity nudge"
              description="Only if you haven't added or touched anything that day"
              checked={inactivityNudgeOn}
              onChange={(v) => update({ reminder_enabled: v })}
            />
            {inactivityNudgeOn && (
              <TimeRow label="Sent at" value={reminderTime} onChange={(v) => update({ reminder_time: v })} />
            )}

            <ToggleRow
              label="Unfinished run"
              description="A nudge to resume if you left one open ~2 hours ago"
              checked={aiSettings?.unfinished_session_alerts_enabled !== false}
              onChange={(v) => update({ unfinished_session_alerts_enabled: v })}
            />

            <ToggleRow
              label="Grind milestones"
              description="A one-off nudge at 3, 7, 14, 30+ days in a row"
              checked={aiSettings?.streak_alerts_enabled === true}
              onChange={(v) => update({ streak_alerts_enabled: v })}
            />

            <ToggleRow
              label="Calendar blocks"
              description="A nudge when a mapped time block on your calendar starts"
              checked={aiSettings?.calendar_block_alerts_enabled !== false}
              onChange={(v) => update({ calendar_block_alerts_enabled: v })}
            />
          </>
        )}
      </div>
    </AppShell>
  )
}
