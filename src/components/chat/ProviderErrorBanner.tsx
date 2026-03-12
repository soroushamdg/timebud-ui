'use client'

import { AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ProviderErrorBannerProps {
  errorCode: string
  errorMessage: string
  onRetry?: () => void
}

export function ProviderErrorBanner({ errorCode, errorMessage, onRetry }: ProviderErrorBannerProps) {
  const router = useRouter()

  const showSettingsButton = errorCode === 'no_api_key' || errorCode === 'invalid_api_key'

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] bg-bg-card border-l-4 border-accent-pink text-white px-4 py-3 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-accent-pink flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1">Error</p>
            <p className="text-sm text-text-sec mb-3">{errorMessage}</p>
            <div className="flex gap-2">
              {showSettingsButton && (
                <button
                  onClick={() => router.push('/profile')}
                  className="bg-accent-yellow text-black text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Go to Settings
                </button>
              )}
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="bg-transparent border border-border-card text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-bg-card transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
