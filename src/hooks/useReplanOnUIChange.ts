import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useReplan } from '@/contexts/ReplanContext'

export function useReplanOnUIChange() {
  const { preferredBudgetMinutes, allowPartialTasks } = useUIStore()
  const { triggerReplan } = useReplan()

  // Trigger re-planning when budget minutes or partial tasks setting changes
  useEffect(() => {
    triggerReplan()
  }, [preferredBudgetMinutes, allowPartialTasks, triggerReplan])
}
