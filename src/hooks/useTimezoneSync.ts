'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useAISettings, useUpsertAISettings } from '@/hooks/useAISettings'

// Keeps user_ai_settings.timezone in sync with the browser's detected timezone —
// covers both the very first capture (previously only happened as a side effect of
// enabling push notifications) and travel (re-checked on window focus, so a phone
// waking up in a new timezone picks it up without needing a full reload). Respects
// auto_timezone_enabled: if the user has manually overridden their timezone in
// Settings, this stops touching it.
export function useTimezoneSync() {
  const { data: aiSettings } = useAISettings()
  const upsertSettings = useUpsertAISettings()
  const lastAttemptRef = useRef<string | null>(null)

  const check = useCallback(() => {
    if (!aiSettings || aiSettings.auto_timezone_enabled === false) return
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected === aiSettings.timezone || detected === lastAttemptRef.current) return
    lastAttemptRef.current = detected
    upsertSettings.mutate({ timezone: detected })
  }, [aiSettings, upsertSettings])

  useEffect(() => {
    check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [check])

  // Derived from the mutation's own state (not a local setState-in-effect) — true once
  // a sync-triggered update has actually landed in the query data.
  const justSyncedTo =
    upsertSettings.isSuccess && upsertSettings.variables?.timezone === aiSettings?.timezone
      ? (aiSettings?.timezone ?? null)
      : null

  return { justSyncedTo, resetJustSynced: upsertSettings.reset }
}
