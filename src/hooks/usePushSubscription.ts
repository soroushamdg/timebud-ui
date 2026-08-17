'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUpsertAISettings } from '@/hooks/useAISettings'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function usePushSubscription() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const upsertSettings = useUpsertAISettings()

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
    setIsSupported(supported)
    if (!supported) return

    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setIsSubscribed(!!subscription))
      .catch(() => setIsSubscribed(false))
  }, [])

  const enablePush = useCallback(async () => {
    if (!isSupported) throw new Error('Push notifications are not supported on this device')

    setIsLoading(true)
    try {
      // The service worker is disabled outside production builds (see next.config.ts),
      // so navigator.serviceWorker.ready would hang forever in `next dev` with nothing
      // ever registered. Check for a real registration first and fail fast with a clear
      // message instead of letting that hang, or a downstream call fail cryptically.
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        throw new Error(
          'No active service worker found — push notifications only work in a production build (npm run build && npm run start), not in local dev.'
        )
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Notification permission was not granted')
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicKey) throw new Error('Push notifications are not configured')

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }))

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })

      // The reminder cron matches on the user's timezone; capture it here since there's
      // no separate timezone-picker UI in Settings.
      await upsertSettings.mutateAsync({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        reminder_enabled: true,
      })

      setIsSubscribed(true)
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, upsertSettings])

  const disablePush = useCallback(async () => {
    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()

      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }

      await upsertSettings.mutateAsync({ reminder_enabled: false })
      setIsSubscribed(false)
    } finally {
      setIsLoading(false)
    }
  }, [upsertSettings])

  return { isSupported, isSubscribed, isLoading, enablePush, disablePush }
}
