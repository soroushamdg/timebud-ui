import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { UserCredits } from '@/types/credits'
import { ActionType } from '@/types/credits'
import { LOW_CREDIT_THRESHOLD } from '@/lib/credits/config'

export function useCredits() {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['credits'],
    queryFn: async (): Promise<UserCredits | null> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) {
        // If user doesn't have credits yet, initialize them
        if (error.code === 'PGRST116') {
          try {
            console.log('No credits found, initializing for user:', user.id)
            const initResponse = await fetch('/api/credits/init', { method: 'POST' })
            if (initResponse.ok) {
              // Retry the query after initialization
              const { data: retryData, error: retryError } = await supabase
                .from('user_credits')
                .select('*')
                .eq('user_id', user.id)
                .single()
              
              if (!retryError && retryData) {
                console.log('Credits initialized successfully')
                return retryData
              }
            } else {
              console.error('Failed to initialize credits:', await initResponse.text())
            }
          } catch (initError) {
            console.error('Failed to initialize credits:', initError)
          }
        }
        
        // Also ensure user exists in users table
        try {
          const userResponse = await fetch('/api/auth/create-user', { method: 'POST' })
          if (userResponse.ok) {
            const result = await userResponse.json()
            console.log('User creation fallback:', result.created ? 'created' : 'already exists')
          }
        } catch (userError) {
          console.error('User creation fallback failed:', userError)
        }
        
        console.error('Failed to fetch credits:', error)
        return null
      }

      if (data) {
        const renewalDate = new Date(data.free_renewal_at)
        const now = new Date()

        if (renewalDate <= now) {
          try {
            await fetch('/api/credits/renew', { method: 'POST' })
            queryClient.invalidateQueries({ queryKey: ['credits'] })
          } catch (error) {
            console.error('Auto-renewal failed:', error)
          }
        }
      }

      return data
    },
    staleTime: 30_000,
  })
}

export function useTotalCredits() {
  const { data: credits, isLoading } = useCredits()

  if (!credits) {
    return {
      total: 0,
      free: 0,
      purchased: 0,
      isLow: false,
      renewalDate: null,
      proSubscriber: false,
      isLoading,
    }
  }

  const total = credits.free_credits + credits.purchased_credits
  const threshold = credits.monthly_allowance * LOW_CREDIT_THRESHOLD
  const isLow = total <= threshold

  const renewalDate = new Date(credits.free_renewal_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return {
    total,
    free: credits.free_credits,
    purchased: credits.purchased_credits,
    isLow,
    renewalDate,
    proSubscriber: credits.pro_subscriber,
    monthlyAllowance: credits.monthly_allowance,
    isLoading,
  }
}

export function useDeductCredits() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { actionType: ActionType; description?: string }) => {
      const response = await fetch('/api/credits/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error('Failed to deduct credits')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] })
    },
  })
}
