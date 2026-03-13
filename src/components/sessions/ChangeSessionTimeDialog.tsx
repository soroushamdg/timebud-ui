'use client'

import { useState } from 'react'
import { useFocusSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'

interface ChangeSessionTimeDialogProps {
  onClose: () => void
  onTimeChanged?: () => void
}

export function ChangeSessionTimeDialog({ onClose, onTimeChanged }: ChangeSessionTimeDialogProps) {
  const { preferredBudgetMinutes, setPreferredBudgetMinutes } = useUIStore()
  const [selectedMinutes, setSelectedMinutes] = useState(preferredBudgetMinutes)

  const timeOptions = [15, 30, 45, 60, 75, 90, 120]

  const handleSave = () => {
    setPreferredBudgetMinutes(selectedMinutes)
    onClose()
    onTimeChanged?.()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] px-4">
      <div className="bg-bg-card border border-border-card rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-white text-xl font-bold mb-4">Change session time</h2>
        
        <div className="grid grid-cols-3 gap-2 mb-6">
          {timeOptions.map((minutes) => (
            <button
              key={minutes}
              onClick={() => setSelectedMinutes(minutes)}
              className={`py-2 px-3 rounded-lg font-medium transition-colors ${
                selectedMinutes === minutes
                  ? 'bg-accent-yellow text-black'
                  : 'bg-bg-card-hover text-white border border-border-card hover:border-accent-yellow'
              }`}
            >
              {minutes}min
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-bg-card-hover border border-border-card text-white py-2 px-4 rounded-lg hover:bg-bg-card transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-accent-yellow text-black font-bold py-2 px-4 rounded-lg hover:bg-yellow-400 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
