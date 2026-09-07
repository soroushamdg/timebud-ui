'use client'

import { useState } from 'react'
import { useFocusSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'
import { useUpsertAISettings } from '@/hooks/useAISettings'
import { formatMinutesLabel } from '@/lib/dates'
import { Settings } from 'lucide-react'

interface ChangeSessionTimeDialogProps {
  onClose: () => void
  onTimeChanged?: () => void
  /** Minutes already spent in runs earlier today, for context when reopening this
   *  mid-day — the value being edited here is still the full daily total, not this. */
  usedMinutesToday?: number
}

export function ChangeSessionTimeDialog({ onClose, onTimeChanged, usedMinutesToday }: ChangeSessionTimeDialogProps) {
  const { preferredBudgetMinutes, customBudgetMinutes, setPreferredBudgetMinutes, setCustomBudgetMinutes } = useUIStore()
  const upsertSettings = useUpsertAISettings()
  const [selectedMinutes, setSelectedMinutes] = useState(preferredBudgetMinutes)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customInput, setCustomInput] = useState(customBudgetMinutes?.toString() || '')

  const timeOptions = [15, 30, 45, 60, 75, 90, 120]

  const persistBudget = (minutes: number) => {
    upsertSettings.mutate({ preferred_session_minutes: minutes })
  }

  const handleSave = () => {
    setPreferredBudgetMinutes(selectedMinutes)
    persistBudget(selectedMinutes)
    onClose()
    onTimeChanged?.()
  }

  const handleCustomSave = () => {
    const minutes = parseInt(customInput)
    if (isNaN(minutes) || minutes < 5 || minutes > 300) {
      return
    }
    setCustomBudgetMinutes(minutes)
    setSelectedMinutes(minutes)
    setShowCustomInput(false)
  }

  const isCustomSelected = customBudgetMinutes !== null && selectedMinutes === customBudgetMinutes

  return (
    <div className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-[100] px-4">
      <div className="bg-bg-card border border-border-card rounded-2xl p-6 w-full max-w-sm">
        <h2 className={`text-text-primary text-xl font-bold ${usedMinutesToday ? 'mb-1' : 'mb-4'}`}>Daily time budget</h2>
        {!!usedMinutesToday && (
          <p className="text-text-sec text-sm mb-3">
            You&apos;ve already used {formatMinutesLabel(usedMinutesToday)} today — this sets the full day&apos;s total, not what&apos;s left.
          </p>
        )}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {timeOptions.map((minutes) => (
            <button
              key={minutes}
              onClick={() => setSelectedMinutes(minutes)}
              className={`py-2 px-3 rounded-lg font-medium transition-colors ${
                selectedMinutes === minutes && !isCustomSelected
                  ? 'bg-accent-yellow text-on-light-accent'
                  : 'bg-bg-card-hover text-text-primary border border-border-card hover:border-accent-yellow'
              }`}
            >
              {minutes}min
            </button>
          ))}
        </div>

        {/* Custom option */}
        <button
          onClick={() => setShowCustomInput(true)}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors mb-6 flex items-center justify-between ${
            isCustomSelected
              ? 'bg-accent-yellow text-on-light-accent'
              : 'bg-bg-card-hover text-text-primary border-2 border-dashed border-border-card hover:border-accent-yellow'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span>
              {customBudgetMinutes !== null ? `Custom: ${customBudgetMinutes}min` : 'Custom'}
            </span>
          </div>
          {isCustomSelected && (
            <div className="w-5 h-5 rounded-full bg-on-light-accent" />
          )}
        </button>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-bg-card-hover border border-border-card text-text-primary py-2 px-4 rounded-lg hover:bg-bg-card transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-accent-yellow text-on-light-accent font-bold py-2 px-4 rounded-lg hover:bg-accent-yellow-hover transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Custom input dialog */}
      {showCustomInput && (
        <div className="fixed inset-0 bg-scrim/70 flex items-center justify-center z-[110] px-4">
          <div className="bg-bg-card border border-border-card rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-text-primary text-lg font-bold mb-4">Set custom duration</h3>
            
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Enter minutes"
                  min="5"
                  max="300"
                  className="flex-1 bg-bg-card-hover border border-border-card text-text-primary px-4 py-3 rounded-lg focus:outline-none focus:border-accent-yellow"
                  autoFocus
                />
                <span className="text-text-sec">minutes</span>
              </div>
              <p className="text-text-sec text-sm mt-2">Range: 5-300 minutes</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCustomInput(false)}
                className="flex-1 bg-bg-card-hover border border-border-card text-text-primary py-2 px-4 rounded-lg hover:bg-bg-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomSave}
                disabled={!customInput || parseInt(customInput) < 5 || parseInt(customInput) > 300}
                className="flex-1 bg-accent-yellow text-on-light-accent font-bold py-2 px-4 rounded-lg hover:bg-accent-yellow-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
