import { planSession, PlannedTaskResult, PlannerOutput, PlannerProject, PlannerTask } from './index'
import { BusyInterval, DayBlock, PlanningHours } from './calendarTypes'
import { computeWindows } from './windows'

// One day's plan as the calendar sees it: every mapped TimeBud block becomes a lane
// that is planned only from its own mission(s) with only its own minutes, and whatever
// is left of the daily budget becomes a "free" lane planned from every other mission
// and poured into the real gaps between busy events. planSession is untouched — this
// just calls it once per lane over a shrinking pool, the same trick planWeek uses.

export type BlockState = 'past' | 'active' | 'upcoming'

export interface PlanDayInput {
  projects: PlannerProject[]
  /** All tasks (completed ones included, so dependency checks still resolve). */
  tasks: PlannerTask[]
  /** What's left of today's budget after time already spent and pinned/manual picks. */
  budgetMinutes: number
  blocks: DayBlock[]
  busy: BusyInterval[]
  calendarConnected: boolean
  planningHours: PlanningHours
  now: Date
  timezone: string
  allowPartial?: boolean
  /** Missions allowed to also fill free windows on a day they have a block. */
  spilloverProjectIds?: Iterable<string>
  /** Default true: block minutes come out of the daily budget rather than on top of it. */
  budgetIncludesBlocks?: boolean
}

export interface TaskPortion {
  taskId: string
  title: string
  projectId: string | null
  minutes: number
  /** Picks up a task that was started in an earlier window. */
  continued: boolean
  /** The task goes on in a later window. */
  continues: boolean
}

export interface BlockSegment {
  kind: 'block'
  blockId: string
  title: string
  missionLabel: string
  projectIds: string[]
  startTime: string
  endTime: string
  state: BlockState
  budgetMinutes: number
  totalUsedMinutes: number
  slackMinutes: number
  tasks: PlannedTaskResult[]
}

export interface WindowSegment {
  kind: 'window'
  startTime: string
  endTime: string
  minutes: number
  plannedMinutes: number
  portions: TaskPortion[]
}

export interface WallSegment {
  kind: 'wall'
  startTime: string
  endTime: string
  minutes: number
}

export type DaySegment = BlockSegment | WindowSegment | WallSegment

export interface PlannedDayTask extends PlannedTaskResult {
  lane: 'block' | 'free'
  blockId?: string
  blockLabel?: string
  blockStartTime?: string
  blockEndTime?: string
  windowStartTime?: string
}

export interface PlanDayOutput {
  /** Time-ordered: an active block first, then windows, walls and blocks as the day unfolds. */
  segments: DaySegment[]
  /** Every planned task once, in the order it comes up during the day — what a run consumes. */
  orderedTasks: PlannedDayTask[]
  budgetMinutes: number
  reservedMinutes: number
  freeBudgetMinutes: number
  /** Free minutes that actually exist on the calendar today, or null when not connected. */
  windowMinutes: number | null
  freeUsedMinutes: number
  blockUsedMinutes: number
  totalUsedMinutes: number
  unplannedWindowMinutes: number
  coveredProjectIds: string[]
  dayStart: string
  dayEnd: string
}

// A leftover sliver at the end of a window isn't worth starting something in; carry
// the task to the next window instead. (Small tasks that fit the sliver still take it.)
const MIN_PORTION_MINUTES = 15

const emptyPlan = (budgetMinutes: number): PlannerOutput => ({
  budgetMinutes,
  totalUsedMinutes: 0,
  slackMinutes: budgetMinutes,
  taskCount: 0,
  tasks: [],
})

const minutesBetween = (a: string | number, b: string | number): number =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000))

export function getBlockState(block: DayBlock, now: Date): BlockState {
  const nowMs = now.getTime()
  if (new Date(block.endTime).getTime() <= nowMs) return 'past'
  if (new Date(block.startTime).getTime() <= nowMs) return 'active'
  return 'upcoming'
}

// Minutes a block still reserves from `now` on — nothing for a block that already
// ended (its time is already inside "used today"), only the remainder of an active one.
export function getBlockReservedMinutes(block: DayBlock, now: Date): number {
  const state = getBlockState(block, now)
  if (state === 'past') return 0
  if (state === 'active') return minutesBetween(now.getTime(), block.endTime)
  return minutesBetween(block.startTime, block.endTime)
}

function applyToPool(pool: Map<string, PlannerTask>, planned: PlannedTaskResult[]): void {
  for (const scheduled of planned) {
    if (scheduled.partial && scheduled.carryOverMinutes > 0) {
      const remaining = pool.get(scheduled.taskId)
      if (remaining) remaining.estimated_minutes = scheduled.carryOverMinutes
    } else {
      pool.delete(scheduled.taskId)
    }
  }
}

export function planDay(input: PlanDayInput): PlanDayOutput {
  const { now, timezone, planningHours, calendarConnected } = input
  const allowPartial = input.allowPartial ?? true
  const budgetIncludesBlocks = input.budgetIncludesBlocks ?? true
  const spillover = new Set(input.spilloverProjectIds ?? [])
  const activeProjectIds = new Set(input.projects.filter((p) => p.status === 'active').map((p) => p.id))

  const blocks = input.blocks
    .filter((b) => b.projectIds.some((id) => activeProjectIds.has(id)))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  const pool = new Map<string, PlannerTask>(input.tasks.map((t) => [t.id, { ...t }]))

  // --- Block lanes -------------------------------------------------------------------
  const blockSegments: BlockSegment[] = []
  const covered = new Set<string>()
  let reservedMinutes = 0

  for (const block of blocks) {
    const state = getBlockState(block, now)
    if (state === 'past') continue

    const budget = getBlockReservedMinutes(block, now)
    reservedMinutes += budget
    block.projectIds.forEach((id) => covered.add(id))

    const scopedProjects = input.projects.filter((p) => block.projectIds.includes(p.id))
    const scopedTasks = Array.from(pool.values()).filter(
      (t) => t.project_id !== null && block.projectIds.includes(t.project_id)
    )
    const plan =
      budget > 0
        ? planSession({ projects: scopedProjects, milestones: [], tasks: scopedTasks, budgetMinutes: budget, today: now, allowPartial })
        : emptyPlan(0)
    applyToPool(pool, plan.tasks)

    blockSegments.push({
      kind: 'block',
      blockId: block.id,
      title: block.title,
      missionLabel: block.missionLabel,
      projectIds: block.projectIds,
      startTime: block.startTime,
      endTime: block.endTime,
      state,
      budgetMinutes: budget,
      totalUsedMinutes: plan.totalUsedMinutes,
      slackMinutes: plan.slackMinutes,
      tasks: plan.tasks,
    })
  }

  // --- Free lane ---------------------------------------------------------------------
  const windowsResult = computeWindows({ now, timezone, planningHours, busy: input.busy, blocks, calendarConnected })

  let freeBudgetMinutes = budgetIncludesBlocks
    ? Math.max(0, input.budgetMinutes - reservedMinutes)
    : Math.max(0, input.budgetMinutes)
  if (windowsResult.windowMinutes !== null) {
    freeBudgetMinutes = Math.min(freeBudgetMinutes, windowsResult.windowMinutes)
  }

  // A mission with a block today is fenced to it unless the user opted it into spillover.
  const freeTasks = Array.from(pool.values()).filter(
    (t) => t.project_id === null || !covered.has(t.project_id) || spillover.has(t.project_id)
  )
  const freePlan =
    freeBudgetMinutes > 0
      ? planSession({ projects: input.projects, milestones: [], tasks: freeTasks, budgetMinutes: freeBudgetMinutes, today: now, allowPartial })
      : emptyPlan(0)

  // Pour the free lane into the windows in order; a task that doesn't fit the rest of
  // a window carries on in the next one.
  const windowSegments: WindowSegment[] = windowsResult.windows.map((w) => ({
    kind: 'window',
    startTime: w.startTime,
    endTime: w.endTime,
    minutes: w.minutes,
    plannedMinutes: 0,
    portions: [],
  }))

  let wi = 0
  for (const task of freePlan.tasks) {
    let remaining = task.scheduledMinutes
    let first = true
    while (remaining > 0) {
      const w = windowSegments[wi]
      if (!w) {
        // Rounding left a task without a window — keep it visible on the last one
        // rather than dropping it from the day.
        const last = windowSegments[windowSegments.length - 1]
        const portion: TaskPortion = { taskId: task.taskId, title: task.title, projectId: task.projectId, minutes: remaining, continued: !first, continues: false }
        if (last) {
          last.portions.push(portion)
          last.plannedMinutes += remaining
        } else {
          windowSegments.push({ kind: 'window', startTime: windowsResult.from, endTime: windowsResult.dayEnd, minutes: 0, plannedMinutes: remaining, portions: [portion] })
        }
        remaining = 0
        break
      }
      const capacity = w.minutes - w.plannedMinutes
      if (capacity < MIN_PORTION_MINUTES && capacity < remaining) {
        wi++
        continue
      }
      const take = Math.min(remaining, capacity)
      w.portions.push({ taskId: task.taskId, title: task.title, projectId: task.projectId, minutes: take, continued: !first, continues: remaining - take > 0 })
      w.plannedMinutes += take
      remaining -= take
      first = false
      if (w.plannedMinutes >= w.minutes) wi++
    }
  }

  const wallSegments: WallSegment[] = windowsResult.walls.map((w) => ({ kind: 'wall', startTime: w.startTime, endTime: w.endTime, minutes: w.minutes }))

  const segments: DaySegment[] = [...blockSegments, ...windowSegments, ...wallSegments].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )

  // --- Flatten for the run -----------------------------------------------------------
  const orderedTasks: PlannedDayTask[] = []
  const seen = new Set<string>()
  for (const seg of segments) {
    if (seg.kind === 'block') {
      for (const t of seg.tasks) {
        if (seen.has(t.taskId)) continue
        seen.add(t.taskId)
        orderedTasks.push({ ...t, lane: 'block', blockId: seg.blockId, blockLabel: seg.missionLabel, blockStartTime: seg.startTime, blockEndTime: seg.endTime })
      }
    } else if (seg.kind === 'window') {
      for (const p of seg.portions) {
        if (seen.has(p.taskId)) continue
        const full = freePlan.tasks.find((t) => t.taskId === p.taskId)
        if (!full) continue
        seen.add(p.taskId)
        orderedTasks.push({ ...full, lane: 'free', windowStartTime: seg.startTime })
      }
    }
  }
  // Renumber so positions reflect the day's order rather than each lane's own numbering.
  orderedTasks.forEach((t, i) => { t.position = i + 1 })

  const blockUsedMinutes = blockSegments.reduce((sum, s) => sum + s.totalUsedMinutes, 0)
  const freeUsedMinutes = freePlan.totalUsedMinutes
  const unplannedWindowMinutes =
    windowsResult.windowMinutes === null ? 0 : Math.max(0, windowsResult.windowMinutes - freeUsedMinutes)

  return {
    segments,
    orderedTasks,
    budgetMinutes: input.budgetMinutes,
    reservedMinutes,
    freeBudgetMinutes,
    windowMinutes: windowsResult.windowMinutes,
    freeUsedMinutes,
    blockUsedMinutes,
    totalUsedMinutes: freeUsedMinutes + blockUsedMinutes,
    unplannedWindowMinutes,
    coveredProjectIds: Array.from(covered),
    dayStart: windowsResult.dayStart,
    dayEnd: windowsResult.dayEnd,
  }
}
