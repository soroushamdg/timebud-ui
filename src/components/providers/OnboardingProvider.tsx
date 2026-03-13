'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface OnboardingContextType {
  isLoading: boolean
  isOnboardingRequired: boolean
  setupProgress: {
    userCreated: boolean
    creditsInitialized: boolean
    profileComplete: boolean
  }
  completeOnboarding: () => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [isOnboardingRequired, setIsOnboardingRequired] = useState(false)
  const [setupProgress, setSetupProgress] = useState({
    userCreated: false,
    creditsInitialized: false,
    profileComplete: false,
  })
  const router = useRouter()

  useEffect(() => {
    checkOnboardingStatus()
  }, [])

  const checkOnboardingStatus = async () => {
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        setIsLoading(false)
        return
      }

      // Check if user record exists
      const { data: userRecord } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('id', user.id)
        .single()

      const userCreated = !!userRecord
      const profileComplete = !!(userRecord?.first_name || userRecord?.last_name)

      // Check if credits exist
      const { data: creditsRecord } = await supabase
        .from('user_credits')
        .select('user_id')
        .eq('user_id', user.id)
        .single()

      const creditsInitialized = !!creditsRecord

      setSetupProgress({
        userCreated,
        creditsInitialized,
        profileComplete,
      })

      // If everything is set up, no onboarding needed
      if (userCreated && creditsInitialized) {
        setIsOnboardingRequired(false)
        setIsLoading(false)
        return
      }

      // Perform setup in sequence
      await performSetup(user.id, user, userCreated, creditsInitialized)

    } catch (error) {
      console.error('Onboarding check failed:', error)
      setIsLoading(false)
    }
  }

  const performSetup = async (userId: string, user: any, userExists: boolean, creditsExist: boolean) => {
    setIsOnboardingRequired(true)
    
    try {
      // Step 1: Ensure user exists
      if (!userExists) {
        console.log('Creating user record...')
        const userResponse = await fetch('/api/auth/create-user', { method: 'POST' })
        if (userResponse.ok) {
          setSetupProgress(prev => ({ ...prev, userCreated: true }))
        } else {
          console.error('Failed to create user:', await userResponse.text())
        }
      }

      // Step 2: Ensure credits exist
      if (!creditsExist) {
        console.log('Initializing credits...')
        // Wait a bit for user creation to complete
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const creditsResponse = await fetch('/api/credits/init', { method: 'POST' })
        if (creditsResponse.ok) {
          setSetupProgress(prev => ({ ...prev, creditsInitialized: true }))
        } else {
          console.error('Failed to initialize credits:', await creditsResponse.text())
        }
      }

      // Step 3: Complete onboarding
      await new Promise(resolve => setTimeout(resolve, 500))
      completeOnboarding()

    } catch (error) {
      console.error('Setup failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const completeOnboarding = () => {
    setIsOnboardingRequired(false)
    setSetupProgress({
      userCreated: true,
      creditsInitialized: true,
      profileComplete: true,
    })
  }

  const value = {
    isLoading,
    isOnboardingRequired,
    setupProgress,
    completeOnboarding,
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}
