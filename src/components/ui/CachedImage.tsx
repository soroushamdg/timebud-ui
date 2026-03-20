'use client'

import { useState, useEffect, useRef } from 'react'
import { imageCache } from '@/lib/cache/imageCache'

interface CachedImageProps {
  src: string
  alt: string
  className?: string
  cacheKey?: string
  fallback?: React.ReactNode
  onLoad?: () => void
  onError?: () => void
}

export function CachedImage({ 
  src, 
  alt, 
  className, 
  cacheKey, 
  fallback,
  onLoad,
  onError 
}: CachedImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!src) return

    const key = cacheKey || src
    const cachedUrl = imageCache.get(key)

    if (cachedUrl) {
      setImageSrc(cachedUrl)
      setIsLoading(false)
      setHasError(false)
      return
    }

    // Check if image is already loaded and cached by browser
    if (imgRef.current?.complete) {
      setImageSrc(src)
      setIsLoading(false)
      setHasError(false)
      imageCache.set(key, src)
      return
    }

    setIsLoading(true)
    setHasError(false)

    // Create new image to test loading
    const testImg = new Image()
    
    testImg.onload = () => {
      setImageSrc(src)
      setIsLoading(false)
      setHasError(false)
      imageCache.set(key, src)
      onLoad?.()
    }

    testImg.onerror = () => {
      setIsLoading(false)
      setHasError(true)
      onError?.()
    }

    testImg.src = src
  }, [src, cacheKey, onLoad, onError])

  if (hasError && fallback) {
    return <>{fallback}</>
  }

  if (hasError) {
    return (
      <div className={`bg-bg-primary ${className}`}>
        <span className="text-text-sec text-xs">Failed to load</span>
      </div>
    )
  }

  if (isLoading && !imageSrc) {
    return (
      <div className={`bg-bg-primary animate-pulse ${className}`}>
        <span className="text-text-sec text-xs">Loading...</span>
      </div>
    )
  }

  return (
    <img
      ref={imgRef}
      src={imageSrc || src}
      alt={alt}
      className={className}
      onLoad={onLoad}
      onError={onError}
    />
  )
}
