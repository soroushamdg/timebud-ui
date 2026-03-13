'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface LoadingContextType {
  isLoading: boolean
  setLoadingComplete: () => void
  loadingProgress: number
  setLoadingProgress: (progress: number) => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)

  const setLoadingComplete = () => {
    setLoadingProgress(100)
    setTimeout(() => {
      setIsLoading(false)
    }, 300) // Small delay for smooth transition
  }

  // Auto-complete loading after 1 second if not manually completed
  useEffect(() => {
    const autoCompleteTimer = setTimeout(() => {
      if (isLoading) {
        setLoadingComplete()
      }
    }, 1000)

    return () => clearTimeout(autoCompleteTimer)
  }, [isLoading])

  return (
    <LoadingContext.Provider value={{
      isLoading,
      setLoadingComplete,
      loadingProgress,
      setLoadingProgress
    }}>
      {children}
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
}
