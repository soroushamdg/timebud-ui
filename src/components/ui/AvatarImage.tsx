'use client'

import { memo } from 'react'

interface AvatarImageProps {
  src?: string | null
  fallbackType: 'profile' | 'project'
  fallbackSeed?: string
  fallbackLabel?: string
  fallbackColor?: string
  size: number
  className?: string
  onClick?: () => void
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
}: AvatarImageProps) {
  const baseClasses = `rounded-none border-4 border-white object-cover ${className}`

  if (src) {
    return (
      <img
        src={src}
        alt="Avatar"
        width={size}
        height={size}
        className={baseClasses}
        onClick={onClick}
      />
    )
  }

  // Use DiceBear initials for both profiles and projects
  const seed = fallbackType === 'profile' ? fallbackSeed : fallbackLabel
  
  if (seed) {
    const diceBearUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      seed
    )}&backgroundColor=F5C518&textColor=000000&fontSize=40&bold=true`

    return (
      <img
        src={diceBearUrl}
        alt={fallbackType === 'profile' ? 'Profile avatar' : 'Project avatar'}
        className={baseClasses}
        style={{ width: size, height: size }}
        onClick={onClick}
      />
    )
  }

  // Final fallback if no seed available
  return (
    <div
      className={`${baseClasses} bg-bg-card`}
      style={{ width: size, height: size }}
      onClick={onClick}
    />
  )
}

export const AvatarImage = memo(AvatarImageComponent)
