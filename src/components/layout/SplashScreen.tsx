'use client'

import { useEffect, useState } from 'react'
import { useLoading } from '@/contexts/LoadingContext'

export function SplashScreen() {
  const { isLoading, loadingProgress } = useLoading()
  const [shouldRender, setShouldRender] = useState(true)

  useEffect(() => {
    if (!isLoading) {
      // Keep rendering for fade out animation
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  if (!shouldRender) return null

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-bg-primary transition-opacity duration-500 ${
        isLoading ? 'opacity-100' : 'opacity-0'
      }`}
      role="status"
      aria-label="Loading TimeBud application"
    >
      <div className="relative">
        {/* Grey background icon */}
        <img
          src="/splash-icon.png"
          alt="TimeBud loading"
          className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 filter grayscale opacity-30"
        />
        
        {/* Color fill icon with clip-path animation */}
        <div 
          className="absolute inset-0 overflow-hidden"
          style={{
            clipPath: `inset(${100 - loadingProgress}% 0 0 0)`,
            transition: 'clip-path 0.3s ease-out'
          }}
        >
          <img
            src="/splash-icon.png"
            alt="TimeBud loading"
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
          />
        </div>
      </div>
    </div>
  )
}
