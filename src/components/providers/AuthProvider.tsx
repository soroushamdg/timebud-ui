'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { type Session } from '@supabase/supabase-js'
import { setLoggedInCookie, clearLoggedInCookie } from '@/lib/cross-domain-cookie'

interface AuthProviderProps {
  children: React.ReactNode
  initialSession: Session | null
}

interface AuthContextType {
  session: Session | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children, initialSession }: AuthProviderProps) {
  const [supabase] = useState(() => createClient())
  const [session, setSession] = useState<Session | null>(initialSession)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (initialSession) {
      setLoggedInCookie()
    }

    // Set up auth state change listener for real-time updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)

      // Keep the shared ['auth-user'] query cache in sync immediately. Without this,
      // a cache entry seeded with `null` before sign-in (e.g. by OnboardingProvider
      // mounting on /auth/login) never gets refreshed, since refetchOnMount/
      // refetchOnWindowFocus are disabled on that query — leaving the rest of the
      // app thinking no one is signed in until a full page reload.
      queryClient.setQueryData(['auth-user'], newSession?.user ?? null)

      if (newSession) {
        setLoggedInCookie()
      } else {
        clearLoggedInCookie()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, queryClient])

  return (
    <AuthContext.Provider value={{ session }}>
      {children}
    </AuthContext.Provider>
  )
}
