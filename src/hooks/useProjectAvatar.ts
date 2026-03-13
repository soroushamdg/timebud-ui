import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StaticAvatar } from '@/lib/avatars/config'

export function useStaticAvatars() {
  return useQuery<StaticAvatar[]>({
    queryKey: ['static-avatars'],
    queryFn: async () => {
      const response = await fetch('/api/avatars/static')
      if (!response.ok) {
        throw new Error('Failed to fetch static avatars')
      }
      return response.json()
    },
    staleTime: Infinity,
  })
}

export function useSetProjectAvatar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      staticPath,
    }: {
      projectId: string
      staticPath: string
    }) => {
      const response = await fetch('/api/avatars/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, staticPath }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to set project avatar')
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] })
    },
  })
}

export function useRemoveProjectAvatar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch('/api/avatars/project', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove project avatar')
      }

      return response.json()
    },
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}
