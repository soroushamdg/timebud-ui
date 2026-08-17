'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

export type MobilePlatform = 'ios' | 'android' | null

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function detectPlatform(): MobilePlatform {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return null
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

// Platform doesn't change during a session, so no subscription is needed — this just
// gives useSyncExternalStore a client/server-safe way to read it once.
function subscribeNever() {
  return () => {}
}

function subscribeToDisplayMode(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia('(display-mode: standalone)')
  mql.addEventListener('change', onChange)
  window.addEventListener('appinstalled', onChange)
  return () => {
    mql.removeEventListener('change', onChange)
    window.removeEventListener('appinstalled', onChange)
  }
}

export function useInstallPrompt() {
  // useSyncExternalStore is the correct primitive for reading browser-only values like
  // these (avoids SSR mismatches without needing a synchronous setState-in-effect).
  const platform = useSyncExternalStore(subscribeNever, detectPlatform, () => null)
  const isStandalone = useSyncExternalStore(subscribeToDisplayMode, detectStandalone, () => false)

  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredEvent) return false
    await deferredEvent.prompt()
    const { outcome } = await deferredEvent.userChoice
    setDeferredEvent(null)
    return outcome === 'accepted'
  }

  return {
    platform,
    isStandalone,
    canPromptNatively: !!deferredEvent,
    promptInstall,
  }
}
