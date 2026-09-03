import { useState } from 'react'
import { PlannedTask } from '@/stores/sessionStore'

interface PartialTaskCompletionDialogProps {
  task: PlannedTask
  isOpen: boolean
  onClose: () => void
  onUpdateEstimatedTime: (remainingMinutes: number) => void
  onMarkComplete: () => void
  onPartialCompletionForNonPartialTask?: (remainingMinutes: number) => void
}

export function PartialTaskCompletionDialog({ 
  task, 
  isOpen, 
  onClose, 
  onUpdateEstimatedTime, 
  onMarkComplete,
  onPartialCompletionForNonPartialTask 
}: PartialTaskCompletionDialogProps) {
  const [remainingMinutes, setRemainingMinutes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!remainingMinutes.trim()) return
    
    setIsSubmitting(true)
    const minutes = parseInt(remainingMinutes)
    if (!isNaN(minutes) && minutes > 0) {
      if (!task.partial && onPartialCompletionForNonPartialTask) {
        // Handle non-partial task partial completion
        await onPartialCompletionForNonPartialTask(minutes)
      } else {
        // Handle regular partial task
        await onUpdateEstimatedTime(minutes)
      }
      onClose()
    }
    setIsSubmitting(false)
  }

  const handleMarkComplete = async () => {
    setIsSubmitting(true)
    await onMarkComplete()
    onClose()
    setIsSubmitting(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-[100]">
      <div className="bg-bg-card rounded-2xl p-6 max-w-sm w-full mx-4">
        <h2 className="text-xl font-semibold mb-2">Job Progress</h2>
        <p className="text-text-sec mb-6">
          {task.partial
            ? `You scheduled ${task.scheduledMinutes}min for this job. What is your new estimate for the remaining work?`
            : `You're marking this job as partially complete. What is your new estimate for the remaining work?`
          }
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-text-sec mb-2">
            Estimated time remaining (minutes)
          </label>
          <input
            type="number"
            min="1"
            value={remainingMinutes}
            onChange={(e) => setRemainingMinutes(e.target.value)}
            placeholder="Enter minutes"
            className="w-full px-3 py-2 bg-bg-card-hover border border-form-border rounded-lg text-text-primary placeholder-disabled-icon focus:outline-none focus:border-accent-pink"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-3">
          <button
            onClick={handleSubmit}
            disabled={!remainingMinutes.trim() || isSubmitting}
            className="w-full px-4 py-2 bg-accent-pink text-on-dark-accent font-bold rounded-lg hover:bg-accent-pink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Update Estimated Time
          </button>

          <button
            onClick={handleMarkComplete}
            disabled={isSubmitting}
            className="w-full px-4 py-2 bg-accent-green text-on-dark-accent font-bold rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            I've finished the job
          </button>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full px-4 py-2 border border-border-card rounded-lg text-text-sec hover:bg-bg-card-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
