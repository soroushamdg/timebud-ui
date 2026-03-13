'use client'

import { useOnboarding } from '@/components/providers/OnboardingProvider'
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen'

export function AppWrapper({ children }: { children: React.ReactNode }) {
  const { isLoading, isOnboardingRequired } = useOnboarding()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (isOnboardingRequired) {
    return <OnboardingScreen />
  }

  return <>{children}</>
}
