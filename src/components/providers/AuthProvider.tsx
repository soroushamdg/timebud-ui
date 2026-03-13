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
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user
        let { first_name, last_name } = user.user_metadata || {}
        let profile_image_url: string | null = null
        
        // Extract name from Google OAuth if not in metadata
        if (!first_name && !last_name && user.user_metadata?.name) {
          const fullName = user.user_metadata.name
          const nameParts = fullName.split(' ')
          first_name = nameParts[0] || ''
          last_name = nameParts.slice(1).join(' ') || ''
        }
        
        // Extract profile image from user metadata (Google, etc.)
        if (user.user_metadata?.avatar_url) {
          profile_image_url = user.user_metadata.avatar_url
        } else if (user.user_metadata?.picture) {
          profile_image_url = user.user_metadata.picture
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
          // Extract profile image from Google identity data
          if (!profile_image_url && googleIdentity?.identity_data?.picture) {
            profile_image_url = googleIdentity.identity_data.picture
          }
        }
        
        try {
          // Check if user already has a custom profile image
          const { data: existingUser } = await supabase
            .from('users')
            .select('profile_image_url')
            .eq('id', user.id)
            .maybeSingle()
          
          // Only set social provider image if user doesn't have a custom uploaded one
          // Custom uploads will be stored in Supabase Storage (contains 'supabase.co' or 'supabase.in')
          const hasCustomImage = existingUser?.profile_image_url && 
                                 (existingUser.profile_image_url.includes('supabase.co') || 
                                  existingUser.profile_image_url.includes('supabase.in'))
          
          const shouldUpdateImage = !hasCustomImage && profile_image_url
          
          // Upsert user to database
          const { error: userError } = await supabase
            .from('users')
            .upsert({
              id: user.id,
              email: user.email || '',
              first_name: first_name || '',
              last_name: last_name || '',
              ...(shouldUpdateImage ? { profile_image_url } : {}),
            }, {
              onConflict: 'id'
            })

          if (userError) {
            // Try server-side fallback
            try {
              await fetch('/api/auth/create-user', { method: 'POST' })
            } catch (fallbackError) {
              // Silent fallback
            }
          }

          // Initialize credits for new users
          try {
            const { data: existingCredits } = await supabase
              .from('user_credits')
              .select('user_id')
              .eq('user_id', user.id)
              .single()

            if (!existingCredits) {
              await fetch('/api/credits/init', { method: 'POST' })
            }
          } catch (error) {
            // Silent error handling
          }
        } catch (error) {
          // Silent error handling
        }
      } else if (event === 'SIGNED_OUT') {
        router.push('/auth/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  return <>{children}</>
}
