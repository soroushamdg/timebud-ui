'use client'

import { Check, Sparkles } from 'lucide-react'
import { useOnboarding } from '@/components/providers/OnboardingProvider'
import './onboarding.css'

export function OnboardingScreen() {
  const { setupProgress } = useOnboarding()

  const steps = [
    { key: 'userCreated', label: 'Creating your profile', icon: '👤' },
    { key: 'creditsInitialized', label: 'Setting up your credits', icon: '✨' },
    { key: 'profileComplete', label: 'Ready to go!', icon: '🚀' },
  ]

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        {/* Logo and welcome */}
        <div className="mb-8">
          <h1 className="text-accent-yellow text-4xl font-bold mb-4">TimeBud</h1>
          <h2 className="text-white text-2xl font-bold mb-2">Welcome aboard!</h2>
          <p className="text-text-sec">Setting up your workspace...</p>
        </div>

        {/* Progress steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step, index) => {
            const isCompleted = setupProgress[step.key as keyof typeof setupProgress]
            const isCurrent = index === 0 || setupProgress[steps[index - 1].key as keyof typeof setupProgress]
            
            return (
              <div
                key={step.key}
                className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-accent-green/10 border border-accent-green/30' 
                    : isCurrent 
                    ? 'bg-bg-card border border-border-card' 
                    : 'bg-bg-primary border border-border-card/30'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  isCompleted 
                    ? 'bg-accent-green text-white' 
                    : isCurrent 
                    ? 'bg-accent-yellow text-black' 
                    : 'bg-border-card text-text-sec'
                }`}>
                  {isCompleted ? (
                    <Check size={20} />
                  ) : isCurrent ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    step.icon
                  )}
                </div>
                
                <div className="flex-1 text-left">
                  <p className={`font-medium ${
                    isCompleted ? 'text-accent-green' : isCurrent ? 'text-white' : 'text-text-sec'
                  }`}>
                    {step.label}
                  </p>
                  {isCompleted && (
                    <p className="text-sm text-accent-green/80">Complete</p>
                  )}
                  {isCurrent && !isCompleted && (
                    <p className="text-sm text-text-sec animate-pulse">Processing...</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Loading animation */}
        <div className="flex justify-center mb-8">
          <div className="flex gap-2">
            <Sparkles className="w-6 h-6 text-accent-yellow animate-pulse" />
            <Sparkles className="w-6 h-6 text-accent-yellow animate-pulse delay-100" />
            <Sparkles className="w-6 h-6 text-accent-yellow animate-pulse delay-200" />
          </div>
        </div>

        {/* Message */}
        <div className="text-text-sec text-sm">
          This will only take a moment...
        </div>
      </div>
    </div>
  )
}
