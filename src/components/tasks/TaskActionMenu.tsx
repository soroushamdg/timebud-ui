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
      <div className="fixed inset-0 bg-black/50 z-[90]" onClick={onClose} />
      
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#1A1A1A] rounded-t-3xl z-[90] pb-8">
        <div className="p-6 pb-4">
          <div className="w-12 h-1 bg-[#333333] rounded-full mx-auto mb-4" />
          <h3 className="text-white font-semibold text-lg mb-1">{taskTitle}</h3>
          <p className="text-text-sec text-sm">Task Actions</p>
        </div>
        
        <div className="border-t border-[#333333]" />
        
        <div className="p-4 space-y-2">
          {isPinnedOrManual ? (
            <button
              onClick={handleUnpin}
              className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg p-4 flex items-center gap-4 hover:bg-[#333333] transition-colors"
            >
              <div className="w-12 h-12 bg-accent-yellow rounded-lg flex items-center justify-center">
                <Pin className="w-6 h-6 text-black fill-black" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-white font-semibold">Unpin from Planner</h4>
                <p className="text-[#666666] text-sm">Remove from pinned tasks</p>
              </div>
            </button>
          ) : (
            <>
              <button
                onClick={handlePinToggle}
                className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg p-4 flex items-center gap-4 hover:bg-[#333333] transition-colors"
              >
                <div className={`w-12 h-12 ${pinned ? 'bg-accent-yellow' : 'bg-[#FFD233]'} rounded-lg flex items-center justify-center`}>
                  <Pin className={`w-6 h-6 ${pinned ? 'text-black fill-black' : 'text-black'}`} />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-white font-semibold">
                    {pinned ? 'Unpin from Planner' : 'Pin to Planner'}
                  </h4>
                  <p className="text-[#666666] text-sm">
                    {pinned ? 'Remove from pinned tasks' : 'Keep at top of planner list'}
                  </p>
                </div>
              </button>

              <button
                onClick={handleDefer}
                className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg p-4 flex items-center gap-4 hover:bg-[#333333] transition-colors"
              >
                <div className="w-12 h-12 bg-[#FFD233] rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-black" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-white font-semibold">Defer Task</h4>
                  <p className="text-[#666666] text-sm">Move to a different date</p>
                </div>
              </button>
            </>
          )}
        </div>

        <div className="px-4 pt-2">
          <button
            onClick={onClose}
            className="w-full bg-[#2A2A2A] text-white rounded-lg px-4 py-3 font-medium hover:bg-[#333333] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
