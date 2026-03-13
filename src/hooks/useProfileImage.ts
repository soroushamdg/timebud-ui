import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useUploadProfileImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/avatars/profile', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload profile image')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useRemoveProfileImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/avatars/profile', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove profile image')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
