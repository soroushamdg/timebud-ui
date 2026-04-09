import { SupabaseClient } from '@supabase/supabase-js'
import { planSession, PlannerTask } from '@/lib/planner'
import { SessionPlan } from '@/types/ai'
import { deductCreditsForAction } from '@/lib/credits/deduct'
import { createServiceClient } from '@/lib/supabase/server'

export interface PlanSessionOptions {
  budgetMinutes: number
  pinnedTaskIds?: string[]
  excludedTaskIds?: string[]
}

export async function planSessionFromAI(
  userId: string,
  options: PlanSessionOptions,
  supabase: SupabaseClient
): Promise<SessionPlan> {
  // Deduct 5 credits for session planning
  const serviceSupabase = createServiceClient()
  const creditResult = await deductCreditsForAction({
    userId,
    actionType: 'plan_session',
    description: 'AI session planning',
    supabase: serviceSupabase,
  })

  if (!creditResult.success) {
    throw new Error('Insufficient credits for session planning')
  }

  // Fetch user's active projects
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, status, deadline, priority, color, project_avatar_url')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (projectsError) throw projectsError

  // Fetch all tasks (including completed ones for dependency checking)
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)

  if (tasksError) throw tasksError

  // Filter out excluded tasks and apply pinned logic
  const { pinnedTaskIds = [], excludedTaskIds = [] } = options
  
  // Get pinned tasks
  const pinnedTasks = tasks.filter(t => 
    pinnedTaskIds.includes(t.id) && 
    t.status === 'pending' &&
    t.item_type === 'task'
  )
  
  // Calculate remaining budget after pinned tasks
  const pinnedTime = pinnedTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
  const remainingBudget = Math.max(0, options.budgetMinutes - pinnedTime)

  // Filter tasks for planner (exclude pinned and excluded)
  const plannerTasks: PlannerTask[] = tasks
    .filter(t => !pinnedTaskIds.includes(t.id) && !excludedTaskIds.includes(t.id))
    .map(task => ({
      ...task,
      estimated_minutes: task.estimated_minutes || 0,
      status: task.status || 'pending',
    }))

  // Run the planner algorithm
  const plan = planSession({
    projects: projects || [],
    milestones: [],
    tasks: plannerTasks,
    budgetMinutes: remainingBudget,
    allowPartial: true,
  })

  // Convert planner output to SessionPlan format
  const sessionTasks = [
    // Add pinned tasks first
    ...pinnedTasks.map(task => {
      const project = projects?.find(p => p.id === task.project_id)
      return {
        taskId: task.id,
        title: task.title,
        projectName: project?.name,
        projectId: task.project_id || undefined,
        projectColor: project?.color || undefined,
        projectAvatarUrl: project?.project_avatar_url || undefined,
        scheduledMinutes: task.estimated_minutes || 0,
        partial: false,
        priority: task.priority,
        reasoning: 'Pinned by user',
        estimatedMinutes: task.estimated_minutes || undefined,
        deadline: task.due_date || undefined,
      }
    }),
    // Add algorithm-selected tasks
    ...plan.tasks.map(plannedTask => {
      const task = tasks.find(t => t.id === plannedTask.taskId)
      const project = projects?.find(p => p.id === plannedTask.projectId)
      
      let reasoning = ''
      if (plannedTask.partial) {
        reasoning = `Partial completion (${plannedTask.carryOverMinutes}min remaining for later)`
      } else if (task?.due_date) {
        const daysUntil = Math.floor((new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (daysUntil < 0) {
          reasoning = `Overdue by ${Math.abs(daysUntil)} days`
        } else if (daysUntil === 0) {
          reasoning = 'Due today'
        } else if (daysUntil <= 2) {
          reasoning = `Due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`
        } else {
          reasoning = task.priority ? 'High priority task' : 'Scheduled by priority'
        }
      } else {
        reasoning = task?.priority ? 'High priority task' : 'Scheduled by priority'
      }

      return {
        taskId: plannedTask.taskId,
        title: plannedTask.title,
        projectName: project?.name,
        projectId: plannedTask.projectId || undefined,
        projectColor: project?.color || undefined,
        projectAvatarUrl: project?.project_avatar_url || undefined,
        scheduledMinutes: plannedTask.scheduledMinutes,
        partial: plannedTask.partial,
        priority: plannedTask.priority,
        reasoning,
        estimatedMinutes: task?.estimated_minutes || undefined,
        deadline: task?.due_date || undefined,
      }
    }),
  ]

  const totalUsed = pinnedTime + plan.totalUsedMinutes

  return {
    budgetMinutes: options.budgetMinutes,
    totalUsedMinutes: totalUsed,
    slackMinutes: options.budgetMinutes - totalUsed,
    reasoning: `Planned ${sessionTasks.length} tasks based on priorities, deadlines, and dependencies`,
    tasks: sessionTasks,
  }
}
