'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useAuth'

interface OnboardingContextType {
  setupComplete: boolean
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [setupComplete, setSetupComplete] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { data: user, isLoading: userLoading } = useCurrentUser()

  useEffect(() => {
    if (userLoading || !user) {
      return
    }

    // Check if onboarding has been completed in localStorage
    const onboardingCompleted = localStorage.getItem('onboarding_completed')
    
    if (!onboardingCompleted && pathname !== '/onboarding' && !pathname.startsWith('/auth')) {
      console.log('[OnboardingProvider] Onboarding not completed, redirecting...')
      router.push('/onboarding')
      return
    }

    // Run background setup for new users
    performBackgroundSetup(user.id).catch(err => {
      console.error('[OnboardingProvider] Background setup failed:', err)
    })
  }, [user, userLoading, pathname, router])

  const performBackgroundSetup = async (userId: string) => {
    try {
      console.log('[OnboardingProvider] Starting background setup...')
      const supabase = createClient()

      // Check if user record exists
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      const userExists = !!userRecord && !userError

      // Check if credits exist
      const { data: creditsRecord, error: creditsError } = await supabase
        .from('user_credits')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()

      const creditsExist = !!creditsRecord && !creditsError

      // If everything exists, we're done
      if (userExists && creditsExist) {
        console.log('[OnboardingProvider] User fully set up')
        setSetupComplete(true)
        return
      }

      // Create user record if needed
      if (!userExists) {
        console.log('[OnboardingProvider] Creating user record...')
        try {
          const userResponse = await fetch('/api/auth/create-user', { method: 'POST' })
          if (userResponse.ok) {
            console.log('[OnboardingProvider] User created successfully')
          } else {
            console.error('[OnboardingProvider] Failed to create user:', await userResponse.text())
          }
        } catch (err) {
          console.error('[OnboardingProvider] Error creating user:', err)
        }
      }

      // Initialize credits if needed
      if (!creditsExist) {
        console.log('[OnboardingProvider] Initializing credits...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        try {
          const creditsResponse = await fetch('/api/credits/init', { method: 'POST' })
          if (creditsResponse.ok) {
            console.log('[OnboardingProvider] Credits initialized successfully')
          } else {
            console.error('[OnboardingProvider] Failed to initialize credits:', await creditsResponse.text())
          }
        } catch (err) {
          console.error('[OnboardingProvider] Error initializing credits:', err)
        }
      }

      setSetupComplete(true)
      console.log('[OnboardingProvider] Background setup complete')

    } catch (error) {
      console.error('[OnboardingProvider] Setup failed:', error)
      setSetupComplete(true)
    }
  }

  const value = {
    setupComplete,
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
