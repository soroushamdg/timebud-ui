'use client'

import { useCallback } from 'react'
import { imageCache, ImageCacheManager } from '@/lib/cache/imageCache'

export function useImageCache() {
  
  const invalidateProfile = useCallback((userId: string) => {
    imageCache.invalidate(ImageCacheManager.generateProfileKey(userId))
  }, [])

  const invalidateProject = useCallback((projectId: string) => {
    imageCache.invalidate(ImageCacheManager.generateProjectKey(projectId))
  }, [])

  const invalidateStatic = useCallback((path: string) => {
    imageCache.invalidate(ImageCacheManager.generateStaticKey(path))
  }, [])

  const invalidateAllProfiles = useCallback(() => {
    imageCache.invalidatePattern('^profile_')
  }, [])

  const invalidateAllProjects = useCallback(() => {
    imageCache.invalidatePattern('^project_')
  }, [])

  const invalidateAllStatic = useCallback(() => {
    imageCache.invalidatePattern('^static_')
  }, [])

  const clearCache = useCallback(() => {
    imageCache.clear()
  }, [])

  return {
    invalidateProfile,
    invalidateProject,
    invalidateStatic,
    invalidateAllProfiles,
    invalidateAllProjects,
    invalidateAllStatic,
    clearCache
  }
}
