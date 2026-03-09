import { useQuery } from '@tanstack/react-query'

// Mock hook for now - replace with actual API call
export function useLatestUnfinished() {
  return useQuery({
    queryKey: ['latest-unfinished-session'],
    queryFn: async () => {
      // Mock return - replace with actual API call
      return null
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
