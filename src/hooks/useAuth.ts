import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['auth-user'],
    queryFn: async (): Promise<User | null> => {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    },
    staleTime: Infinity,
  })
}
