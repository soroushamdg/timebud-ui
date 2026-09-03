'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'

const FUN_LOADING_MESSAGES = [
  "Building your LEGO universe...",
  "Plastic bricks are warming up...",
  "Training minifigure models...",
  "Calculating stud positions...",
  "Mixing vibrant colors...",
  "Polishing LEGO surfaces...",
  "Designing perfect poses...",
  "Optimizing brick layouts...",
  "Adding magical touches...",
  "Finalizing your masterpiece..."
]

interface LoadingDialogProps {
  isOpen: boolean
  currentStage: string
  progress: number
}

export function LoadingDialog({ isOpen, currentStage, progress }: LoadingDialogProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [message, setMessage] = useState('')
  const [isChecked, setIsChecked] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setCurrentMessageIndex(0)
      setMessage('')
      setIsChecked(false)
      return
    }

    // Set initial message
    setMessage(FUN_LOADING_MESSAGES[0])

    // Cycle through fun messages
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => {
        const nextIndex = (prev + 1) % FUN_LOADING_MESSAGES.length
        setMessage(FUN_LOADING_MESSAGES[nextIndex])
        return nextIndex
      })
    }, 2000)

    return () => clearInterval(messageInterval)
  }, [isOpen])

  useEffect(() => {
    // Check the box when progress is complete
    setIsChecked(progress >= 100)
  }, [progress])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-scrim/80 flex items-center justify-center z-[200]">
      <div className="bg-bg-card rounded-3xl p-8 max-w-sm w-full mx-4 border border-border-card">
        {/* Yellow Circle Loader */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-16 h-16 bg-accent-yellow rounded-full animate-pulse" />
            <div className="absolute inset-0 w-16 h-16 bg-accent-yellow rounded-full animate-ping opacity-20" />
          </div>
        </div>

        {/* Single Message */}
        <div className="text-center mb-6">
          <h3 className="text-text-primary font-bold text-lg mb-4">{message}</h3>
          
          {/* Checkbox */}
          <div className="flex items-center justify-center gap-3">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isChecked 
                ? 'bg-accent-yellow border-accent-yellow' 
                : 'border-border-card'
            }`}>
              {isChecked && <Check size={12} className="text-on-light-accent" />}
            </div>
            <span className="text-text-sec text-sm">Completed</span>
          </div>
        </div>
      </div>
    </div>
  )
}
