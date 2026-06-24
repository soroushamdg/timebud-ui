import { useMemo } from 'react'
import { useTasks } from './useTasks'

interface ProjectCompletion {
  percentage: number
  isCompleted: boolean
  completedTaskCount: number
  totalTaskCount: number
  onHoldCount: number
}

export const useProjectCompletion = (projectId: string): ProjectCompletion => {
  const { data: tasks = [] } = useTasks()

  const completion = useMemo(() => {
    // Filter tasks that belong to this project and are actual tasks (not milestones)
    // Exclude on_hold — they don't count toward progress
    const activeTasks = tasks.filter(task => 
      task.project_id === projectId &&
      task.item_type === 'task' &&
      !task.on_hold
    )

    const onHoldCount = tasks.filter(task =>
      task.project_id === projectId &&
      task.item_type === 'task' &&
      task.on_hold
    ).length

    const completedTaskCount = activeTasks.filter(task => task.status === 'completed').length
    const totalTaskCount = activeTasks.length
    const percentage = totalTaskCount > 0 
      ? Math.round((completedTaskCount / totalTaskCount) * 100) 
      : 0
    const isCompleted = percentage === 100 && totalTaskCount > 0

    return {
      percentage,
      isCompleted,
      completedTaskCount,
      totalTaskCount,
      onHoldCount,
    }
  }, [tasks, projectId])

  return completion
}
