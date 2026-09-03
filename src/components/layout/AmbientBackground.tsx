'use client'

import { useEffect, useRef } from 'react'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'

const DESKTOP_QUERY = '(min-width: 768px)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resolvedTheme = useResolvedTheme()
  // The draw loop's closure is set up once on mount (see the effect below) and reads
  // this ref every frame, rather than tearing down/restarting the whole
  // ResizeObserver + rAF loop whenever the theme flips mid-session.
  const themeRef = useRef(resolvedTheme)
  themeRef.current = resolvedTheme
  const redrawRef = useRef<(() => void) | null>(null)

  // Reduced-motion draws exactly once (below) and never loops again, so a live
  // theme toggle needs an explicit nudge to repaint with the new color — the
  // animated path already picks it up on its next frame regardless.
  useEffect(() => {
    redrawRef.current?.()
  }, [resolvedTheme])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const desktopQuery = window.matchMedia(DESKTOP_QUERY)
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width * dpr))
      height = Math.max(1, Math.round(rect.height * dpr))
      canvas.width = width
      canvas.height = height
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let t = 0
    let frameId = 0

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      if (!desktopQuery.matches) return

      // White lines read as a soft glow on the dark theme's near-black background;
      // on light they need to go dark instead, or they'd be nearly invisible against
      // the near-white page.
      const [r, g, b] = themeRef.current === 'light' ? [0, 0, 0] : [255, 255, 255]

      const lines = 9
      for (let i = 0; i < lines; i++) {
        const baseY = ((i + 0.5) / lines) * height
        const amp1 = (height / lines) * 0.32
        const amp2 = amp1 * 0.4
        const alpha = 0.03 + (i % 3) * 0.01
        const step = Math.max(6, width / 140)

        ctx.beginPath()
        for (let x = 0; x <= width; x += step) {
          const y =
            baseY +
            amp1 * Math.sin(x * 0.0021 + t + i * 0.8) +
            amp2 * Math.sin(x * 0.0043 - t * 1.3 + i * 1.6)
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
        ctx.lineWidth = dpr
        ctx.stroke()
      }

      if (!reduceMotion) t += 0.0016
    }
    redrawRef.current = draw

    if (reduceMotion) {
      draw()
    } else {
      const loop = () => {
        draw()
        frameId = requestAnimationFrame(loop)
      }
      loop()
    }

    return () => {
      ro.disconnect()
      if (frameId) cancelAnimationFrame(frameId)
      redrawRef.current = null
    }
  }, [])

  return (
    <div className="hidden md:block fixed inset-0 -z-10 overflow-hidden bg-bg-primary" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="ambient-blob ambient-blob-1" />
      <div className="ambient-blob ambient-blob-2" />
    </div>
  )
}
