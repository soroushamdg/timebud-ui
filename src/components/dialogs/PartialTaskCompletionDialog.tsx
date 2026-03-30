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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-bg-card rounded-2xl p-6 max-w-sm w-full mx-4">
        <h2 className="text-xl font-semibold mb-2">Task Progress</h2>
        <p className="text-gray-400 mb-6">
          {task.partial 
            ? `You scheduled ${task.scheduledMinutes}min for this task. What is your new estimate for the remaining work?`
            : `You're marking this task as partially complete. What is your new estimate for the remaining work?`
          }
        </p>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Estimated time remaining (minutes)
          </label>
          <input
            type="number"
            min="1"
            value={remainingMinutes}
            onChange={(e) => setRemainingMinutes(e.target.value)}
            placeholder="Enter minutes"
            className="w-full px-3 py-2 bg-bg-card-hover border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent-pink"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-3">
          <button
            onClick={handleSubmit}
            disabled={!remainingMinutes.trim() || isSubmitting}
            className="w-full px-4 py-2 bg-accent-pink text-white font-bold rounded-lg hover:bg-accent-pink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Update Estimated Time
          </button>
          
          <button
            onClick={handleMarkComplete}
            disabled={isSubmitting}
            className="w-full px-4 py-2 bg-accent-green text-white font-bold rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            I've finished the task
          </button>
          
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
