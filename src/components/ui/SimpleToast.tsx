'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface SimpleToastProps {
  isVisible: boolean
  message: string
  onDismiss: () => void
  duration?: number
  type?: 'info' | 'warning' | 'error' | 'success'
  action?: { label: string; onClick: () => void }
}

export function SimpleToast({
  isVisible,
  message,
  onDismiss,
  duration = 3000,
  type = 'info',
  action
}: SimpleToastProps) {
  useEffect(() => {
    if (!isVisible) return

    const timer = setTimeout(() => {
      onDismiss()
    }, duration)

    return () => clearTimeout(timer)
  }, [isVisible, duration, onDismiss])

  if (!isVisible) return null

  const bgColor = {
    info: 'bg-bg-card',
    warning: 'bg-accent-yellow',
    error: 'bg-red-500',
    success: 'bg-green-500'
  }[type]

  const textColor = {
    info: 'text-white',
    warning: 'text-black',
    error: 'text-white',
    success: 'text-white'
  }[type]

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] max-w-md mx-4">
      <div className={`${bgColor} ${textColor} rounded-lg shadow-lg px-4 py-3 flex items-center justify-between gap-3 border ${type === 'info' ? 'border-border-card' : 'border-transparent'}`}>
        <span className="font-medium text-sm">{message}</span>
        <div className="flex-shrink-0 flex items-center gap-2">
          {action && (
            <button
              onClick={action.onClick}
              className="text-xs font-bold bg-accent-yellow text-black px-3 py-1 rounded-full hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              {action.label}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="hover:opacity-70 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
