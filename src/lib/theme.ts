import { ThemePreference } from '@/types/database'

// Client-side fast-path cache: written the instant the user changes their
// preference (or the DB value loads and differs), read back on the next visit so
// the correct data-theme attribute can be applied before hydration — no localStorage
// round-trip needed for the *first* visit though, since the server already renders
// the right attribute from the DB (see layout.tsx). This just keeps subsequent
// client-side navigations/reloads correct without waiting on a query refetch.
export const THEME_STORAGE_KEY = 'timebud-theme'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system'
}

// 'dark' (the implicit default, no attribute) intentionally isn't written to the
// DOM — an absent attribute and an explicit data-theme="dark" resolve identically,
// so leaving it off keeps the common case's markup untouched.
export function applyThemeAttribute(preference: ThemePreference) {
  if (typeof document === 'undefined') return
  if (preference === 'dark') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', preference)
  }
}

export function readCachedThemePreference(): ThemePreference | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(cached) ? cached : null
  } catch {
    return null
  }
}

export function writeCachedThemePreference(preference: ThemePreference) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage can throw in private-browsing/quota-exceeded situations — the DB
    // value is still authoritative on next load via SSR, so this is fine to drop.
  }
}

// The theme actually painted right now — resolves 'system' against the OS's live
// preference. Used by JS that can't just rely on CSS tokens (e.g. an AmbientBackground
// canvas draw call choosing a stroke color).
export function getResolvedTheme(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark'
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light') return 'light'
  if (attr === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return 'dark'
}

// Fired whenever applyThemeAttribute changes the DOM attribute, so useResolvedTheme
// (and anything else watching) can recompute without polling or a MutationObserver.
export const THEME_CHANGE_EVENT = 'timebud-theme-attribute-change'

export function applyThemeAttributeAndNotify(preference: ThemePreference) {
  applyThemeAttribute(preference)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }
}
