'use client'

import { useState } from 'react'
import { ActionButton } from '@/types/ai'
import { Loader2, Check } from 'lucide-react'

interface ActionButtonGroupProps {
  buttons: ActionButton[]
  messageId: string
  onButtonExecuted: (buttonId: string) => void
  onError: (message: string) => void
  onSendPrompt?: (prompt: string) => void
}

export function ActionButtonGroup({
  buttons,
  messageId,
  onButtonExecuted,
  onError,
  onSendPrompt,
}: ActionButtonGroupProps) {
  const [loadingButtonId, setLoadingButtonId] = useState<string | null>(null)
  const [successButtonId, setSuccessButtonId] = useState<string | null>(null)
  const [confirmingButtonId, setConfirmingButtonId] = useState<string | null>(null)

  const handleButtonClick = async (button: ActionButton) => {
    // Handle confirmation for destructive actions
    if (button.requiresConfirmation && confirmingButtonId !== button.id) {
      setConfirmingButtonId(button.id)
      return
    }

    setLoadingButtonId(button.id)
    setConfirmingButtonId(null)

    try {
      const response = await fetch('/api/ai/action-button', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buttonId: button.id,
          action: button.action,
          context: {
            ...button.context,
            confirmed: button.requiresConfirmation ? true : undefined,
          },
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error?.message || 'Action failed')
      }

      // Show success state
      setSuccessButtonId(button.id)
      setTimeout(() => {
        setSuccessButtonId(null)
        onButtonExecuted(button.id)
      }, 1000)

      // Handle special actions
      if (data.action === 'navigate' && data.url) {
        window.location.href = data.url
      } else if (data.action === 'send_prompt' && data.prompt) {
        onSendPrompt?.(data.prompt)
      }
    } catch (error: any) {
      console.error('Button action error:', error)
      onError(error.message || 'Failed to execute action')
      setLoadingButtonId(null)
    }
  }

  const handleCancelConfirmation = () => {
    setConfirmingButtonId(null)
  }

  const getButtonStyle = (button: ActionButton) => {
    const baseClasses = 'px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0'
    
    if (confirmingButtonId === button.id) {
      return `${baseClasses} bg-bg-card border border-border-card text-white`
    }

    switch (button.style) {
      case 'primary':
        return `${baseClasses} bg-accent-yellow text-black hover:opacity-90`
      case 'secondary':
        return `${baseClasses} bg-bg-card border border-border-card text-white hover:bg-bg-card-hover`
      case 'danger':
        return `${baseClasses} bg-accent-pink text-white hover:opacity-90`
      case 'success':
        return `${baseClasses} bg-accent-green text-white hover:opacity-90`
      default:
        return `${baseClasses} bg-bg-card border border-border-card text-white hover:bg-bg-card-hover`
    }
  }

  if (buttons.length === 0) return null

  return (
    <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
      {buttons.map((button) => {
        const isLoading = loadingButtonId === button.id
        const isSuccess = successButtonId === button.id
        const isConfirming = confirmingButtonId === button.id

        if (isConfirming) {
          return (
            <div key={button.id} className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => handleButtonClick(button)}
                className="px-3 py-2 rounded-lg font-semibold bg-accent-pink text-white hover:opacity-90 transition-all text-sm"
              >
                Confirm
              </button>
              <button
                onClick={handleCancelConfirmation}
                className="px-3 py-2 rounded-lg font-semibold bg-bg-card border border-border-card text-white hover:bg-bg-card-hover transition-all text-sm"
              >
                Cancel
              </button>
            </div>
          )
        }

        return (
          <button
            key={button.id}
            onClick={() => handleButtonClick(button)}
            disabled={isLoading || isSuccess}
            className={getButtonStyle(button)}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSuccess && <Check className="w-4 h-4" />}
            {!isLoading && !isSuccess && button.label}
            {button.estimatedCredits && !isLoading && !isSuccess && (
              <span className="text-xs opacity-70">
                ({button.estimatedCredits} cr)
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
