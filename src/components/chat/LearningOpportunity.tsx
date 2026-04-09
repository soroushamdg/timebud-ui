'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react'
import { LearningOpportunity as LearningOpportunityType } from '@/types/ai'

interface LearningOpportunityProps {
  opportunity: LearningOpportunityType
  messageId: string
  onDismiss: () => void
}

export function LearningOpportunity({
  opportunity,
  messageId,
  onDismiss,
}: LearningOpportunityProps) {
  const [feedback, setFeedback] = useState<boolean | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFeedback = async (confirmed: boolean) => {
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/ai/estimation-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: opportunity.taskId,
          confirmed,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setFeedback(confirmed)
        setTimeout(() => {
          onDismiss()
        }, 2000)
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (feedback !== null) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-accent-green">
        <Check className="w-4 h-4" />
        <span>Thanks for the feedback!</span>
      </div>
    )
  }

  return (
    <div className="mt-3 bg-bg-card border border-border-card rounded-lg p-3">
      <p className="text-sm text-text-sec mb-2">{opportunity.question}</p>
      <div className="flex gap-2">
        <button
          onClick={() => handleFeedback(true)}
          disabled={isSubmitting}
          className="flex items-center gap-1 px-3 py-1.5 bg-bg-primary border border-border-card rounded-lg text-white hover:bg-accent-green/20 hover:border-accent-green transition-colors disabled:opacity-50"
        >
          <ThumbsUp className="w-4 h-4" />
          <span className="text-sm">Yes</span>
        </button>
        <button
          onClick={() => handleFeedback(false)}
          disabled={isSubmitting}
          className="flex items-center gap-1 px-3 py-1.5 bg-bg-primary border border-border-card rounded-lg text-white hover:bg-accent-pink/20 hover:border-accent-pink transition-colors disabled:opacity-50"
        >
          <ThumbsDown className="w-4 h-4" />
          <span className="text-sm">No</span>
        </button>
      </div>
    </div>
  )
}
