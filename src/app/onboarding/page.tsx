'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useAuth'

const ONBOARDING_STEPS = [
  {
    title: 'Welcome to TimeBud',
    description: 'Your personal focus companion to help you manage time and achieve your goals.',
    emoji: '👋',
  },
  {
    title: 'Plan Your Day',
    description: 'TimeBud helps you plan focused work sessions based on your tasks and available time.',
    emoji: '📅',
  },
  {
    title: 'Track Your Progress',
    description: 'Monitor your productivity and see how much time you spend on each project.',
    emoji: '📊',
  },
  {
    title: 'Stay Focused',
    description: 'Use our focus timer to stay on track and minimize distractions during work sessions.',
    emoji: '🎯',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { data: user, isLoading } = useCurrentUser()
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, isLoading, router])

  const handleComplete = () => {
    localStorage.setItem('onboarding_completed', 'true')
    router.push('/')
  }

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-sec">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const step = ONBOARDING_STEPS[currentStep]

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        {/* Progress indicator */}
        <div className="px-6 pt-8 pb-4">
          <div className="flex gap-2">
            {ONBOARDING_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-accent-yellow' : 'bg-[#2A2A2A]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content area - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="flex flex-col items-center justify-center min-h-full text-center">
            <div className="text-8xl mb-8">{step.emoji}</div>
            <h1 className="text-3xl font-bold text-white mb-4">{step.title}</h1>
            <p className="text-lg text-text-sec max-w-sm">{step.description}</p>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="px-6 pb-8 space-y-3">
          <button
            onClick={handleNext}
            className="w-full bg-accent-yellow text-black font-bold text-lg py-4 rounded-none hover:bg-yellow-400 transition-colors border border-white"
          >
            {currentStep === ONBOARDING_STEPS.length - 1 ? "Let's go to the app" : 'Next'}
          </button>
          
          {currentStep > 0 && (
            <button
              onClick={handlePrevious}
              className="w-full bg-transparent text-text-sec font-medium text-base py-3 rounded-none hover:text-white transition-colors"
            >
              Previous
            </button>
          )}
          
          {currentStep < ONBOARDING_STEPS.length - 1 && (
            <button
              onClick={handleComplete}
              className="w-full bg-transparent text-text-sec font-medium text-sm py-2 rounded-none hover:text-white transition-colors"
            >
              Skip onboarding
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
