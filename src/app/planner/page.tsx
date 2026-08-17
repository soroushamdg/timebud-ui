'use client'

import { useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDays, format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { TaskCard } from '@/components/tasks/TaskCard'
import { BudgetMeter } from '@/components/planner/BudgetMeter'
import { useCurrentUser } from '@/hooks/useAuth'
import { useProjects } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { useUIStore } from '@/stores/uiStore'
import { planWeek, PlannedTaskResult, PlannerTask } from '@/lib/planner'
import { DbProject, DbTask } from '@/types/database'
import { formatMinutesLabel } from '@/lib/dates'

interface PlannedTask {
  taskId: string
  title: string
  projectId?: string
  projectName?: string
  projectColor?: string
  projectAvatarUrl?: string
  estimatedMinutes?: number
  scheduledMinutes?: number
  partial?: boolean
  priority?: boolean
  deadline?: string
  isPinned?: boolean
  isManual?: boolean
  isPartOfChain?: boolean
  chainPosition?: number
  dependsOnTaskId?: string | null
  isLocked?: boolean
}

interface DayPlan {
  date: Date
  budgetMinutes: number
  totalUsedMinutes: number
  tasks: PlannedTask[]
}

function fromResult(result: PlannedTaskResult, tasks: DbTask[], projects: DbProject[]): PlannedTask {
  const dbTask = tasks.find((t) => t.id === result.taskId)
  const project = result.projectId ? projects.find((p) => p.id === result.projectId) : undefined
  return {
    taskId: result.taskId,
    title: result.title,
    projectId: result.projectId || undefined,
    projectName: project?.name,
    projectColor: project?.color || undefined,
    projectAvatarUrl: project?.project_avatar_url || undefined,
    estimatedMinutes: dbTask?.estimated_minutes || undefined,
    scheduledMinutes: result.scheduledMinutes,
    partial: result.partial,
    priority: dbTask?.priority,
    deadline: dbTask?.due_date || undefined,
    isPartOfChain: result.isPartOfChain,
    chainPosition: result.chainPosition,
    dependsOnTaskId: result.dependsOnTaskId,
    isLocked: result.isLocked,
  }
}

function fromDbTask(task: DbTask, projects: DbProject[], kind: 'pinned' | 'manual'): PlannedTask {
  const project = task.project_id ? projects.find((p) => p.id === task.project_id) : undefined
  return {
    taskId: task.id,
    title: task.title,
    projectId: task.project_id || undefined,
    projectName: project?.name,
    projectColor: project?.color || undefined,
    projectAvatarUrl: project?.project_avatar_url || undefined,
    estimatedMinutes: task.estimated_minutes || undefined,
    scheduledMinutes: task.estimated_minutes || 0,
    partial: false,
    priority: task.priority,
    deadline: task.due_date || undefined,
    isPinned: kind === 'pinned',
    isManual: kind === 'manual',
  }
}

function dayHeading(date: Date, index: number): string {
  if (index === 0) return 'Today'
  if (index === 1) return 'Tomorrow'
  return format(date, 'EEEE, MMM d')
}

export default function PlannerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: user, isLoading: userLoading } = useCurrentUser()
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: tasks, isLoading: tasksLoading } = useTasks()
  const { preferredBudgetMinutes, allowPartialTasks, pinnedTaskIds, manualTaskIds } = useUIStore()

  const plan = useMemo(() => {
    if (!tasks || !projects) return null

    const now = new Date()
    const pinnedTasks = tasks.filter(
      (t) => pinnedTaskIds.includes(t.id) && t.status === 'pending' && t.item_type === 'task'
    )
    const manualTasks = tasks.filter(
      (t) =>
        manualTaskIds.includes(t.id) &&
        t.status === 'pending' &&
        t.item_type === 'task' &&
        !pinnedTaskIds.includes(t.id)
    )
    const pinnedTime = pinnedTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
    const manualTime = manualTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
    const todayBudget = Math.max(0, preferredBudgetMinutes - pinnedTime - manualTime)

    const pool: PlannerTask[] = tasks
      .filter(
        (t) =>
          t.status === 'pending' &&
          t.item_type === 'task' &&
          !pinnedTaskIds.includes(t.id) &&
          !manualTaskIds.includes(t.id)
      )
      .map((t) => ({ ...t, estimated_minutes: t.estimated_minutes || 0, status: t.status || 'pending' }))

    const week = planWeek({
      projects,
      tasks: pool,
      dailyBudgetMinutes: [todayBudget, ...Array(6).fill(preferredBudgetMinutes)],
      startDate: now,
      days: 7,
      allowPartial: allowPartialTasks,
    })

    const pinnedManualPlanned = [
      ...pinnedTasks.map((t) => fromDbTask(t, projects, 'pinned')),
      ...manualTasks.map((t) => fromDbTask(t, projects, 'manual')),
    ]

    const days: DayPlan[] = week.days.map((d, i) => ({
      date: addDays(now, i),
      budgetMinutes: d.budgetMinutes + (i === 0 ? pinnedTime + manualTime : 0),
      totalUsedMinutes: d.totalUsedMinutes + (i === 0 ? pinnedTime + manualTime : 0),
      tasks: [
        ...(i === 0 ? pinnedManualPlanned : []),
        ...d.tasks.map((r) => fromResult(r, tasks, projects)),
      ],
    }))

    return { days, unscheduledCount: week.unscheduledTasks.length }
  }, [tasks, projects, pinnedTaskIds, manualTaskIds, preferredBudgetMinutes, allowPartialTasks])

  useEffect(() => {
    const targetDay = searchParams.get('day')
    if (!targetDay) return
    const el = document.getElementById(`planner-day-${targetDay}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [plan, searchParams])

  const handleTaskClick = (task: PlannedTask) => {
    if (task.projectId) {
      router.push(`/projects/${task.projectId}?taskId=${task.taskId}`)
    }
  }

  if (userLoading) {
    return (
      <AppShell>
        <div className="flex flex-col h-[calc(100vh-5rem)] items-center justify-center">
          <p className="text-text-sec">Loading...</p>
        </div>
      </AppShell>
    )
  }

  if (!user) {
    router.push('/auth/login')
    return (
      <AppShell>
        <div className="flex flex-col h-[calc(100vh-5rem)] items-center justify-center">
          <p className="text-text-sec">Redirecting to login...</p>
        </div>
      </AppShell>
    )
  }

  const isLoading = projectsLoading || tasksLoading || !plan

  return (
    <AppShell>
      <div className="flex flex-col pb-24">
        <div className="h-[2vh]" />

        <div className="px-6 pt-4 mb-6 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white text-xl font-bold">This week</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-text-sec text-center">Loading your week...</p>
          </div>
        ) : (
          <>
            {plan.unscheduledCount > 0 && (
              <div className="mx-6 mb-6 bg-bg-card border border-border-card rounded-xl px-4 py-3">
                <p className="text-text-sec text-sm">
                  {plan.unscheduledCount} task{plan.unscheduledCount === 1 ? '' : 's'} won&apos;t fit in the next 7
                  days at {formatMinutesLabel(preferredBudgetMinutes)}/day. Consider raising your daily budget or
                  reprioritizing in{' '}
                  <button onClick={() => router.push('/tasks/all')} className="text-accent-yellow font-semibold">
                    all tasks
                  </button>
                  .
                </p>
              </div>
            )}

            <div className="space-y-8">
              {plan.days.map((day, index) => (
                <div key={day.date.toISOString()} id={`planner-day-${format(day.date, 'yyyy-MM-dd')}`}>
                  <h2 className="text-white text-lg font-semibold px-6 mb-2">{dayHeading(day.date, index)}</h2>
                  <BudgetMeter usedMinutes={day.totalUsedMinutes} budgetMinutes={day.budgetMinutes} />
                  <div className="px-6 space-y-3">
                    {day.tasks.length === 0 ? (
                      <p className="text-text-sec text-sm py-2">Nothing planned.</p>
                    ) : (
                      day.tasks.map((task) => (
                        <TaskCard key={task.taskId} task={task} onClick={() => handleTaskClick(task)} />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
