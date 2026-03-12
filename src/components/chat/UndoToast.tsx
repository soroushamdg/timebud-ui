'use client'

import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'

interface UndoToastProps {
  isVisible: boolean
  message: string
  onUndo: () => void
  onDismiss: () => void
  duration?: number
}

export function UndoToast({ 
  isVisible, 
  message, 
  onUndo, 
  onDismiss,
  duration = 5000 
}: UndoToastProps) {
  const [timeLeft, setTimeLeft] = useState(duration)

  useEffect(() => {
    if (!isVisible) {
      setTimeLeft(duration)
      return
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) {
          onDismiss()
          return 0
        }
        return prev - 100
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isVisible, duration, onDismiss])

  if (!isVisible) return null

  const progress = (timeLeft / duration) * 100

  return (
    <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50">
      <div className="bg-accent-yellow text-black rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-5 h-5" />
            <span className="font-medium">{message}</span>
          </div>
          <button
            onClick={() => {
              onUndo()
              onDismiss()
            }}
            className="bg-black text-accent-yellow font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Undo
          </button>
        </div>
        <div className="h-1 bg-black/20">
          <div 
            className="h-full bg-black transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
