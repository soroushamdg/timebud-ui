'use client'

import { useState } from 'react'
import { X, Plus, Calendar, Clock } from 'lucide-react'
import { ChevronDoubleUpIcon } from '@heroicons/react/24/outline'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { formatLocalSmart, parseDateLocal } from '@/lib/dates'
import { DbTask } from '@/types/database'
import { useUIStore } from '@/stores/uiStore'

interface AddTaskToPlannerDialogProps {
  isOpen: boolean
  onClose: () => void
  tasks: DbTask[]
  projects: any[]
  budgetMinutes: number
  currentPinnedTaskIds: string[]
  currentManualTaskIds: string[]
  onTaskAdded?: () => void
  onBudgetExceeded?: () => void
}

export function AddTaskToPlannerDialog({ 
  isOpen, 
  onClose, 
  tasks,
  projects,
  budgetMinutes,
  currentPinnedTaskIds,
  currentManualTaskIds,
  onTaskAdded,
  onBudgetExceeded
}: AddTaskToPlannerDialogProps) {
  const { addManualTask } = useUIStore()

  const incompleteTasks = tasks.filter(
    task => task.status === 'pending' && 
            task.item_type === 'task' &&
            !currentPinnedTaskIds.includes(task.id) &&
            !currentManualTaskIds.includes(task.id)
  )

  const calculateCurrentUsedTime = () => {
    const pinnedTasks = tasks.filter(t => currentPinnedTaskIds.includes(t.id))
    const manualTasks = tasks.filter(t => currentManualTaskIds.includes(t.id))
    
    const pinnedTime = pinnedTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
    const manualTime = manualTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
    
    return pinnedTime + manualTime
  }

  const handleAddTask = (task: DbTask) => {
    const currentUsedTime = calculateCurrentUsedTime()
    const taskTime = task.estimated_minutes || 0
    
    if (currentUsedTime + taskTime > budgetMinutes) {
      onBudgetExceeded?.()
      return
    }

    addManualTask(task.id)
    onTaskAdded?.()
  }

  const isOverdue = (deadline: string | null | undefined): boolean => {
    if (!deadline) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = parseDateLocal(deadline)
    return dueDate < today
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-scrim/70 z-[100]" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4 bg-tab-bg rounded-lg z-[100] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-accent-yellow" />
            <h2 className="text-text-primary font-bold text-lg">Add to Planner</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 flex-shrink-0">
          <div className="bg-secondary-surface rounded-lg px-3 py-2 border border-border-card">
            <p className="text-text-sec text-sm">
              Budget: {calculateCurrentUsedTime()} / {budgetMinutes} min used
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {incompleteTasks.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-text-sec text-center">No jobs available to add</p>
            </div>
          ) : (
            <div className="space-y-2">
              {incompleteTasks.map((task) => {
                const project = task.project_id ? projects.find(p => p.id === task.project_id) : null
                const taskIsOverdue = isOverdue(task.due_date)
                
                return (
                  <div
                    key={task.id}
                    className="bg-secondary-surface border border-border-card rounded-lg p-3 flex items-center gap-3"
                  >
                    {project && (
                      <AvatarImage
                        src={project.project_avatar_url}
                        fallbackType="project"
                        fallbackLabel={project.name}
                        fallbackColor={project.color || '#F5C518'}
                        projectId={project.id}
                        size={32}
                        className="flex-shrink-0 border-2 border-avatar-ring"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {task.priority && (
                          <ChevronDoubleUpIcon className="w-3 h-3 text-accent-yellow flex-shrink-0" />
                        )}
                        <h4 className="text-text-primary text-sm font-semibold truncate">
                          {task.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        {task.estimated_minutes && (
                          <div className="flex items-center gap-1 text-text-sec">
                            <Clock className="w-3 h-3" />
                            <span>{task.estimated_minutes}min</span>
                          </div>
                        )}

                        {task.due_date && (
                          <div className={`flex items-center gap-1 ${taskIsOverdue ? 'text-status-overdue' : 'text-text-sec'}`}>
                            <Calendar className="w-3 h-3" />
                            <span>{formatLocalSmart(task.due_date)}</span>
                          </div>
                        )}
                        
                        {project && (
                          <span className="text-text-sec truncate">• {project.name}</span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleAddTask(task)}
                      className="flex-shrink-0 w-8 h-8 bg-accent-yellow rounded-lg flex items-center justify-center hover:bg-accent-yellow-hover transition-colors"
                    >
                      <Plus className="w-5 h-5 text-on-light-accent" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-card flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-secondary-surface text-text-primary rounded-lg px-4 py-3 font-medium hover:bg-bg-card-hover transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  )
}
