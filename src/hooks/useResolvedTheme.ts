'use client'

import { useEffect, useState } from 'react'
import { getResolvedTheme, THEME_CHANGE_EVENT } from '@/lib/theme'

// The theme actually on screen right now ('system' already resolved against the OS).
// Live: updates when the user switches theme in Settings, and — for 'system' — when
// the OS preference itself changes while the tab is open. Only needed by JS that
// can't just lean on CSS custom properties (e.g. a canvas draw call); regular
// components should use the color tokens directly instead.
export function useResolvedTheme(): 'dark' | 'light' {
  const [resolved, setResolved] = useState<'dark' | 'light'>(() => getResolvedTheme())

  useEffect(() => {
    const recompute = () => setResolved(getResolvedTheme())
    recompute()

    const media = window.matchMedia('(prefers-color-scheme: light)')
    media.addEventListener('change', recompute)
    window.addEventListener(THEME_CHANGE_EVENT, recompute)

    return () => {
      media.removeEventListener('change', recompute)
      window.removeEventListener(THEME_CHANGE_EVENT, recompute)
    }
  }, [])

  return resolved
}
