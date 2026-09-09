'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Calendar, Check, X, Pencil } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { AppShell } from '@/components/layout/AppShell'
import { useGoogleCalendarConnection } from '@/hooks/useGoogleCalendarConnection'
import { useCalendarBlockMappings, useConfirmBlockMapping } from '@/hooks/useCalendarBlockMappings'
import { useCalendarSources, useSetCalendarSourceBusy } from '@/hooks/useCalendarSources'
import { useDayCalendar } from '@/hooks/useDayCalendar'
import { useAISettings, useUpsertAISettings } from '@/hooks/useAISettings'
import { useProjects } from '@/hooks/useProjects'
import { DEFAULT_PLANNING_HOURS } from '@/lib/planner/calendarTypes'
import { DbCalendarBlockMapping, DbGoogleCalendarSource } from '@/types/database'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'That connection attempt expired — please try again.',
  unauthorized: 'You were signed out — please log in and try again.',
  no_refresh_token: "Google didn't grant lasting access — try disconnecting any prior TimeBud access in your Google Account and reconnecting.",
  connect_failed: 'Something went wrong connecting to Google Calendar. Please try again.',
}

const GAP_OPTIONS = [10, 15, 20, 30, 45, 60]

// "4:30–6:30 PM" — the meridiem only once when both ends share it.
function formatTimeRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sameMeridiem = format(s, 'a') === format(e, 'a')
  return `${format(s, sameMeridiem ? 'h:mm' : 'h:mm a')}–${format(e, 'h:mm a')}`
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
        checked ? 'bg-accent-yellow' : 'border border-border-card'
      }`}
    >
      {checked && <Check className="w-3.5 h-3.5 text-on-light-accent" strokeWidth={3} />}
    </div>
  )
}

function MissionPicker({
  mapping,
  onClose,
}: {
  mapping: DbCalendarBlockMapping
  onClose: () => void
}) {
  const { data: projects = [] } = useProjects()
  const confirmMapping = useConfirmBlockMapping()
  const [selected, setSelected] = useState<string[]>(mapping.project_ids || [])

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  const handleSave = async () => {
    await confirmMapping.mutateAsync({ eventTitle: mapping.event_title, projectIds: selected })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-scrim/70 z-[100] flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-bg-primary rounded-t-3xl p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-text-primary text-lg font-bold">&ldquo;{mapping.event_title}&rdquo;</h2>
          <button onClick={onClose} className="text-text-sec hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-text-sec text-sm mb-4">Which mission(s) is this block for?</p>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => toggle(project.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-bg-card rounded-2xl border border-border-card"
            >
              <span className="text-text-primary truncate">{project.name}</span>
              <CheckBox checked={selected.includes(project.id)} />
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={selected.length === 0 || confirmMapping.isPending}
          className="w-full mt-4 bg-accent-yellow text-on-light-accent font-bold py-3 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(245,197,24,0.35)]"
        >
          {confirmMapping.isPending ? 'Saving...' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}

function SyncStatus({
  lastSyncedAt,
  isStale,
  isSyncing,
  onSync,
}: {
  lastSyncedAt: string | null
  isStale: boolean
  isSyncing: boolean
  onSync: () => Promise<unknown>
}) {
  const [syncError, setSyncError] = useState<string | null>(null)

  const handleSync = async () => {
    setSyncError(null)
    try {
      await onSync()
    } catch {
      setSyncError("Couldn't reach Google Calendar. Please try again.")
    }
  }

  const lastSynced = lastSyncedAt ? new Date(lastSyncedAt) : null

  return (
    <div className="mt-4 pt-4 border-t border-border-card">
      {isStale && (
        <div className="bg-accent-pink/10 border border-accent-pink rounded-2xl px-4 py-3 mb-3">
          <p className="text-accent-pink text-sm">
            {lastSynced
              ? `Not synced for ${formatDistanceToNow(lastSynced)}. Blocks after ${format(lastSynced, 'MMM d')} are not in TimeBud yet.`
              : 'Not synced yet. Your blocks are not in TimeBud until the first sync.'}
          </p>
        </div>
      )}
      {syncError && (
        <div className="bg-accent-pink/10 border border-accent-pink rounded-2xl px-4 py-3 mb-3">
          <p className="text-accent-pink text-sm">{syncError}</p>
        </div>
      )}
      <p className="text-text-sec text-sm mb-2">
        {lastSynced ? `Last synced ${formatDistanceToNow(lastSynced, { addSuffix: true })}` : 'Not synced yet'}
      </p>
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="w-full bg-bg-card-hover border border-border-card text-text-primary font-medium py-3 rounded-xl disabled:opacity-50"
      >
        {isSyncing ? 'Syncing…' : 'Sync now'}
      </button>
    </div>
  )
}

function TodaysReservations() {
  const { today, isLoading } = useDayCalendar(1)
  const blocks = today?.blocks || []

  return (
    <>
      <h2 className="text-text-primary text-sm font-semibold mb-2 px-1">Today&apos;s reservations</h2>
      <div className="space-y-2 mb-6">
        {isLoading ? (
          <div className="h-11 bg-bg-card border border-border-card rounded-2xl animate-pulse"></div>
        ) : blocks.length === 0 ? (
          <div className="bg-bg-card border border-border-card rounded-2xl px-4 py-3">
            <p className="text-text-sec text-sm">None today</p>
          </div>
        ) : (
          blocks.map((block) => (
            <div key={block.id} className="bg-bg-card border border-border-card rounded-2xl px-4 py-3">
              <p className="text-text-primary text-sm truncate">
                <span className="text-text-sec">{formatTimeRange(block.startTime, block.endTime)} · </span>
                {block.title}
                <span className="text-text-sec"> → </span>
                <span className="font-semibold">{block.missionLabel}</span>
              </p>
            </div>
          ))
        )}
      </div>
    </>
  )
}

function BusySources({
  timebudCalendarId,
  onChanged,
}: {
  timebudCalendarId: string | undefined
  onChanged: () => void
}) {
  const { data: sources = [], isLoading } = useCalendarSources()
  const setBusy = useSetCalendarSourceBusy()

  const timebudSource = sources.find((s) => s.calendar_id === timebudCalendarId)
  const otherSources = sources.filter((s) => s.calendar_id !== timebudCalendarId)

  const toggle = async (source: DbGoogleCalendarSource) => {
    await setBusy.mutateAsync({ calendarId: source.calendar_id, isBusySource: !source.is_busy_source })
    onChanged()
  }

  return (
    <>
      <h2 className="text-text-primary text-sm font-semibold mb-2 px-1">Count as busy</h2>
      <div className="space-y-2 mb-2">
        {timebudSource && (
          <div className="min-h-11 flex items-center justify-between gap-3 bg-bg-card border border-border-card rounded-2xl px-4 py-3">
            <span className="text-text-primary truncate">{timebudSource.summary || 'TimeBud'}</span>
            <span className="text-status-today text-sm font-semibold flex-shrink-0">Reservations</span>
          </div>
        )}
        {isLoading ? (
          <div className="h-11 bg-bg-card border border-border-card rounded-2xl animate-pulse"></div>
        ) : otherSources.length === 0 ? (
          <div className="bg-bg-card border border-border-card rounded-2xl px-4 py-3">
            <p className="text-text-sec text-sm">Your calendars will appear here after the next sync.</p>
          </div>
        ) : (
          otherSources.map((source) => (
            <button
              key={source.calendar_id}
              onClick={() => toggle(source)}
              disabled={setBusy.isPending}
              className="w-full min-h-11 flex items-center justify-between gap-3 px-4 py-3 bg-bg-card rounded-2xl border border-border-card disabled:opacity-60"
            >
              <span className="text-text-primary truncate">{source.summary || source.calendar_id}</span>
              <CheckBox checked={source.is_busy_source} />
            </button>
          ))
        )}
      </div>
      <p className="text-text-sec text-xs px-1 mb-6">
        Events on these calendars block off time. Only the TimeBud calendar gets jobs planned into it.
      </p>
    </>
  )
}

function PlanningHoursSettings() {
  const { data: settings } = useAISettings()
  const upsertSettings = useUpsertAISettings()

  const savedStart = settings?.planning_start_time || DEFAULT_PLANNING_HOURS.start
  const savedEnd = settings?.planning_end_time || DEFAULT_PLANNING_HOURS.end
  const savedGap = settings?.min_gap_minutes ?? DEFAULT_PLANNING_HOURS.minGapMinutes

  // Native time inputs fire change per segment while typing, so edits stay local and
  // persist once the field is left. Drafts overlay the saved value rather than being
  // cleared, which also avoids a flash of the old value while settings refetch.
  const [draftStart, setDraftStart] = useState<string | null>(null)
  const [draftEnd, setDraftEnd] = useState<string | null>(null)
  const [draftGap, setDraftGap] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const start = draftStart ?? savedStart
  const end = draftEnd ?? savedEnd
  const gap = draftGap ?? savedGap

  const commitHours = () => {
    if (!start || !end) return
    // 'HH:MM' compares correctly as text.
    if (end <= start) {
      setError('End must be after start.')
      return
    }
    setError(null)
    if (start === savedStart && end === savedEnd) return
    upsertSettings.mutate({ planning_start_time: start, planning_end_time: end })
  }

  const changeGap = (value: number) => {
    setDraftGap(value)
    upsertSettings.mutate({ min_gap_minutes: value })
  }

  const inputClass =
    'w-full h-11 bg-bg-card border border-border-card rounded-xl px-3 text-text-primary text-sm'

  return (
    <>
      <h2 className="text-text-primary text-sm font-semibold mb-2 px-1">Planning hours</h2>
      <div className="bg-bg-card border border-border-card rounded-2xl p-4 mb-2 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-text-sec text-xs mb-1 block">From</span>
            <input
              type="time"
              value={start}
              onChange={(e) => setDraftStart(e.target.value)}
              onBlur={commitHours}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-text-sec text-xs mb-1 block">To</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setDraftEnd(e.target.value)}
              onBlur={commitHours}
              className={inputClass}
            />
          </label>
        </div>
        <label className="block">
          <span className="text-text-sec text-xs mb-1 block">Minimum gap</span>
          <select value={gap} onChange={(e) => changeGap(Number(e.target.value))} className={inputClass}>
            {GAP_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-accent-pink text-xs">{error}</p>}
      </div>
      <p className="text-text-sec text-xs px-1 mb-6">TimeBud only plans between these hours.</p>
    </>
  )
}

export default function CalendarSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    isConnected,
    isLoading,
    connection,
    connect,
    disconnect,
    syncNow,
    isSyncing,
    lastSyncedAt,
    isStale,
  } = useGoogleCalendarConnection()
  const { data: mappings = [] } = useCalendarBlockMappings()
  const [editingMapping, setEditingMapping] = useState<DbCalendarBlockMapping | null>(null)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const errorParam = searchParams.get('error')
  const justConnected = searchParams.get('connected') === 'true'

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      await disconnect()
    } finally {
      setIsDisconnecting(false)
    }
  }

  // A calendar toggled on only starts counting at the next sync — kick one off so the
  // change lands now rather than on the next cron tick. Best-effort: the server may
  // report it skipped if one just ran.
  const resyncAfterToggle = () => {
    syncNow().catch(() => {})
  }

  const confirmedMappings = mappings.filter((m) => m.confirmed)
  const unconfirmedMappings = mappings.filter((m) => !m.confirmed)

  return (
    <AppShell showTabBar={false}>
      <div className="flex flex-col h-[calc(100vh-5rem)] pb-5">
      <div className="px-6 pt-4 mb-6 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => router.back()} className="text-text-primary">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-text-primary text-xl font-bold">Calendar</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8">
        {errorParam && (
          <div className="bg-accent-pink/10 border border-accent-pink rounded-2xl px-4 py-3 mb-4">
            <p className="text-accent-pink text-sm">{ERROR_MESSAGES[errorParam] || 'Something went wrong.'}</p>
          </div>
        )}
        {justConnected && (
          <div className="bg-accent-green/10 border border-accent-green rounded-2xl px-4 py-3 mb-4">
            <p className="text-accent-green text-sm font-medium">Connected! We created a &ldquo;TimeBud&rdquo; calendar for your time blocks.</p>
          </div>
        )}

        {/* Connection status card */}
        <div className="bg-bg-card border border-border-card rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-accent-yellow/15 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-accent-yellow" />
            </div>
            <div className="min-w-0">
              <p className="text-text-primary font-semibold">Google Calendar</p>
              {isLoading ? (
                <div className="h-3.5 w-32 bg-border-card rounded animate-pulse mt-1"></div>
              ) : (
                <p className="text-text-sec text-sm truncate">
                  {isConnected ? connection?.google_account_email || 'Connected' : 'Not connected'}
                </p>
              )}
            </div>
          </div>
          <p className="text-text-sec text-sm mb-4">
            Time-block your missions on a dedicated &ldquo;TimeBud&rdquo; calendar and this app will detect the
            block and suggest what to work on.
          </p>
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="w-full bg-bg-card-hover border border-border-card text-text-primary font-medium py-3 rounded-xl disabled:opacity-50"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={connect}
              className="w-full bg-accent-yellow text-on-light-accent font-bold py-3 rounded-xl shadow-[0_0_16px_rgba(245,197,24,0.35)]"
            >
              Connect Google Calendar
            </button>
          )}
          {isConnected && (
            <SyncStatus lastSyncedAt={lastSyncedAt} isStale={isStale} isSyncing={isSyncing} onSync={syncNow} />
          )}
        </div>

        {isConnected && unconfirmedMappings.length > 0 && (
          <>
            <h2 className="text-text-primary text-sm font-semibold mb-2 px-1">New blocks detected</h2>
            <div className="space-y-2 mb-6">
              {unconfirmedMappings.map((mapping) => (
                <button
                  key={mapping.id}
                  onClick={() => setEditingMapping(mapping)}
                  className="w-full flex items-center justify-between gap-3 bg-bg-card border border-accent-yellow/30 rounded-2xl px-4 py-3"
                >
                  <span className="text-text-primary truncate">&ldquo;{mapping.event_title}&rdquo;</span>
                  <span className="text-accent-yellow text-sm font-semibold flex-shrink-0">Set up →</span>
                </button>
              ))}
            </div>
          </>
        )}

        {isConnected && (
          <>
            <TodaysReservations />
            <BusySources timebudCalendarId={connection?.google_calendar_id} onChanged={resyncAfterToggle} />
            <PlanningHoursSettings />
          </>
        )}

        {isConnected && confirmedMappings.length > 0 && (
          <>
            <h2 className="text-text-primary text-sm font-semibold mb-2 px-1">Your block mappings</h2>
            <div className="space-y-2">
              {confirmedMappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between gap-3 bg-bg-card border border-border-card rounded-2xl px-4 py-3"
                >
                  <span className="text-text-primary truncate">&ldquo;{mapping.event_title}&rdquo;</span>
                  <button
                    onClick={() => setEditingMapping(mapping)}
                    className="text-text-sec hover:text-text-primary flex-shrink-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      </div>

      {editingMapping && (
        <MissionPicker mapping={editingMapping} onClose={() => setEditingMapping(null)} />
      )}
    </AppShell>
  )
}
