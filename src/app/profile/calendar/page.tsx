'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Calendar, Check, X, Pencil } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useGoogleCalendarConnection } from '@/hooks/useGoogleCalendarConnection'
import { useCalendarBlockMappings, useConfirmBlockMapping } from '@/hooks/useCalendarBlockMappings'
import { useProjects } from '@/hooks/useProjects'
import { DbCalendarBlockMapping } from '@/types/database'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'That connection attempt expired — please try again.',
  unauthorized: 'You were signed out — please log in and try again.',
  no_refresh_token: "Google didn't grant lasting access — try disconnecting any prior TimeBud access in your Google Account and reconnecting.",
  connect_failed: 'Something went wrong connecting to Google Calendar. Please try again.',
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
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-black rounded-t-3xl p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-white text-lg font-bold">&ldquo;{mapping.event_title}&rdquo;</h2>
          <button onClick={onClose} className="text-text-sec hover:text-white">
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
              <span className="text-white truncate">{project.name}</span>
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                  selected.includes(project.id) ? 'bg-accent-yellow' : 'border border-border-card'
                }`}
              >
                {selected.includes(project.id) && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={selected.length === 0 || confirmMapping.isPending}
          className="w-full mt-4 bg-accent-yellow text-black font-bold py-3 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(245,197,24,0.35)]"
        >
          {confirmMapping.isPending ? 'Saving...' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}

export default function CalendarSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isConnected, isLoading, connection, connect, disconnect } = useGoogleCalendarConnection()
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

  const confirmedMappings = mappings.filter((m) => m.confirmed)
  const unconfirmedMappings = mappings.filter((m) => !m.confirmed)

  return (
    <AppShell showTabBar={false}>
      <div className="px-6 pt-4 mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-xl font-bold">Calendar</h1>
      </div>

      <div className="px-4 pb-8">
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
              <p className="text-white font-semibold">Google Calendar</p>
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
              className="w-full bg-bg-card-hover border border-border-card text-white font-medium py-3 rounded-xl disabled:opacity-50"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={connect}
              className="w-full bg-accent-yellow text-black font-bold py-3 rounded-xl shadow-[0_0_16px_rgba(245,197,24,0.35)]"
            >
              Connect Google Calendar
            </button>
          )}
        </div>

        {isConnected && unconfirmedMappings.length > 0 && (
          <>
            <h2 className="text-white text-sm font-semibold mb-2 px-1">New blocks detected</h2>
            <div className="space-y-2 mb-6">
              {unconfirmedMappings.map((mapping) => (
                <button
                  key={mapping.id}
                  onClick={() => setEditingMapping(mapping)}
                  className="w-full flex items-center justify-between gap-3 bg-bg-card border border-accent-yellow/30 rounded-2xl px-4 py-3"
                >
                  <span className="text-white truncate">&ldquo;{mapping.event_title}&rdquo;</span>
                  <span className="text-accent-yellow text-sm font-semibold flex-shrink-0">Set up →</span>
                </button>
              ))}
            </div>
          </>
        )}

        {isConnected && confirmedMappings.length > 0 && (
          <>
            <h2 className="text-white text-sm font-semibold mb-2 px-1">Your block mappings</h2>
            <div className="space-y-2">
              {confirmedMappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between gap-3 bg-bg-card border border-border-card rounded-2xl px-4 py-3"
                >
                  <span className="text-white truncate">&ldquo;{mapping.event_title}&rdquo;</span>
                  <button
                    onClick={() => setEditingMapping(mapping)}
                    className="text-text-sec hover:text-white flex-shrink-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {editingMapping && (
        <MissionPicker mapping={editingMapping} onClose={() => setEditingMapping(null)} />
      )}
    </AppShell>
  )
}
