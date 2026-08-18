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
      // Actively (re)register rather than assuming one already exists from page load.
      // The service worker is disabled outside production builds (see next.config.ts),
      // so this naturally fails with a clear message in `next dev` instead of the
      // registration attempt hanging or a downstream call failing cryptically.
      let registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        try {
          registration = await navigator.serviceWorker.register('/sw.js')
        } catch {
          throw new Error(
            'Could not set up a service worker — push notifications only work in a production build (npm run build && npm run start), not in local dev.'
          )
        }
      }
      // Wait for it to finish installing/activating before subscribing.
      registration = await navigator.serviceWorker.ready

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

      // Timezone capture/sync is handled globally by useTimezoneSync — just enable
      // reminders here.
      await upsertSettings.mutateAsync({ reminder_enabled: true })

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
