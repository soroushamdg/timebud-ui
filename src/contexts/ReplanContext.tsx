import { createContext, useContext, useCallback, useRef } from 'react'

interface ReplanContextType {
  triggerReplan: () => void
  registerReplanFunction: (fn: () => Promise<void>) => void
}

const ReplanContext = createContext<ReplanContextType | null>(null)

export function ReplanProvider({ children }: { children: React.ReactNode }) {
  const replanFunctionRef = useRef<(() => Promise<void>) | null>(null)

  const registerReplanFunction = useCallback((fn: () => Promise<void>) => {
    replanFunctionRef.current = fn
  }, [])

  const triggerReplan = useCallback(async () => {
    if (replanFunctionRef.current) {
      try {
        await replanFunctionRef.current()
      } catch (error) {
        console.error('Failed to trigger re-planning:', error)
      }
    }
  }, [])

  return (
    <ReplanContext.Provider value={{ triggerReplan, registerReplanFunction }}>
      {children}
    </ReplanContext.Provider>
  )
}

export function useReplan() {
  const context = useContext(ReplanContext)
  if (!context) {
    throw new Error('useReplan must be used within a ReplanProvider')
  }
  return context
}
