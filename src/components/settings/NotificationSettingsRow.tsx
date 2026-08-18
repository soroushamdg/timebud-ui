'use client'

import { useState } from 'react'
import { usePushSubscription } from '@/hooks/usePushSubscription'

// Master permission switch only — the six individual notification types (morning
// briefing, deadline alerts, weekly look-ahead, inactivity nudge, unfinished session,
// streaks) live on the dedicated /profile/notifications screen.
export function NotificationSettingsRow() {
  const { isSupported, isSubscribed, isLoading, enablePush, disablePush } = usePushSubscription()
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async () => {
    setError(null)
    try {
      if (isSubscribed) {
        await disablePush()
      } else {
        await enablePush()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <div className="bg-bg-card rounded-none px-4 py-4 mb-2">
      <div className="flex justify-between items-center">
        <div>
          <span className="text-white">Allow notifications</span>
          {!isSupported && (
            <p className="text-text-sec text-xs mt-0.5">Not supported on this device/browser</p>
          )}
        </div>
        <button
          onClick={handleToggle}
          disabled={!isSupported || isLoading}
          className={`w-12 h-6 rounded-full transition-colors disabled:opacity-50 flex-shrink-0 ${
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

      {error && <p className="text-accent-pink text-xs mt-2">{error}</p>}
    </div>
  )
}
