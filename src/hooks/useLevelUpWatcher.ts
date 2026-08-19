import { useState } from 'react'
import { useAISettings } from '@/hooks/useAISettings'
import { getLevelProgress } from '@/lib/gamification/xp'

// Watches the persisted xp_total (src/lib/gamification/xp.ts, driven by the
// tasks_award_xp DB trigger) and surfaces a one-shot "you leveled up" moment when the
// derived level increases. No effect involved — the baseline is primed and the
// transition is derived directly during render (React's documented pattern for
// "adjusting state from a changing value"), so it never fires on initial load, only on
// a later increase observed during this session.
export function useLevelUpWatcher() {
  const { data: aiSettings } = useAISettings()
  const xpTotal = aiSettings?.xp_total
  const currentLevel = xpTotal !== undefined ? getLevelProgress(xpTotal).level : null

  const [baselineLevel, setBaselineLevel] = useState<number | null>(null)
  const [dismissedLevel, setDismissedLevel] = useState<number | null>(null)

  if (baselineLevel === null && currentLevel !== null) {
    setBaselineLevel(currentLevel)
  }

  const newLevel =
    baselineLevel !== null && currentLevel !== null && currentLevel > baselineLevel && dismissedLevel !== currentLevel
      ? getLevelProgress(xpTotal!)
      : null

  return {
    newLevel,
    dismiss: () => {
      if (currentLevel === null) return
      setDismissedLevel(currentLevel)
      setBaselineLevel(currentLevel)
    },
  }
}
