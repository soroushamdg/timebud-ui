'use client'

import { useState } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { X, HelpCircle } from 'lucide-react'

interface PartialTasksDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function PartialTasksDialog({ isOpen, onClose }: PartialTasksDialogProps) {
  const { allowPartialTasks, setAllowPartialTasks } = useUIStore()

  const handleToggle = (allow: boolean) => {
    setAllowPartialTasks(allow)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/70 z-[100]" onClick={onClose} />
      
      {/* Panel */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-black rounded-t-3xl pb-8 z-[100]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-text-sec" />
            <h2 className="text-white font-bold text-lg">Partial tasks</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-accent-pink hover:opacity-80 transition-opacity"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Divider */}
        <div className="border-b border-border-card mx-6" />
        
        {/* Description */}
        <div className="px-6 py-4">
          <p className="text-text-sec text-sm">
            Allow tasks to be split across sessions when time runs out. When disabled, only tasks that can be completed fully will be scheduled.
          </p>
        </div>
        
        {/* Options */}
        <div className="px-6">
          <button
            onClick={() => handleToggle(true)}
            className={`w-full py-4 border-b border-border-card flex justify-between items-center transition-colors ${
              allowPartialTasks ? 'bg-bg-card/50' : 'hover:bg-bg-card/50'
            }`}
          >
            <div className="flex flex-col items-start">
              <span className="text-white text-base">Enabled</span>
              <span className="text-text-sec text-xs mt-1">Tasks can be split if time is insufficient</span>
            </div>
            
            {/* Selection indicator */}
            <div className="w-5 h-5 rounded-full flex items-center justify-center">
              {allowPartialTasks ? (
                <div className="w-5 h-5 rounded-full bg-accent-yellow" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-border-card" />
              )}
            </div>
          </button>
          
          <button
            onClick={() => handleToggle(false)}
            className={`w-full py-4 border-b border-border-card flex justify-between items-center transition-colors ${
              !allowPartialTasks ? 'bg-bg-card/50' : 'hover:bg-bg-card/50'
            }`}
          >
            <div className="flex flex-col items-start">
              <span className="text-white text-base">Disabled</span>
              <span className="text-text-sec text-xs mt-1">Only schedule tasks that can be completed fully</span>
            </div>
            
            {/* Selection indicator */}
            <div className="w-5 h-5 rounded-full flex items-center justify-center">
              {!allowPartialTasks ? (
                <div className="w-5 h-5 rounded-full bg-accent-yellow" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-border-card" />
              )}
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
