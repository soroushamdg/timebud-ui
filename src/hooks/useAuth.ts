import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '@/components/providers/AuthProvider'

export const useCurrentUser = () => {
  const { session } = useAuth()
  
  return useQuery({
    queryKey: ['auth-user'],
    queryFn: async (): Promise<User | null> => {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      console.log('[useCurrentUser] Auth check:', { user: user?.id, error })
      if (error) throw error
      return user
    },
    initialData: session?.user ?? null,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
}
