'use client'

import { useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { X, ChevronDown, Lock, Check } from 'lucide-react'
import { ChevronDoubleUpIcon } from '@heroicons/react/24/outline'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { useMilestones } from '@/hooks/useMilestones'
import { useProject } from '@/hooks/useProjects'
import { getDiceBearUrl } from '@/lib/avatar'
import { formatLocal, formatLocalSmart } from '@/lib/dates'
import { DbTask, DbMilestone, TaskStatus } from '@/types/database'
import { TaskCardSkeleton } from '@/components/ui/Skeleton'

interface ProjectData {
  id: string
  name: string
  deadline: string | null
  color: string | null
}

export default function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [showHowTo, setShowHowTo] = useState(false)
  const [longPressedTask, setLongPressedTask] = useState<DbTask | null>(null)
  
  const resolvedParams = use(params)
  const projectId = resolvedParams.id
  
  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: tasks = [], isLoading: tasksLoading } = useTasks({ projectId })
  const { data: milestones = [], isLoading: milestonesLoading } = useMilestones(projectId)
  const updateTask = useUpdateTask()
  
  // Create task status map for lock logic
  const taskStatusMap = tasks.reduce((acc, task) => {
    acc[task.id] = task.status
    return acc
  }, {} as Record<string, TaskStatus>)
  
  // Check if task is locked
  const isLocked = useCallback((task: DbTask) => {
    return task.depends_on_task !== null && taskStatusMap[task.depends_on_task] !== 'completed'
  }, [taskStatusMap])
  
  // Group tasks by milestone
  const tasksByMilestone = useCallback(() => {
    const groups: Record<string, { milestone: DbMilestone | null; tasks: DbTask[] }> = {}
    
    // Initialize milestone groups
    milestones.forEach(milestone => {
      groups[milestone.id] = { milestone, tasks: [] }
    })
    
    // Add null milestone group for general tasks
    groups['null'] = { milestone: null, tasks: [] }
    
    // Group tasks
    tasks.forEach(task => {
      const key = task.milestone_id || 'null'
      if (!groups[key]) {
        groups[key] = { milestone: null, tasks: [] }
      }
      groups[key].tasks.push(task)
    })
    
    // Sort tasks within each group by order
    Object.values(groups).forEach(group => {
      group.tasks.sort((a, b) => a.order - b.order)
    })
    
    // Sort milestone groups by milestone order, put general tasks last
    const sortedEntries = Object.entries(groups).sort(([aKey, aGroup], [bKey, bGroup]) => {
      if (aKey === 'null') return 1
      if (bKey === 'null') return -1
      return (aGroup.milestone?.order || 0) - (bGroup.milestone?.order || 0)
    })
    
    return sortedEntries.map(([_, group]) => group)
  }, [tasks, milestones])

  // Separate milestone tasks and individual tasks with proper ordering
  const organizedTasks = useCallback(() => {
    const milestoneGroups: Array<{ milestone: DbMilestone; tasks: DbTask[] }> = []
    const individualTasks: DbTask[] = []
    
    // Sort milestones by order
    const sortedMilestones = [...milestones].sort((a, b) => a.order - b.order)
    
    // Process each milestone
    sortedMilestones.forEach(milestone => {
      const milestoneTasks = tasks
        .filter(task => task.milestone_id === milestone.id)
        .sort((a, b) => a.order - b.order)
      
      if (milestoneTasks.length > 0) {
        milestoneGroups.push({ milestone, tasks: milestoneTasks })
      }
    })
    
    // Get individual tasks (not in milestones)
    const generalTasks = tasks
      .filter(task => !task.milestone_id)
      .sort((a, b) => a.order - b.order)
    
    individualTasks.push(...generalTasks)
    
    return { milestoneGroups, individualTasks }
  }, [tasks, milestones])

  // Check if all tasks in a group are completed
  const isGroupCompleted = useCallback((tasks: DbTask[]) => {
    if (tasks.length === 0) return false
    return tasks.every(task => task.status === 'completed')
  }, [])
  
  // Calculate progress
  const completedCount = tasks.filter(t => t.status === 'completed').length
  const totalCount = tasks.length
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  
  // Sequential task numbering across all tasks
  const getTaskNumber = useCallback((task: DbTask) => {
    const { milestoneGroups, individualTasks } = organizedTasks()
    const allTasks = [
      ...milestoneGroups.flatMap(group => group.tasks),
      ...individualTasks
    ]
    return allTasks.findIndex(t => t.id === task.id) + 1
  }, [organizedTasks])
  
  // Long press handlers
  const handlePointerDown = useCallback((task: DbTask) => {
    if (isLocked(task) || task.status === 'completed') return
    
    const timeoutId = setTimeout(() => {
      setLongPressedTask(task)
    }, 600)
    
    const handleUp = () => {
      clearTimeout(timeoutId)
      document.removeEventListener('pointerup', handleUp)
      document.removeEventListener('pointerleave', handleUp)
    }
    
    document.addEventListener('pointerup', handleUp)
    document.addEventListener('pointerleave', handleUp)
  }, [isLocked])
  
  const handleMarkAsDone = useCallback(async () => {
    if (!longPressedTask) return
    
    try {
      await updateTask.mutateAsync({
        id: longPressedTask.id,
        status: 'completed'
      })
      setLongPressedTask(null)
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }, [longPressedTask, updateTask])
  
  if (projectLoading || tasksLoading || milestonesLoading || !project) {
    return (
      <div className="min-h-screen bg-bg-primary">
        {/* Hero skeleton */}
        <div className="relative h-48 bg-gray-800 animate-pulse" />
        
        {/* Task skeletons */}
        <div className="p-4 space-y-3">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="relative">
        {/* X button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 p-2 text-accent-pink"
        >
          <X size={24} />
        </button>
        
        {/* How to pill */}
        <button
          onClick={() => setShowHowTo(!showHowTo)}
          className="absolute top-4 right-4 z-10 px-3 py-1 bg-bg-card text-text-sec rounded-full text-sm flex items-center gap-1"
        >
          How to
          <ChevronDown size={16} className={`transition-transform ${showHowTo ? 'rotate-180' : ''}`} />
        </button>
        
        {/* Hero */}
        <div className="relative h-48">
          <img
            src={getDiceBearUrl(project.id, project.color)}
            alt={project.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          
          {/* Hero content */}
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-3xl font-bold text-white mb-2">{project.name}</h1>
            <div className="flex justify-between items-end">
              {totalCount > 0 && (
                <div className="text-4xl font-bold text-white">{progressPercentage}%</div>
              )}
              <div className="text-right">
                <div className="text-text-sec text-xs uppercase">DUE DATE</div>
                <div className="text-white text-sm">
                  {project.deadline ? formatLocalSmart(project.deadline) : 'No deadline'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* How to accordion */}
      {showHowTo && (
        <div className="px-4 py-3 bg-bg-card border-b border-border-card">
          <p className="text-text-sec text-sm">
            Tasks are locked until their dependencies are completed. Long press a task to mark it as done.
          </p>
        </div>
      )}
      
      {/* Task list */}
      <div className="pb-20">
        {(() => {
          const { milestoneGroups, individualTasks } = organizedTasks()
          
          return (
            <>
              {/* Milestone Tasks */}
              {milestoneGroups.map((group, index) => {
                const groupCompleted = isGroupCompleted(group.tasks)
                return (
                <div key={group.milestone.id}>
                  {/* Milestone header with line */}
                  <div className="px-4 pt-4">
                    <div className="flex items-center gap-3">
                      <h3 className={`text-sm uppercase font-semibold whitespace-nowrap ${
                        groupCompleted 
                          ? 'text-accent-green opacity-60' 
                          : 'text-text-sec'
                      }`}>
                        {group.milestone.title}
                      </h3>
                      <div className={`flex-1 h-px ${
                        groupCompleted 
                          ? 'bg-accent-green opacity-60' 
                          : 'bg-border-card'
                      }`} />
                    </div>
                  </div>
                  
                  {/* Milestone tasks */}
                  <div className="px-4 pt-2">
                    {group.tasks.map((task) => {
                      const taskNumber = getTaskNumber(task)
                      const locked = isLocked(task)
                      const completed = task.status === 'completed'
                      
                      return (
                        <div
                          key={task.id}
                          className={`
                            mb-3 rounded-2xl px-4 py-3 flex items-center gap-3 border transition-all
                            ${completed 
                              ? 'bg-bg-card-done border-accent-green/30' 
                              : locked 
                                ? 'bg-bg-card-locked' 
                                : 'bg-bg-card border-border-card'
                            }
                            ${!locked && !completed ? 'cursor-pointer active:scale-95' : ''}
                          `}
                          onPointerDown={() => handlePointerDown(task)}
                        >
                          {/* Numbered badge */}
                          <div
                            className={`
                              w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                              ${completed 
                                ? 'bg-accent-green text-white' 
                                : locked 
                                  ? 'bg-bg-card-locked text-text-sec' 
                                  : 'bg-bg-card text-white'
                              }
                            `}
                          >
                            {completed ? <Check size={16} /> : taskNumber}
                          </div>
                          
                          {/* Task title */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {task.priority && (
                                <ChevronDoubleUpIcon className="w-4 h-4 text-accent-yellow flex-shrink-0" />
                              )}
                              <h3 className={`text-base font-semibold truncate ${
                                locked ? 'text-text-sec' : 'text-white'
                              }`}>
                                {task.title}
                              </h3>
                            </div>
                            {task.due_date && (
                              <p className="text-text-sec text-sm mt-1">
                                {formatLocalSmart(task.due_date)}
                              </p>
                            )}
                          </div>
                          
                          {/* Lock icon */}
                          {locked && (
                            <Lock size={16} className="text-text-sec flex-shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Bottom line for milestone group */}
                  <div className="px-4 pb-4">
                    <div className={`h-px ${
                      groupCompleted 
                        ? 'bg-accent-green opacity-60' 
                        : 'bg-border-card'
                    }`} />
                  </div>
                </div>
                )
              })}
              
              {/* Individual Tasks */}
              {individualTasks.length > 0 && (() => {
                const individualTasksCompleted = isGroupCompleted(individualTasks)
                return (
                <div>
                  {/* Individual tasks header with line */}
                  <div className="px-4 pt-4">
                    <div className="flex items-center gap-3">
                      <h3 className={`text-sm uppercase font-semibold whitespace-nowrap ${
                        individualTasksCompleted 
                          ? 'text-accent-green opacity-60' 
                          : 'text-text-sec'
                      }`}>
                        Individual Tasks
                      </h3>
                      <div className={`flex-1 h-px ${
                        individualTasksCompleted 
                          ? 'bg-accent-green opacity-60' 
                          : 'bg-border-card'
                      }`} />
                    </div>
                  </div>
                  
                  {/* Individual tasks */}
                  <div className="px-4 pt-2">
                    {individualTasks.map((task) => {
                      const taskNumber = getTaskNumber(task)
                      const locked = isLocked(task)
                      const completed = task.status === 'completed'
                      
                      return (
                        <div
                          key={task.id}
                          className={`
                            mb-3 rounded-2xl px-4 py-3 flex items-center gap-3 border transition-all
                            ${completed 
                              ? 'bg-bg-card-done border-accent-green/30' 
                              : locked 
                                ? 'bg-bg-card-locked' 
                                : 'bg-bg-card border-border-card'
                            }
                            ${!locked && !completed ? 'cursor-pointer active:scale-95' : ''}
                          `}
                          onPointerDown={() => handlePointerDown(task)}
                        >
                          {/* Numbered badge */}
                          <div
                            className={`
                              w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                              ${completed 
                                ? 'bg-accent-green text-white' 
                                : locked 
                                  ? 'bg-bg-card-locked text-text-sec' 
                                  : 'bg-bg-card text-white'
                              }
                            `}
                          >
                            {completed ? <Check size={16} /> : taskNumber}
                          </div>
                          
                          {/* Task title */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {task.priority && (
                                <ChevronDoubleUpIcon className="w-4 h-4 text-accent-yellow flex-shrink-0" />
                              )}
                              <h3 className={`text-base font-semibold truncate ${
                                locked ? 'text-text-sec' : 'text-white'
                              }`}>
                                {task.title}
                              </h3>
                            </div>
                            {task.due_date && (
                              <p className="text-text-sec text-sm mt-1">
                                {formatLocalSmart(task.due_date)}
                              </p>
                            )}
                          </div>
                          
                          {/* Lock icon */}
                          {locked && (
                            <Lock size={16} className="text-text-sec flex-shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                )
              })()}
            </>
          )
        })()}
      </div>
      
      {/* Bottom sheet for task completion */}
      {longPressedTask && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setLongPressedTask(null)}
          />
          
          {/* Sheet */}
          <div className="relative bg-bg-card rounded-t-3xl p-6 w-full max-w-md mx-auto">
            <h2 className="text-white text-lg font-semibold mb-2">
              Mark this task as done?
            </h2>
            <p className="text-accent-yellow text-base mb-6">
              {longPressedTask.title}
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setLongPressedTask(null)}
                className="flex-1 py-3 text-text-sec font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsDone}
                className="flex-1 py-3 bg-accent-green text-white font-semibold rounded-xl"
                disabled={updateTask.isPending}
              >
                {updateTask.isPending ? 'Updating...' : 'Mark as done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
