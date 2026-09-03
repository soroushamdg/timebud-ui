'use client'

import { useEffect, useRef } from 'react'
import { useAISettings, useUpsertAISettings } from '@/hooks/useAISettings'
import { ThemePreference } from '@/types/database'
import { applyThemeAttributeAndNotify, writeCachedThemePreference } from '@/lib/theme'

// Reconciles the DOM's data-theme attribute (already correct on first paint — see
// layout.tsx, which renders it server-side from the DB) with whatever the DB
// actually says once the client-side query resolves. Only matters when they
// disagree: the preference was changed on another device since this one's session
// cookie was minted, or this is the very first load after signup (no row yet, both
// sides agree on 'dark' anyway). Also keeps the localStorage fast-path cache in
// sync so a client-side reload lands on the right theme immediately next time.
export function useThemeSync() {
  const { data: aiSettings } = useAISettings()
  const appliedRef = useRef<ThemePreference | null>(null)

  useEffect(() => {
    if (!aiSettings) return
    const preference = aiSettings.theme_preference ?? 'dark'
    if (appliedRef.current === preference) return
    appliedRef.current = preference
    writeCachedThemePreference(preference)
    applyThemeAttributeAndNotify(preference)
  }, [aiSettings])
}

// Exposes the current preference plus a setter for the Settings UI. Applies
// immediately (DOM + localStorage) so there's no flash/lag waiting on the mutation's
// round-trip, then persists to the DB in the background.
export function useTheme() {
  const { data: aiSettings } = useAISettings()
  const upsertSettings = useUpsertAISettings()

  const theme: ThemePreference = aiSettings?.theme_preference ?? 'dark'

  const setTheme = (preference: ThemePreference) => {
    writeCachedThemePreference(preference)
    applyThemeAttributeAndNotify(preference)
    upsertSettings.mutate({ theme_preference: preference })
  }

  return { theme, setTheme, isSaving: upsertSettings.isPending }
}
