'use client'

import { useAutoSizeText } from '@/hooks/useAutoSizeText'

interface AutoSizeTextProps {
  text: string
  className?: string
  avatarHeight?: number
  maxFontSize?: number
  minFontSize?: number
}

export function AutoSizeText({
  text,
  className = '',
  avatarHeight,
  maxFontSize = 18,
  minFontSize = 8
}: AutoSizeTextProps) {
  // Calculate max height as 40% of avatar height, or use fallback
  const maxHeight = avatarHeight ? Math.floor(avatarHeight * 0.4) : 40

  const { fontSize, isMultiline, textRef, containerRef } = useAutoSizeText({
    text,
    maxHeight,
    minFontSize,
    maxFontSize
  })

  return (
    <div ref={containerRef} className={`w-full h-full ${className}`}>
      <p
        ref={textRef}
        className="text-white font-bold leading-tight"
        style={{
          fontSize: `${fontSize}px`,
          display: isMultiline ? '-webkit-box' : 'block',
          WebkitLineClamp: isMultiline ? '3' : 'unset',
          WebkitBoxOrient: isMultiline ? 'vertical' : 'unset',
          overflow: 'hidden',
          wordBreak: 'break-word'
        }}
      >
        {text}
      </p>
    </div>
  )
}
