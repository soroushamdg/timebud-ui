'use client'

import { X, AlertCircle } from 'lucide-react'

interface ErrorDialogProps {
  isOpen: boolean
  title: string
  message: string
  onDismiss: () => void
}

export function ErrorDialog({ isOpen, title, message, onDismiss }: ErrorDialogProps) {
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[200]" onClick={onDismiss} />
      
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-bg-card rounded-2xl z-[210] max-w-sm w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-card">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent-pink bg-opacity-20 rounded-full flex items-center justify-center">
              <AlertCircle size={16} className="text-accent-pink" />
            </div>
            <h3 className="text-white font-semibold">{title}</h3>
          </div>
          <button
            onClick={onDismiss}
            className="w-6 h-6 rounded-lg bg-bg-primary flex items-center justify-center text-text-sec hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Message */}
        <div className="p-4">
          <p className="text-text-sec text-sm leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="p-4 pt-0">
          <button
            onClick={onDismiss}
            className="w-full bg-accent-pink text-white font-medium py-3 rounded-xl hover:bg-opacity-90 transition-opacity"
          >
            OK
          </button>
        </div>
      </div>
    </>
  )
}
