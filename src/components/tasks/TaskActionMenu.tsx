'use client'

import { Pin, Calendar } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

interface TaskActionMenuProps {
  isOpen: boolean
  onClose: () => void
  taskId: string
  taskTitle: string
  onDeferClick: () => void
  isPinnedTask?: boolean
  isManualTask?: boolean
  onReplan?: () => void
}

export function TaskActionMenu({ 
  isOpen, 
  onClose, 
  taskId,
  taskTitle,
  onDeferClick,
  isPinnedTask = false,
  isManualTask = false,
  onReplan
}: TaskActionMenuProps) {
  const { isPinned, addPinnedTask, removePinnedTask, removeManualTask } = useUIStore()
  const pinned = isPinned(taskId)
  const isPinnedOrManual = isPinnedTask || isManualTask

  const handlePinToggle = () => {
    if (pinned) {
      removePinnedTask(taskId)
    } else {
      addPinnedTask(taskId)
    }
    onReplan?.()
    onClose()
  }

  const handleUnpin = () => {
    if (isPinnedTask) {
      removePinnedTask(taskId)
    }
    if (isManualTask) {
      removeManualTask(taskId)
    }
    onReplan?.()
    onClose()
  }

  const handleDefer = () => {
    onDeferClick()
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-scrim/50 z-[90]" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-tab-bg rounded-t-3xl z-[90] pb-8">
        <div className="p-6 pb-4">
          <div className="w-12 h-1 bg-border-card rounded-full mx-auto mb-4" />
          <h3 className="text-text-primary font-semibold text-lg mb-1">{taskTitle}</h3>
          <p className="text-text-sec text-sm">Job Actions</p>
        </div>

        <div className="border-t border-border-card" />
        
        <div className="p-4 space-y-2">
          {isPinnedOrManual ? (
            <button
              onClick={handleUnpin}
              className="w-full bg-secondary-surface border border-border-card rounded-lg p-4 flex items-center gap-4 hover:bg-bg-card-hover transition-colors"
            >
              <div className="w-12 h-12 bg-accent-yellow rounded-lg flex items-center justify-center">
                <Pin className="w-6 h-6 text-on-light-accent fill-on-light-accent" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-text-primary font-semibold">Unpin from Planner</h4>
                <p className="text-text-tertiary text-sm">Remove from pinned jobs</p>
              </div>
            </button>
          ) : (
            <>
              <button
                onClick={handlePinToggle}
                className="w-full bg-secondary-surface border border-border-card rounded-lg p-4 flex items-center gap-4 hover:bg-bg-card-hover transition-colors"
              >
                <div className="w-12 h-12 bg-accent-yellow rounded-lg flex items-center justify-center">
                  <Pin className={`w-6 h-6 ${pinned ? 'text-on-light-accent fill-on-light-accent' : 'text-on-light-accent'}`} />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-text-primary font-semibold">
                    {pinned ? 'Unpin from Planner' : 'Pin to Planner'}
                  </h4>
                  <p className="text-text-tertiary text-sm">
                    {pinned ? 'Remove from pinned jobs' : 'Keep at top of planner list'}
                  </p>
                </div>
              </button>

              <button
                onClick={handleDefer}
                className="w-full bg-secondary-surface border border-border-card rounded-lg p-4 flex items-center gap-4 hover:bg-bg-card-hover transition-colors"
              >
                <div className="w-12 h-12 bg-accent-yellow rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-on-light-accent" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-text-primary font-semibold">Defer Job</h4>
                  <p className="text-text-tertiary text-sm">Move to a different date</p>
                </div>
              </button>
            </>
          )}
        </div>

        <div className="px-4 pt-2">
          <button
            onClick={onClose}
            className="w-full bg-secondary-surface text-text-primary rounded-lg px-4 py-3 font-medium hover:bg-bg-card-hover transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
