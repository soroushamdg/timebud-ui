import { addDays } from 'date-fns'
import { getLocalDateString, getLocalHour, parseDateLocal, formatMinutesLabel } from '@/lib/dates'
import { planSession, planWeek, PlannerProject, PlannerTask } from '@/lib/planner'
import { DbProject, DbTask, DbUserAISettings } from '@/types/database'

export interface NotificationPayload {
  title: string
  body: string
  url: string
}

export interface ProducerResult {
  payload: NotificationPayload | null
  markSessionId?: string
  newStreakMilestone?: number
}

export interface SessionContext {
  id: string
  start_time: string | null
  end_time: string | null
  unfinished_reminder_sent_at: string | null
}

export interface NotificationContext {
  tasks: DbTask[]
  projects: DbProject[]
  sessions: SessionContext[]
  settings: DbUserAISettings
  now: Date
  timezone: string
  // Local (YYYY-MM-DD, in `timezone`) dates within the lookback window that had any
  // task-created or session-started activity — used both for "touched today" and for
  // the streak walk-back.
  activityDates: Set<string>
}

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100]
const UNFINISHED_SESSION_STALE_MS = 2 * 60 * 60 * 1000

function parseHour(time: string | null | undefined): number | null {
  if (!time) return null
  const h = parseInt(time.split(':')[0] ?? '', 10)
  return Number.isNaN(h) ? null : h
}

function isDueHour(ctx: NotificationContext, time: string | null | undefined): boolean {
  const hour = parseHour(time)
  return hour !== null && getLocalHour(ctx.now, ctx.timezone) === hour
}

function toPlannerTasks(tasks: DbTask[]): PlannerTask[] {
  return tasks
    .filter((t) => t.status === 'pending' && t.item_type === 'task' && !t.on_hold)
    .map((t) => ({
      id: t.id,
      project_id: t.project_id,
      milestone_id: t.milestone_id,
      title: t.title,
      estimated_minutes: t.estimated_minutes || 0,
      status: t.status || 'pending',
      due_date: t.due_date,
      order: t.order,
      priority: t.priority,
      dependencies: t.dependencies,
      item_type: t.item_type,
      on_hold: t.on_hold,
    }))
}

function toPlannerProjects(projects: DbProject[]): PlannerProject[] {
  return projects
    .filter((p) => p.status === 'active')
    .map((p) => ({ id: p.id, name: p.name, deadline: p.deadline, priority: p.priority, status: p.status }))
}

// #1 + #4: morning briefing, replaced by a weekly look-ahead on the user's configured
// first day of the week (Sunday or Monday — same setting used for the planner/temporal
// context elsewhere, not a separate day picker here).
export function buildMorningPayload(ctx: NotificationContext): ProducerResult | null {
  if (!isDueHour(ctx, ctx.settings.morning_briefing_time)) return null

  const todayDow = parseDateLocal(getLocalDateString(ctx.now, ctx.timezone)).getDay() // 0=Sun..6=Sat
  const weekStartDow = ctx.settings.first_day_of_week === 'Sunday' ? 0 : 1
  const isFirstDayOfWeek = todayDow === weekStartDow
  const budgetMinutes = ctx.settings.preferred_session_minutes || 60
  const projects = toPlannerProjects(ctx.projects)
  const pool = toPlannerTasks(ctx.tasks)

  if (isFirstDayOfWeek && ctx.settings.weekly_lookahead_enabled) {
    if (pool.length === 0) return null
    const week = planWeek({ projects, tasks: pool, dailyBudgetMinutes: budgetMinutes, startDate: ctx.now, days: 7 })
    const heaviestDay = week.days.reduce(
      (max, d) => (d.totalUsedMinutes > (max?.totalUsedMinutes ?? -1) ? d : max),
      week.days[0] ?? null
    )
    const parts = [`${pool.length} task${pool.length === 1 ? '' : 's'} across the week`]
    if (heaviestDay && heaviestDay.totalUsedMinutes > 0) {
      const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(parseDateLocal(heaviestDay.date))
      parts.push(`${dayName} is heaviest (${formatMinutesLabel(heaviestDay.totalUsedMinutes)})`)
    }
    if (week.unscheduledTasks.length > 0) {
      parts.push(`${week.unscheduledTasks.length} won't fit at this pace`)
    }
    return { payload: { title: 'Your week ahead', body: parts.join(' · '), url: '/planner' } }
  }

  if (!ctx.settings.morning_briefing_enabled || pool.length === 0) return null

  const plan = planSession({ projects, milestones: [], tasks: pool, budgetMinutes, today: ctx.now })
  if (plan.taskCount === 0) return null
  const first = plan.tasks[0]
  return {
    payload: {
      title: 'Good morning!',
      body: `${plan.taskCount} task${plan.taskCount === 1 ? '' : 's'} planned today, ${formatMinutesLabel(plan.totalUsedMinutes)} of ${formatMinutesLabel(budgetMinutes)}. First up: ${first.title}.`,
      url: '/',
    },
  }
}

// #3: deadline alerts — "N due tomorrow." due_date is a plain calendar date (see the
// timezone fix elsewhere in this codebase), so this is a direct string compare, not a
// Date round-trip.
export function buildDeadlineAlertPayload(ctx: NotificationContext): ProducerResult | null {
  if (!ctx.settings.deadline_alerts_enabled) return null
  if (!isDueHour(ctx, ctx.settings.morning_briefing_time)) return null

  const tomorrow = getLocalDateString(addDays(ctx.now, 1), ctx.timezone)
  const dueTomorrow = ctx.tasks.filter(
    (t) => t.status === 'pending' && t.item_type === 'task' && t.due_date && t.due_date.split('T')[0] === tomorrow
  )
  if (dueTomorrow.length === 0) return null

  return {
    payload: {
      title: 'Due tomorrow',
      body:
        dueTomorrow.length === 1
          ? `"${dueTomorrow[0].title}" is due tomorrow.`
          : `${dueTomorrow.length} tasks are due tomorrow.`,
      url: '/tasks/all',
    },
  }
}

// #2: the original inactivity nudge — unchanged behavior, just relocated here.
export function buildInactivityPayload(ctx: NotificationContext): ProducerResult | null {
  if (!ctx.settings.reminder_enabled) return null
  if (!isDueHour(ctx, ctx.settings.reminder_time)) return null

  const today = getLocalDateString(ctx.now, ctx.timezone)
  if (ctx.activityDates.has(today)) return null

  return {
    payload: {
      title: 'Got a minute for TimeBud?',
      body: "You haven't added anything today — jot down a task before you forget.",
      url: '/?capture=1',
    },
  }
}

// #5: resume an unfinished focus session, once, ~2h after it was left open.
export function buildUnfinishedSessionPayload(ctx: NotificationContext): ProducerResult | null {
  if (!ctx.settings.unfinished_session_alerts_enabled) return null

  const stale = ctx.sessions.find(
    (s) =>
      s.end_time === null &&
      !s.unfinished_reminder_sent_at &&
      s.start_time &&
      ctx.now.getTime() - new Date(s.start_time).getTime() >= UNFINISHED_SESSION_STALE_MS
  )
  if (!stale) return null

  return {
    payload: {
      title: 'Still working on it?',
      body: "You started a focus session a couple hours ago and didn't wrap it up — pick back up?",
      url: '/',
    },
    markSessionId: stale.id,
  }
}

// #6: streak milestones. Runs every tick (not just the morning hour) so a broken streak
// resets promptly — the reset itself is silent (no notification, just state to persist).
export function buildStreakPayload(ctx: NotificationContext): ProducerResult | null {
  if (!ctx.settings.streak_alerts_enabled) return null

  let streak = 0
  for (let i = 1; i <= 120; i++) {
    const day = getLocalDateString(addDays(ctx.now, -i), ctx.timezone)
    if (ctx.activityDates.has(day)) streak++
    else break
  }

  const lastMilestone = ctx.settings.last_streak_milestone ?? 0

  if (streak === 0) {
    return lastMilestone > 0 ? { payload: null, newStreakMilestone: 0 } : null
  }

  if (!isDueHour(ctx, ctx.settings.morning_briefing_time)) return null

  const nextMilestone = STREAK_MILESTONES.find((m) => m > lastMilestone && streak >= m)
  if (!nextMilestone) return null

  return {
    payload: {
      title: `🔥 ${nextMilestone}-day streak!`,
      body: `You've used TimeBud ${nextMilestone} days in a row. Keep it going.`,
      url: '/',
    },
    newStreakMilestone: nextMilestone,
  }
}
