'use client'

import { X, Calendar, Clock, Flag, Info } from 'lucide-react'
import { formatLocalSmart } from '@/lib/dates'
import { getDiceBearUrl } from '@/lib/utils'
import { PlannedTask } from '@/stores/sessionStore'

interface TaskOverviewDialogProps {
  isOpen?: boolean
  onClose: () => void
  task: PlannedTask
}

export function TaskOverviewDialog({ isOpen, onClose, task }: TaskOverviewDialogProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      
      {/* Panel */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-black rounded-t-3xl pb-8 z-50 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-text-sec" />
            <h2 className="text-white font-bold text-lg">Task Overview</h2>
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
        
        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Project Info */}
          {task.projectId && (
            <div className="flex items-center gap-3">
              <img
                src={getDiceBearUrl(task.projectId, task.projectColor || '#F5C518')}
                alt={task.projectName || 'Project'}
                className="w-12 h-12 rounded-none flex-shrink-0"
              />
              <div>
                <p className="text-text-sec text-sm">Project</p>
                <p className="text-white font-medium">{task.projectName || 'Unknown Project'}</p>
              </div>
            </div>
          )}

          {/* Task Title */}
          <div>
            <p className="text-text-sec text-sm mb-1">Task</p>
            <h3 className="text-white text-lg font-semibold">{task.title}</h3>
          </div>

          {/* Task Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div className="bg-bg-card rounded-lg p-3 border border-border-card">
              <div className="flex items-center gap-2 mb-1">
                <Flag className="w-4 h-4 text-text-sec" />
                <p className="text-text-sec text-sm">Priority</p>
              </div>
              <p className="text-white font-medium">
                {task.priority ? 'High Priority' : 'Normal Priority'}
              </p>
            </div>

            {/* Time Estimate */}
            <div className="bg-bg-card rounded-lg p-3 border border-border-card">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-text-sec" />
                <p className="text-text-sec text-sm">Time Estimate</p>
              </div>
              <p className="text-white font-medium">
                {task.estimatedMinutes !== undefined ? (
                  task.partial && task.scheduledMinutes !== task.estimatedMinutes ? (
                    `${task.scheduledMinutes}min / ${task.estimatedMinutes}min total`
                  ) : (
                    `${task.estimatedMinutes} minutes`
                  )
                ) : (
                  'No estimate'
                )}
              </p>
            </div>

            {/* Status */}
            <div className="bg-bg-card rounded-lg p-3 border border-border-card">
              <p className="text-text-sec text-sm mb-1">Status</p>
              <p className="text-white font-medium">
                {task.done ? 'Completed' : 'Pending'}
              </p>
            </div>

            {/* Task Type */}
            <div className="bg-bg-card rounded-lg p-3 border border-border-card">
              <p className="text-text-sec text-sm mb-1">Type</p>
              <p className="text-white font-medium">
                {task.isSolo ? 'Solo Task' : 'Project Task'}
              </p>
            </div>
          </div>

          {/* Additional Info */}
          {task.partial && (
            <div className="bg-bg-card rounded-lg p-3 border border-border-card">
              <p className="text-text-sec text-sm mb-1">Session Info</p>
              <p className="text-white font-medium">
                Partial task - {task.scheduledMinutes} minutes allocated for this session
              </p>
            </div>
          )}

          {/* Task ID */}
          <div className="text-xs text-text-sec">
            <p>Task ID: {task.taskId}</p>
          </div>
        </div>
      </div>
    </>
  )
}
