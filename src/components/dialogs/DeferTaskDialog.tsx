'use client'

import { useState } from 'react'
import { X, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

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

    const selected = new Date(selectedDate)
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
      setError('Failed to update task deadline')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[100]" onClick={onClose} />
      
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-sm mx-4 bg-[#1A1A1A] rounded-lg z-[100]">
        <div className="flex items-center justify-between p-4 border-b border-[#333333]">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-accent-yellow" />
            <h2 className="text-white font-bold text-lg">Defer Task</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-[#666666] hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <p className="text-text-sec text-sm mb-1">Task</p>
            <p className="text-white font-medium">{taskTitle}</p>
          </div>

          {currentDeadline && (
            <div>
              <p className="text-text-sec text-sm mb-1">Current Deadline</p>
              <p className="text-white">{new Date(currentDeadline).toLocaleDateString()}</p>
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
              className="w-full bg-[#2A2A2A] text-white border border-[#333333] rounded-lg px-3 py-2 focus:outline-none focus:border-accent-yellow"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg px-3 py-2">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-[#2A2A2A] text-white rounded-lg px-4 py-2 font-medium hover:bg-[#333333] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDefer}
              disabled={isLoading || !selectedDate}
              className="flex-1 bg-accent-yellow text-black rounded-lg px-4 py-2 font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Deferring...' : 'Defer'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
