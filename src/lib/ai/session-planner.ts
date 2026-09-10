import { SupabaseClient } from '@supabase/supabase-js'
import { planDay, PlannerTask, DEFAULT_PLANNING_HOURS, PlanningHours } from '@/lib/planner'
import { fetchDayCalendar } from '@/lib/google-calendar/dayCalendar'
import { SessionPlan, SessionPlanTask } from '@/types/ai'
import { deductCreditsForAction } from '@/lib/credits/deduct'
import { createServiceClient } from '@/lib/supabase/server'
import { parseDateLocal } from '@/lib/dates'

export interface PlanSessionOptions {
  budgetMinutes: number
  pinnedTaskIds?: string[]
  excludedTaskIds?: string[]
}

// "4:30–6:30 PM" / "11:30 AM–1:00 PM" in the user's timezone. Same shape as the
// client-side formatTimeRange in DayPlanList, but that one uses the machine's clock
// and this runs on the server, where the clock is UTC.
function formatBlockRange(startIso: string, endIso: string, timezone: string): string {
  let fmt: Intl.DateTimeFormat
  try {
    fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone })
  } catch {
    fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
  }
  const a = fmt.format(new Date(startIso))
  const b = fmt.format(new Date(endIso))
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`
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
    .select('id, name, status, deadline, priority, color, project_avatar_url, calendar_spillover')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (projectsError) throw projectsError

  // Fetch all tasks (including completed ones for dependency checking)
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)

  if (tasksError) throw tasksError

  // Fetch all dependencies
  const { data: dependencies, error: depsError } = await supabase
    .from('task_dependencies')
    .select('task_id, depends_on_id')

  if (depsError) throw depsError

  // Planning hours and timezone live on the settings row; the three planning columns
  // may be missing on rows created before they existed, so fall back to the defaults
  // the client uses.
  const { data: settings } = await supabase
    .from('user_ai_settings')
    .select('timezone, planning_start_time, planning_end_time, min_gap_minutes, event_buffer_minutes')
    .eq('user_id', userId)
    .maybeSingle()

  const timezone: string = settings?.timezone || 'UTC'
  const planningHours: PlanningHours = {
    start: settings?.planning_start_time || DEFAULT_PLANNING_HOURS.start,
    end: settings?.planning_end_time || DEFAULT_PLANNING_HOURS.end,
    minGapMinutes: settings?.min_gap_minutes ?? DEFAULT_PLANNING_HOURS.minGapMinutes,
    bufferMinutes: settings?.event_buffer_minutes ?? DEFAULT_PLANNING_HOURS.bufferMinutes,
  }

  // Same calendar view Home and Week Ahead plan against, so the AI's plan puts jobs
  // into the same blocks and gaps the user sees there.
  const now = new Date()
  const calendar = await fetchDayCalendar(serviceSupabase, userId, now, timezone, 1)
  const today = calendar.days[0] ?? { date: '', blocks: [], busy: [] }

  // Build a map of task_id -> array of depends_on_ids
  const depsMap = new Map<string, string[]>()
  for (const dep of dependencies || []) {
    if (!depsMap.has(dep.task_id)) {
      depsMap.set(dep.task_id, [])
    }
    depsMap.get(dep.task_id)!.push(dep.depends_on_id)
  }

  // Attach dependencies to each task
  const tasksWithDeps = tasks.map(task => ({
    ...task,
    dependencies: depsMap.get(task.id) || []
  }))

  // Filter out excluded tasks and apply pinned logic
  const { pinnedTaskIds = [], excludedTaskIds = [] } = options
  
  // Get pinned tasks
  const pinnedTasks = tasksWithDeps.filter(t => 
    pinnedTaskIds.includes(t.id) && 
    t.status === 'pending' &&
    t.item_type === 'task'
  )
  
  // Calculate remaining budget after pinned tasks
  const pinnedTime = pinnedTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
  const remainingBudget = Math.max(0, options.budgetMinutes - pinnedTime)

  // Filter tasks for planner (exclude pinned and excluded)
  const plannerTasks: PlannerTask[] = tasksWithDeps
    .filter(t => !pinnedTaskIds.includes(t.id) && !excludedTaskIds.includes(t.id))
    .map(task => ({
      ...task,
      estimated_minutes: task.estimated_minutes || 0,
      status: task.status || 'pending',
    }))

  // Run the calendar-aware planner: mapped blocks get their own mission's jobs, the
  // rest of the budget goes into real free time. A mission with a block today stays
  // inside it unless the user opted it into spillover.
  const spilloverProjectIds = (projects || []).filter(p => p.calendar_spillover).map(p => p.id)
  const plan = planDay({
    projects: projects || [],
    tasks: plannerTasks,
    budgetMinutes: remainingBudget,
    blocks: today.blocks,
    busy: today.busy,
    calendarConnected: calendar.connected,
    planningHours,
    now,
    timezone,
    allowPartial: true,
    spilloverProjectIds,
  })

  // Convert planner output to SessionPlan format
  const sessionTasks: SessionPlanTask[] = [
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
    // Add algorithm-selected tasks, in the order they come up during the day
    ...plan.orderedTasks.map(plannedTask => {
      const task = tasksWithDeps.find(t => t.id === plannedTask.taskId)
      const project = projects?.find(p => p.id === plannedTask.projectId)
      
      let reasoning = ''
      if (plannedTask.lane === 'block' && plannedTask.blockStartTime && plannedTask.blockEndTime) {
        // Placed by its reservation, not by score — say so rather than "by priority".
        reasoning = `Reserved: ${plannedTask.blockLabel} block ${formatBlockRange(plannedTask.blockStartTime, plannedTask.blockEndTime, timezone)}`
        if (plannedTask.partial) {
          reasoning += ` (${plannedTask.carryOverMinutes}min remaining for later)`
        }
      } else if (plannedTask.partial) {
        reasoning = `Partial completion (${plannedTask.carryOverMinutes}min remaining for later)`
      } else if (task?.due_date) {
        const todayLocal = new Date(); todayLocal.setHours(0, 0, 0, 0)
        const daysUntil = Math.round((parseDateLocal(task.due_date).getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24))
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
  const reasoning =
    plan.reservedMinutes > 0
      ? `Planned ${sessionTasks.length} tasks based on priorities, deadlines, and dependencies; ${plan.reservedMinutes}min reserved by calendar blocks`
      : `Planned ${sessionTasks.length} tasks based on priorities, deadlines, and dependencies`

  return {
    budgetMinutes: options.budgetMinutes,
    totalUsedMinutes: totalUsed,
    slackMinutes: options.budgetMinutes - totalUsed,
    reasoning,
    tasks: sessionTasks,
    reservedMinutes: plan.reservedMinutes,
    freeBudgetMinutes: plan.freeBudgetMinutes,
    windowMinutes: plan.windowMinutes,
  }
}
