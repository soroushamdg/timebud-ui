'use client'

import { Copy, RotateCcw, MessageSquare, Pin, PinOff, X } from 'lucide-react'

interface QuickActionSheetProps {
  isOpen: boolean
  onClose: () => void
  onCopy: () => void
  onRetry: () => void
  onExplainMore: () => void
  onPin: () => void
  isPinned: boolean
}

export function QuickActionSheet({
  isOpen,
  onClose,
  onCopy,
  onRetry,
  onExplainMore,
  onPin,
  isPinned,
}: QuickActionSheetProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      
      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-bg-primary rounded-t-3xl pb-8 z-50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-white font-bold text-lg">Quick Actions</h2>
          <button 
            onClick={onClose}
            className="text-accent-pink hover:opacity-80 transition-opacity"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Divider */}
        <div className="border-b border-border-card mx-6" />
        
        {/* Actions */}
        <div className="px-6 py-4 space-y-2">
          <button
            onClick={() => {
              onCopy()
              onClose()
            }}
            className="w-full bg-bg-card border border-border-card rounded-lg p-4 flex items-center gap-4 hover:bg-bg-card-hover transition-colors"
          >
            <Copy className="w-5 h-5 text-accent-yellow" />
            <span className="text-white font-medium">Copy message</span>
          </button>

          <button
            onClick={() => {
              onRetry()
              onClose()
            }}
            className="w-full bg-bg-card border border-border-card rounded-lg p-4 flex items-center gap-4 hover:bg-bg-card-hover transition-colors"
          >
            <RotateCcw className="w-5 h-5 text-accent-yellow" />
            <span className="text-white font-medium">Retry</span>
          </button>

          <button
            onClick={() => {
              onExplainMore()
              onClose()
            }}
            className="w-full bg-bg-card border border-border-card rounded-lg p-4 flex items-center gap-4 hover:bg-bg-card-hover transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-accent-yellow" />
            <span className="text-white font-medium">Explain more</span>
          </button>

          <button
            onClick={() => {
              onPin()
              onClose()
            }}
            className="w-full bg-bg-card border border-border-card rounded-lg p-4 flex items-center gap-4 hover:bg-bg-card-hover transition-colors"
          >
            {isPinned ? (
              <>
                <PinOff className="w-5 h-5 text-accent-yellow" />
                <span className="text-white font-medium">Unpin message</span>
              </>
            ) : (
              <>
                <Pin className="w-5 h-5 text-accent-yellow" />
                <span className="text-white font-medium">Pin message</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
