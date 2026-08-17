'use client'

import { useState } from 'react'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useAISettings, useUpsertAISettings } from '@/hooks/useAISettings'

const DEFAULT_REMINDER_TIME = '20:00'

export function NotificationSettingsRow() {
  const { data: aiSettings } = useAISettings()
  const { isSupported, isSubscribed, isLoading, enablePush, disablePush } = usePushSubscription()
  const upsertSettings = useUpsertAISettings()
  const [error, setError] = useState<string | null>(null)
  // Local override so the picker feels instant; falls back to the persisted value once
  // loaded, and to a sane default before that — no effect-based hydration needed.
  const [pendingTime, setPendingTime] = useState<string | null>(null)
  const reminderTime = pendingTime ?? aiSettings?.reminder_time ?? DEFAULT_REMINDER_TIME

  const handleToggle = async () => {
    setError(null)
    try {
      if (isSubscribed) {
        await disablePush()
      } else {
        await enablePush()
        await upsertSettings.mutateAsync({ reminder_time: reminderTime })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const handleTimeChange = async (value: string) => {
    setPendingTime(value)
    await upsertSettings.mutateAsync({ reminder_time: value })
  }

  return (
    <div className="bg-bg-card rounded-none px-4 py-4 mb-2">
      <div className="flex justify-between items-center">
        <div>
          <span className="text-white">Notifications</span>
          {!isSupported && (
            <p className="text-text-sec text-xs mt-0.5">Not supported on this device/browser</p>
          )}
        </div>
        <button
          onClick={handleToggle}
          disabled={!isSupported || isLoading}
          className={`w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${
            isSubscribed ? 'bg-accent-yellow' : 'bg-border-card'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform ${
              isSubscribed ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {isSubscribed && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-text-sec text-sm">Daily reminder time</span>
          <input
            type="time"
            value={reminderTime}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="bg-bg-card-hover border border-border-card text-white px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:border-accent-yellow"
          />
        </div>
      )}

      {error && <p className="text-accent-pink text-xs mt-2">{error}</p>}
    </div>
  )
}
