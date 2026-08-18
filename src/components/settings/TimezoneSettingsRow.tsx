'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useAISettings, useUpsertAISettings } from '@/hooks/useAISettings'

function formatOffset(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(new Date())
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}

const ALL_TIMEZONES: string[] =
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []

export function TimezoneSettingsRow() {
  const { data: aiSettings } = useAISettings()
  const upsertSettings = useUpsertAISettings()
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')

  const timezone = aiSettings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const autoDetect = aiSettings?.auto_timezone_enabled !== false

  const filteredZones = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? ALL_TIMEZONES.filter((tz) => tz.toLowerCase().replace(/_/g, ' ').includes(q)) : ALL_TIMEZONES
    return list.slice(0, 200)
  }, [search])

  const handleToggleAutoDetect = () => {
    upsertSettings.mutate({
      auto_timezone_enabled: !autoDetect,
      // Turning auto-detect back on immediately re-syncs to the device's real timezone
      // rather than waiting for the next mount/focus check.
      ...(autoDetect ? {} : { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    })
  }

  const handlePick = (tz: string) => {
    upsertSettings.mutate({ timezone: tz, auto_timezone_enabled: false })
    setShowPicker(false)
    setSearch('')
  }

  return (
    <>
      <div className="bg-bg-card rounded-none px-4 py-4 mb-2">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-white">Timezone</span>
            <p className="text-text-sec text-xs mt-0.5">
              {timezone.replace(/_/g, ' ')} ({formatOffset(timezone)})
            </p>
          </div>
          <button
            onClick={handleToggleAutoDetect}
            disabled={upsertSettings.isPending}
            className={`w-12 h-6 rounded-full transition-colors disabled:opacity-50 flex-shrink-0 ${
              autoDetect ? 'bg-accent-yellow' : 'bg-border-card'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                autoDetect ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="text-text-sec text-xs mt-2">
          {autoDetect
            ? 'Auto-detected — updates automatically if you travel.'
            : 'Manually set — won\'t change automatically.'}
        </p>

        {!autoDetect && (
          <button
            onClick={() => setShowPicker(true)}
            className="mt-3 w-full bg-bg-card-hover border border-border-card text-white py-2 rounded-lg text-sm hover:border-accent-yellow transition-colors"
          >
            Change timezone
          </button>
        )}
      </div>

      {showPicker && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-end" onClick={() => setShowPicker(false)}>
          <div
            className="w-full max-w-md mx-auto bg-black rounded-t-3xl p-6 pb-8 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-xl font-bold">Choose timezone</h2>
              <button onClick={() => setShowPicker(false)} className="text-text-sec">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 text-text-sec absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search city or region"
                autoFocus
                className="w-full bg-bg-card border border-border-card rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-text-sec focus:outline-none focus:border-accent-yellow"
              />
            </div>

            <div className="overflow-y-auto flex-1 -mx-2">
              {filteredZones.map((tz) => (
                <button
                  key={tz}
                  onClick={() => handlePick(tz)}
                  className={`w-full text-left px-2 py-3 rounded-lg flex items-center justify-between hover:bg-bg-card-hover transition-colors ${
                    tz === timezone ? 'text-accent-yellow' : 'text-white'
                  }`}
                >
                  <span className="text-sm">{tz.replace(/_/g, ' ')}</span>
                  <span className="text-text-sec text-xs">{formatOffset(tz)}</span>
                </button>
              ))}
              {filteredZones.length === 0 && (
                <p className="text-text-sec text-sm text-center py-6">No matches</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
