'use client'

import { useState } from 'react'
import { X, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { parseDateLocal, formatLocal, formatDateLocal } from '@/lib/dates'

interface DeferTaskDialogProps {
  isOpen: boolean
  onClose: () => void
  taskId: string
  taskTitle: string
  currentDeadline?: string
  onDeferred?: () => void
}

export function DeferTaskDialog({ 
  isOpen, 
  onClose, 
  taskId, 
  taskTitle,
  currentDeadline,
  onDeferred
}: DeferTaskDialogProps) {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDefer = async () => {
    if (!selectedDate) {
      setError('Please select a date')
      return
    }

    const selected = parseDateLocal(selectedDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (selected < today) {
      setError('Date must be in the future')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ due_date: selectedDate })
        .eq('id', taskId)

      if (updateError) throw updateError

      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      
      onDeferred?.()
      onClose()
    } catch (err) {
      console.error('Failed to defer task:', err)
      setError('Failed to update job deadline')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-scrim/70 z-[100]" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-sm mx-4 bg-tab-bg rounded-lg z-[100]">
        <div className="flex items-center justify-between p-4 border-b border-border-card">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-accent-yellow" />
            <h2 className="text-text-primary font-bold text-lg">Defer Job</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-text-sec text-sm mb-1">Job</p>
            <p className="text-text-primary font-medium">{taskTitle}</p>
          </div>

          {currentDeadline && (
            <div>
              <p className="text-text-sec text-sm mb-1">Current Deadline</p>
              <p className="text-text-primary">{formatLocal(currentDeadline)}</p>
            </div>
          )}

          <div>
            <label className="text-text-sec text-sm block mb-2">
              New Deadline
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setError('')
              }}
              className="w-full bg-secondary-surface text-text-primary border border-border-card rounded-lg px-3 py-2 focus:outline-none focus:border-accent-yellow"
              min={formatDateLocal(new Date())}
            />
          </div>

          {error && (
            <div className="bg-status-negative/10 border border-status-negative rounded-lg px-3 py-2">
              <p className="text-status-negative text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-secondary-surface text-text-primary rounded-lg px-4 py-2 font-medium hover:bg-bg-card-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDefer}
              disabled={isLoading || !selectedDate}
              className="flex-1 bg-accent-yellow text-on-light-accent rounded-lg px-4 py-2 font-bold hover:bg-accent-yellow-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Deferring...' : 'Defer'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
