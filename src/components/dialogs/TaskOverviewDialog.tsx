'use client'

import { X, Calendar, Clock, Flag, Info } from 'lucide-react'
import { formatLocalSmart } from '@/lib/dates'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { PlannedTask } from '@/stores/sessionStore'

interface TaskOverviewDialogProps {
  isOpen?: boolean
  onClose: () => void
  task: PlannedTask
  /** Omit to hide the button entirely (e.g. task already done or already partial). */
  onMarkPartial?: () => void
}

export function TaskOverviewDialog({ isOpen, onClose, task, onMarkPartial }: TaskOverviewDialogProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-scrim/70 z-[100]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-bg-primary rounded-t-3xl pb-8 z-[100] max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-text-sec" />
            <h2 className="text-text-primary font-bold text-lg">Job Overview</h2>
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
              <AvatarImage
                src={undefined}
                fallbackType="project"
                fallbackLabel={task.projectName || 'Mission'}
                fallbackColor={task.projectColor || '#F5C518'}
                size={48}
                className="flex-shrink-0"
              />
              <div>
                <p className="text-text-sec text-sm">Mission</p>
                <p className="text-text-primary font-medium">{task.projectName || 'Unknown Mission'}</p>
              </div>
            </div>
          )}

          {/* Job Title */}
          <div>
            <p className="text-text-sec text-sm mb-1">Job</p>
            <h3 className="text-text-primary text-lg font-semibold">{task.title}</h3>
          </div>

          {/* Task Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div className="bg-bg-card rounded-lg p-3 border border-border-card">
              <div className="flex items-center gap-2 mb-1">
                <Flag className="w-4 h-4 text-text-sec" />
                <p className="text-text-sec text-sm">Priority</p>
              </div>
              <p className="text-text-primary font-medium">
                {task.priority ? 'High Priority' : 'Normal Priority'}
              </p>
            </div>

            {/* Time Estimate */}
            <div className="bg-bg-card rounded-lg p-3 border border-border-card">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-text-sec" />
                <p className="text-text-sec text-sm">Time Estimate</p>
              </div>
              <p className="text-text-primary font-medium">
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
              <p className="text-text-primary font-medium">
                {task.done ? 'Completed' : 'Pending'}
              </p>
            </div>

            {/* Job Type */}
            <div className="bg-bg-card rounded-lg p-3 border border-border-card">
              <p className="text-text-sec text-sm mb-1">Type</p>
              <p className="text-text-primary font-medium">
                {task.isSolo ? 'Solo Job' : 'Mission Job'}
              </p>
            </div>
          </div>

          {/* Additional Info */}
          {task.partial && (
            <div className="bg-bg-card rounded-lg p-3 border border-border-card">
              <p className="text-text-sec text-sm mb-1">Run Info</p>
              <p className="text-text-primary font-medium">
                Partial job - {task.scheduledMinutes} minutes allocated for this run
              </p>
            </div>
          )}

          {/* Mark partially done — the visible, gesture-free way to reach the same
              action the run screen's card long-press offers */}
          {onMarkPartial && (
            <button
              onClick={onMarkPartial}
              className="w-full px-4 py-3 bg-accent-pink text-on-dark-accent font-bold rounded-lg hover:bg-accent-pink/90 transition-colors"
            >
              Mark as done partially
            </button>
          )}

          {/* Job ID */}
          <div className="text-xs text-text-sec">
            <p>Job ID: {task.taskId}</p>
          </div>
        </div>
      </div>
    </>
  )
}
