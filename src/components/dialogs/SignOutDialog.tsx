'use client'

import { useState } from 'react'
import { X, LogOut } from 'lucide-react'

interface SignOutDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function SignOutDialog({ isOpen, onClose, onConfirm }: SignOutDialogProps) {
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleConfirm = async () => {
    setIsSigningOut(true)
    try {
      await onConfirm()
    } finally {
      setIsSigningOut(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-bg-card rounded-none w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-card">
          <h2 className="text-white font-bold text-lg">Sign Out</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-bg-card-hover flex items-center justify-center text-text-sec hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-accent-pink/20 flex items-center justify-center">
              <LogOut className="w-6 h-6 text-accent-pink" />
            </div>
          </div>
          
          <p className="text-text-sec text-center mb-4">
            Are you sure you want to sign out? You'll need to sign in again to access your account.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-border-card">
          <button
            onClick={onClose}
            disabled={isSigningOut}
            className="flex-1 bg-bg-primary border border-border-card text-white font-semibold py-3 rounded-lg hover:bg-bg-card-hover transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSigningOut}
            className="flex-1 bg-accent-pink text-white font-semibold py-3 rounded-lg hover:bg-accent-pink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSigningOut ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Signing Out...
              </>
            ) : (
              <>
                <LogOut size={16} />
                Sign Out
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
