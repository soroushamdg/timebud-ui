import { useState, useEffect, useRef } from 'react'

interface UseAutoSizeTextOptions {
  maxHeight: number
  minFontSize: number
  maxFontSize: number
  text: string
}

export function useAutoSizeText({
  maxHeight,
  minFontSize = 8,
  maxFontSize = 18,
  text
}: UseAutoSizeTextOptions) {
  const [fontSize, setFontSize] = useState(maxFontSize)
  const [isMultiline, setIsMultiline] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = textRef.current
    const container = containerRef.current
    if (!element || !container) return

    const containerHeight = container.clientHeight
    let currentFontSize = maxFontSize
    let fits = false

    // Binary search for optimal font size
    while (minFontSize <= maxFontSize) {
      const mid = Math.floor((minFontSize + maxFontSize) / 2)
      element.style.fontSize = `${mid}px`
      element.style.whiteSpace = 'nowrap'
      
      const height = element.scrollHeight

      if (height <= containerHeight && element.scrollWidth <= container.clientWidth) {
        currentFontSize = mid
        minFontSize = mid + 1
        fits = true
      } else {
        maxFontSize = mid - 1
      }
    }

    // If text doesn't fit even at smallest size with nowrap, try multiline
    if (!fits && currentFontSize === minFontSize) {
      element.style.whiteSpace = 'normal'
      element.style.display = '-webkit-box'
      element.style.webkitLineClamp = '3'
      element.style.webkitBoxOrient = 'vertical'
      
      // Check if it fits with multiline
      if (element.scrollHeight <= containerHeight) {
        setIsMultiline(true)
      } else {
        // Reduce font size further for multiline
        let multilineFontSize = minFontSize
        while (multilineFontSize > 6 && element.scrollHeight > containerHeight) {
          multilineFontSize -= 1
          element.style.fontSize = `${multilineFontSize}px`
        }
        currentFontSize = multilineFontSize
        setIsMultiline(true)
      }
    }

    setFontSize(currentFontSize)
  }, [text, maxHeight, minFontSize, maxFontSize])

  return {
    fontSize,
    isMultiline,
    textRef,
    containerRef
  }
}
