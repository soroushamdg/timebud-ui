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
import { planWeek, PlannedTaskResult, PlannerTask, DaySegment, BlockSegment, DayCalendar, DEFAULT_PLANNING_HOURS } from '@/lib/planner'
import { useDayCalendar } from '@/hooks/useDayCalendar'
import { DayPlanList } from '@/components/planner/DayPlanList'
import { getTodayUsedMinutes } from '@/lib/planner/dailyUsage'
import { DbProject, DbTask, MissionDifficulty } from '@/types/database'
import { formatMinutesLabel } from '@/lib/dates'
import { getJobXpPreview } from '@/lib/gamification/xp'
import { useAISettings } from '@/hooks/useAISettings'
import { useFocusSessions } from '@/hooks/useSessions'

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
  recurrenceType?: 'daily' | 'specific_days' | 'interval' | null
  recurrenceDays?: number[] | null
  recurrenceInterval?: number | null
}

interface DayPlan {
  date: Date
  budgetMinutes: number
  totalUsedMinutes: number
  tasks: PlannedTask[]
  // Calendar-aware extras (src/lib/planner/planDay.ts); absent in the legacy flat plan.
  segments?: DaySegment[]
  reservedMinutes?: number
  windowMinutes?: number | null
  freeUsedMinutes?: number
  freeBudgetMinutes?: number
  reservedLabel?: string
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
    recurrenceType: dbTask?.recurrence_type,
    recurrenceDays: dbTask?.recurrence_days,
    recurrenceInterval: dbTask?.recurrence_interval,
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
    recurrenceType: task.recurrence_type,
    recurrenceDays: task.recurrence_days,
    recurrenceInterval: task.recurrence_interval,
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
  const { data: aiSettings } = useAISettings()
  const { data: focusSessions } = useFocusSessions()
  const timezone = aiSettings?.timezone || 'UTC'
  const usedMinutesToday = useMemo(
    () => getTodayUsedMinutes(focusSessions ?? [], timezone),
    [focusSessions, timezone]
  )

  // Same calendar inputs Home uses (src/app/(main)/page.tsx): mapped TimeBud blocks
  // reserve, other calendars' busy time walls off, planning hours bound each day.
  const weekCalendar = useDayCalendar(7)
  const calendarConnected = weekCalendar.connected
  const calendarByDate = useMemo(
    () => Object.fromEntries((weekCalendar.data?.days ?? []).map((d) => [d.date, d])) as Record<string, DayCalendar>,
    [weekCalendar.data]
  )
  const planningHours = useMemo(
    () => ({
      start: aiSettings?.planning_start_time || DEFAULT_PLANNING_HOURS.start,
      end: aiSettings?.planning_end_time || DEFAULT_PLANNING_HOURS.end,
      minGapMinutes: aiSettings?.min_gap_minutes ?? DEFAULT_PLANNING_HOURS.minGapMinutes,
    }),
    [aiSettings?.planning_start_time, aiSettings?.planning_end_time, aiSettings?.min_gap_minutes]
  )
  const spilloverProjectIds = useMemo(
    () => (projects ?? []).filter((p) => p.calendar_spillover).map((p) => p.id),
    [projects]
  )

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
    // Minutes already spent in earlier runs today shrink what's left of today's column
    // — otherwise a run stopped early would make this week view look like the full
    // daily budget is still available for the rest of the day.
    const todayBudget = Math.max(0, preferredBudgetMinutes - usedMinutesToday - pinnedTime - manualTime)

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
      // Calendar mode only once connected — otherwise the legacy flat plan, unchanged.
      calendarByDate: calendarConnected ? calendarByDate : undefined,
      timezone,
      planningHours,
      calendarConnected,
      spilloverProjectIds,
      nowForFirstDay: now,
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
      segments: d.segments,
      reservedMinutes: d.reservedMinutes,
      windowMinutes: d.windowMinutes,
      freeUsedMinutes: d.freeUsedMinutes,
      freeBudgetMinutes: d.freeBudgetMinutes,
      reservedLabel: d.segments
        ? Array.from(new Set(d.segments.filter((s): s is BlockSegment => s.kind === 'block').map((s) => s.missionLabel))).join(' & ') || undefined
        : undefined,
    }))

    return { days, unscheduledCount: week.unscheduledTasks.length }
  }, [tasks, projects, pinnedTaskIds, manualTaskIds, preferredBudgetMinutes, allowPartialTasks, usedMinutesToday, calendarConnected, calendarByDate, timezone, planningHours, spilloverProjectIds])

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
      <div className="flex flex-col h-[calc(100vh-5rem)]">
        <div className="flex-shrink-0 h-[2vh]" />

        <div className="flex-shrink-0 px-6 pt-4 mb-6 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-text-primary">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-text-primary text-xl font-bold">Week Ahead</h1>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-text-sec text-center">Loading your week...</p>
          </div>
        ) : (
          <>
            {plan.unscheduledCount > 0 && (
              <div className="mx-6 mb-6 bg-bg-card border border-border-card rounded-xl px-4 py-3">
                <p className="text-text-sec text-sm">
                  {plan.unscheduledCount} job{plan.unscheduledCount === 1 ? '' : 's'} won&apos;t fit in the next 7
                  days at {formatMinutesLabel(preferredBudgetMinutes)}/day. Consider raising your daily budget or
                  reprioritizing in{' '}
                  <button onClick={() => router.push('/tasks/all')} className="text-accent-yellow font-semibold">
                    all jobs
                  </button>
                  .
                </p>
              </div>
            )}

            <div className="space-y-8">
              {plan.days.map((day, index) => (
                <div key={day.date.toISOString()} id={`planner-day-${format(day.date, 'yyyy-MM-dd')}`}>
                  <h2 className="text-text-primary text-lg font-semibold px-6 mb-2">{dayHeading(day.date, index)}</h2>
                  <BudgetMeter
                    usedMinutes={day.totalUsedMinutes}
                    budgetMinutes={day.budgetMinutes}
                    reservedMinutes={day.reservedMinutes}
                    windowMinutes={day.windowMinutes}
                    reservedLabel={day.reservedLabel}
                  />
                  <div className="px-6 space-y-3">
                    {(() => {
                      const renderCard = (task: PlannedTask) => {
                        const difficulty = (task.projectId ? projects?.find(p => p.id === task.projectId)?.difficulty : undefined) as MissionDifficulty | undefined
                        return (
                          <TaskCard
                            key={task.taskId}
                            task={task}
                            onClick={() => handleTaskClick(task)}
                            xpReward={getJobXpPreview(difficulty || 'medium')}
                          />
                        )
                      }
                      if (day.segments) {
                        // Calendar mode: pinned/manual picks (today only) above the day's
                        // windows and block lanes.
                        const explicit = day.tasks.filter((t) => t.isPinned || t.isManual)
                        return (
                          <>
                            {explicit.map(renderCard)}
                            <DayPlanList
                              compact
                              segments={day.segments}
                              budgetReached={(day.freeUsedMinutes ?? 0) >= (day.freeBudgetMinutes ?? 0)}
                              renderJob={(taskId, portion) => {
                                const task = day.tasks.find((t) => t.taskId === taskId)
                                if (!task) return null
                                const shown =
                                  portion && (portion.continued || portion.continues)
                                    ? { ...task, scheduledMinutes: portion.minutes, partial: true }
                                    : task
                                return renderCard(shown)
                              }}
                            />
                          </>
                        )
                      }
                      if (day.tasks.length === 0) {
                        return <p className="text-text-sec text-sm py-2">Nothing planned.</p>
                      }
                      return day.tasks.map(renderCard)
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        </div>
      </div>
    </AppShell>
  )
}
