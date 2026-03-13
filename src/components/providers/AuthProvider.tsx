'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Session } from '@supabase/supabase-js'

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

  console.log('[AuthProvider] Rendering, session:', session?.user?.id)

  useEffect(() => {
    console.log('[AuthProvider] Setting up auth state listener')
    
    // Set up auth state change listener for real-time updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[AuthProvider] Auth state change:', { event, hasSession: !!newSession })
      setSession(newSession)
    })

    return () => {
      console.log('[AuthProvider] Cleaning up auth listener')
      subscription.unsubscribe()
    }
  }, [supabase])

  return (
    <AuthContext.Provider value={{ session }}>
      {children}
    </AuthContext.Provider>
  )
}
