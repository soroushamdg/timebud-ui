import { useMemo } from 'react'
import { useTasks } from './useTasks'

interface ProjectCompletion {
  percentage: number
  isCompleted: boolean
  completedTaskCount: number
  totalTaskCount: number
}

export const useProjectCompletion = (projectId: string): ProjectCompletion => {
  const { data: tasks = [] } = useTasks()

  const completion = useMemo(() => {
    // Filter tasks that belong to this project and are actual tasks (not milestones)
    const projectTasks = tasks.filter(task => 
      task.project_id === projectId && task.item_type === 'task'
    )

    const completedTaskCount = projectTasks.filter(task => task.status === 'completed').length
    const totalTaskCount = projectTasks.length
    const percentage = totalTaskCount > 0 
      ? Math.round((completedTaskCount / totalTaskCount) * 100) 
      : 0
    const isCompleted = percentage === 100 && totalTaskCount > 0

    return {
      percentage,
      isCompleted,
      completedTaskCount,
      totalTaskCount
    }
  }, [tasks, projectId])

  return completion
}
