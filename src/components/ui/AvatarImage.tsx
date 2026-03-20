'use client'

import { memo } from 'react'
import { CachedImage } from './CachedImage'
import { imageCache, ImageCacheManager } from '@/lib/cache/imageCache'

interface AvatarImageProps {
  src?: string | null
  fallbackType: 'profile' | 'project'
  fallbackSeed?: string
  fallbackLabel?: string
  fallbackColor?: string
  size?: number
  className?: string
  onClick?: () => void
  userId?: string // For profile avatars
  projectId?: string // For project avatars
}

function AvatarImageComponent({
  src,
  fallbackType,
  fallbackSeed,
  fallbackLabel,
  fallbackColor = '#F5C518',
  size,
  className = '',
  onClick,
  userId,
  projectId,
}: AvatarImageProps) {
  const baseClasses = `rounded-none object-cover ${className}`

  // Generate cache key based on image type and IDs
  const getCacheKey = () => {
    if (src && userId) {
      return ImageCacheManager.generateProfileKey(userId)
    }
    if (src && projectId) {
      return ImageCacheManager.generateProjectKey(projectId)
    }
    if (src) {
      return ImageCacheManager.generateStaticKey(src)
    }
    return undefined
  }

  if (src) {
    return (
      <div 
        style={size ? { width: size, height: size } : undefined} 
        onClick={onClick} 
        className={`${baseClasses} w-full h-full relative`}
      >
        <CachedImage
          src={src}
          alt={fallbackType === 'profile' ? 'Profile avatar' : 'Project avatar'}
          cacheKey={getCacheKey()}
          className="w-full h-full object-cover"
          fallback={
            <div className="w-full h-full bg-bg-primary animate-pulse" />
          }
        />
        {/* Fade gradient overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-3/5 bg-gradient-to-t from-black/70 via-black/50 via-black/30 to-transparent pointer-events-none" />
      </div>
    )
  }

  // Use DiceBear initials for both profiles and projects
  const seed = fallbackType === 'profile' ? fallbackSeed : fallbackLabel
  
  if (seed) {
    const bgColor = fallbackColor.replace('#', '')
    const diceBearUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      seed
    )}&backgroundColor=${bgColor}&textColor=000000&fontSize=40&bold=true`

    return (
      <div 
        style={size ? { width: size, height: size } : undefined} 
        onClick={onClick} 
        className={`${baseClasses} w-full h-full relative`}
      >
        <CachedImage
          src={diceBearUrl}
          alt={fallbackType === 'profile' ? 'Profile avatar' : 'Project avatar'}
          cacheKey={ImageCacheManager.generateStaticKey(diceBearUrl)}
          className="w-full h-full object-cover"
          fallback={
            <div className="w-full h-full bg-bg-card" />
          }
        />
        {/* Fade gradient overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-3/5 bg-gradient-to-t from-black/70 via-black/50 via-black/30 to-transparent pointer-events-none" />
      </div>
    )
  }

  // Final fallback if no seed available
  return (
    <div
      className={`${baseClasses} bg-bg-card`}
      style={size ? { width: size, height: size } : undefined}
      onClick={onClick}
    />
  )
}

export const AvatarImage = memo(AvatarImageComponent)
