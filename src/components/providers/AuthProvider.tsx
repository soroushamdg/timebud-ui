'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type User } from '@supabase/supabase-js'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.email)
      
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user
        let { first_name, last_name } = user.user_metadata || {}
        
        // Extract name from Google OAuth if not in metadata
        if (!first_name && !last_name && user.user_metadata?.name) {
          const fullName = user.user_metadata.name
          const nameParts = fullName.split(' ')
          first_name = nameParts[0] || ''
          last_name = nameParts.slice(1).join(' ') || ''
        }
        
        // Also try to extract from identity provider data
        if (!first_name && !last_name && user.identities) {
          const googleIdentity = user.identities.find(id => id.provider === 'google')
          if (googleIdentity?.identity_data?.name) {
            const fullName = googleIdentity.identity_data.name
            const nameParts = fullName.split(' ')
            first_name = nameParts[0] || ''
            last_name = nameParts.slice(1).join(' ') || ''
          }
        }
        
        console.log('Processing signed in user:', user.id, user.email, { first_name, last_name, provider: user.identities?.[0]?.provider })
        
        try {
          // Upsert user to database
          const { error: userError } = await supabase
            .from('users')
            .upsert({
              id: user.id,
              email: user.email || '',
              first_name: first_name || '',
              last_name: last_name || '',
            }, {
              onConflict: 'id'
            })

          if (userError) {
            console.error('Failed to upsert user:', userError)
            // Try server-side fallback
            try {
              const response = await fetch('/api/auth/create-user', { method: 'POST' })
              if (response.ok) {
                console.log('User created via server-side fallback')
              } else {
                console.error('Server-side user creation also failed:', await response.text())
              }
            } catch (fallbackError) {
              console.error('Fallback user creation failed:', fallbackError)
            }
          } else {
            console.log('User upserted successfully')
          }

          // Initialize credits for new users
          try {
            const { data: existingCredits } = await supabase
              .from('user_credits')
              .select('user_id')
              .eq('user_id', user.id)
              .single()

            if (!existingCredits) {
              console.log('Initializing credits for new user')
              const initResponse = await fetch('/api/credits/init', { method: 'POST' })
              if (initResponse.ok) {
                console.log('Credits initialized successfully')
              } else {
                console.error('Failed to initialize credits:', await initResponse.text())
              }
            } else {
              console.log('User already has credits')
            }
          } catch (error) {
            console.error('Failed to initialize credits on sign-in:', error)
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error)
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out')
        router.push('/auth/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  return <>{children}</>
}
