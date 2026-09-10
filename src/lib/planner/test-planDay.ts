// Scenario test for planDay / planWeek / the recurring-day filter, built from a real week:
// routine 4–6 AM, work 7 AM–3 PM, a French block 4:30–6:30 PM, gym 7–8 PM, a post at 8:30.
//
// Run from the repo root (no test runner in this project; same trick as test-planner.ts):
//   npx esbuild src/lib/planner/test-planDay.ts --bundle --platform=node --format=esm \
//     --alias:@=./src --outfile=/tmp/test-planDay.mjs && node /tmp/test-planDay.mjs

import { planDay, planSession, planWeek, PlannerProject, PlannerTask, localTimeToUtc } from './index'
import { DayBlock, BusyInterval } from './calendarTypes'

const TZ = 'America/Toronto'
const DATE = '2026-09-10' // Thursday
const at = (date: string, hhmm: string) => localTimeToUtc(date, hhmm, TZ).toISOString()
const iv = (date: string, a: string, b: string): BusyInterval => ({ startTime: at(date, a), endTime: at(date, b) })

let failures = 0
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    console.log(`  ok   ${label}`)
  } else {
    failures++
    console.log(`  FAIL ${label}`, detail === undefined ? '' : JSON.stringify(detail))
  }
}

const projects: PlannerProject[] = [
  { id: 'fr', name: 'French', deadline: null, priority: false, status: 'active' },
  { id: 'p41', name: '41 Prompts', deadline: '2026-09-26', priority: false, status: 'active' },
  { id: 'sh', name: 'Shahnameh', deadline: '2026-09-24', priority: false, status: 'active' },
  { id: 'rh', name: 'Rileyhost', deadline: '2026-09-30', priority: false, status: 'active' },
]

const task = (over: Partial<PlannerTask> & Pick<PlannerTask, 'id' | 'project_id' | 'title' | 'estimated_minutes'>): PlannerTask => ({
  milestone_id: null,
  status: 'pending',
  due_date: null,
  order: 0,
  priority: false,
  dependencies: [],
  item_type: 'task',
  ...over,
})

const tasks: PlannerTask[] = [
  task({ id: 'anki', project_id: 'fr', title: 'Review Anki flashcards', estimated_minutes: 35, due_date: DATE, priority: true, recurrence_type: 'daily', order: 1 }),
  task({ id: 'grammar', project_id: 'fr', title: 'Work on the grammar book', estimated_minutes: 120, due_date: '2026-09-09', order: 2 }),
  task({ id: 'vocab', project_id: 'fr', title: 'Add vocab to Anki', estimated_minutes: 30, due_date: '2026-09-11', recurrence_type: 'daily', order: 3 }), // rolled → must wait
  task({ id: 'epics', project_id: 'p41', title: 'Continue rest of the epics', estimated_minutes: 240, due_date: '2026-09-12', order: 4 }),
  task({ id: 'story', project_id: 'sh', title: 'Create storyboard', estimated_minutes: 180, order: 5 }),
  task({ id: 'post', project_id: 'sh', title: 'Prepare posting platform', estimated_minutes: 180, order: 6 }),
  task({ id: 'rest', project_id: 'rh', title: 'Run rest of the epics', estimated_minutes: 540, order: 7 }),
  task({ id: 'done', project_id: 'p41', title: 'Already done', estimated_minutes: 60, status: 'completed', order: 0 }),
]

const frenchBlock: DayBlock = {
  id: 'blk-fr',
  title: 'Practice french - anki',
  projectIds: ['fr'],
  missionLabel: 'French',
  startTime: at(DATE, '16:30'),
  endTime: at(DATE, '18:30'),
}

const busy: BusyInterval[] = [
  iv(DATE, '04:00', '06:00'), // routine
  iv(DATE, '07:00', '15:00'), // work
  iv(DATE, '11:00', '11:30'), // a call inside work — overlaps, must merge
  iv(DATE, '19:00', '20:00'), // gym
  iv(DATE, '20:30', '21:00'), // post
]

const planningHours = { start: '04:00', end: '23:00', minGapMinutes: 20, bufferMinutes: 0 }
const now = new Date(at(DATE, '06:05'))

console.log('\n# planSession: recurring jobs wait for their day')
{
  const plan = planSession({ projects, milestones: [], tasks, budgetMinutes: 240, today: now, allowPartial: true })
  const ids = plan.tasks.map((t) => t.taskId)
  check('rolled daily job (due tomorrow) is absent', !ids.includes('vocab'), ids)
  check('daily job due today is present', ids.includes('anki'), ids)
  check('overdue non-recurring job is present', ids.includes('grammar'), ids)
}

console.log('\n# planDay: Thursday 6:05 AM, 240 budget, 2h French block, walls from other calendars')
{
  const day = planDay({ projects, tasks, budgetMinutes: 240, blocks: [frenchBlock], busy, calendarConnected: true, planningHours, now, timezone: TZ })

  check('reserved = 120', day.reservedMinutes === 120, day.reservedMinutes)
  // Blocks are on top of the budget: the whole 240 goes to free windows.
  check('free budget = 240 (blocks do not eat the budget)', day.freeBudgetMinutes === 240, day.freeBudgetMinutes)
  // 6:05–7 (55), 15–16:30 (90), 18:30–19 (30), 20–20:30 (30), 21–23 (120)
  check('window minutes = 325', day.windowMinutes === 325, day.windowMinutes)
  check('unplanned window minutes = 85', day.unplannedWindowMinutes === 85, day.unplannedWindowMinutes)

  const blockSeg = day.segments.find((s) => s.kind === 'block')
  check('one block segment', !!blockSeg && day.segments.filter((s) => s.kind === 'block').length === 1)
  if (blockSeg && blockSeg.kind === 'block') {
    check('block is upcoming', blockSeg.state === 'upcoming', blockSeg.state)
    check('block lane is French only', blockSeg.tasks.every((t) => t.projectId === 'fr'), blockSeg.tasks.map((t) => t.title))
    check('block lane uses its 120 minutes', blockSeg.totalUsedMinutes === 120, blockSeg.totalUsedMinutes)
    // The overdue 2h grammar job goes first (overdue-first is existing planSession
    // behaviour) and fills the whole 2h block, so Anki waits for the next block.
    check('block lane leads with the overdue grammar job', blockSeg.tasks[0]?.taskId === 'grammar', blockSeg.tasks.map((t) => t.taskId))
    check('block lane only ever holds French jobs', blockSeg.tasks.every((t) => ['anki', 'grammar'].includes(t.taskId)))
    check('block lane does not have the rolled daily job', !blockSeg.tasks.some((t) => t.taskId === 'vocab'))
  }

  const windows = day.segments.filter((s) => s.kind === 'window')
  check('five windows', windows.length === 5, windows.map((w) => w.kind === 'window' && [w.startTime, w.minutes]))
  const w0 = windows[0]
  const w1 = windows[1]
  if (w0?.kind === 'window' && w1?.kind === 'window') {
    check('first window starts at 6:05 (now), 55 min', w0.startTime === now.toISOString() && w0.minutes === 55, [w0.startTime, w0.minutes])
    check('first window fully planned', w0.plannedMinutes === 55, w0.plannedMinutes)
    check('first window is 41 Prompts, continues', w0.portions[0]?.taskId === 'epics' && w0.portions[0]?.continues === true, w0.portions)
    check('second window (3 PM) picks it up, fully used', w1.portions[0]?.taskId === 'epics' && w1.portions[0]?.continued === true && w1.plannedMinutes === 90, w1.portions)
  }
  check('no French in any window', windows.every((w) => w.kind === 'window' && w.portions.every((p) => p.projectId !== 'fr')))
  check('free lane used the whole budget', day.freeUsedMinutes === 240, day.freeUsedMinutes)

  const walls = day.segments.filter((s) => s.kind === 'wall')
  check('walls: work, gym, post (routine is before now)', walls.length === 3, walls.map((w) => [w.startTime, w.endTime]))

  const kinds = day.segments.map((s) => s.kind)
  check('segments are in time order', day.segments.every((s, i) => i === 0 || new Date(s.startTime) >= new Date(day.segments[i - 1].startTime)), kinds)
  check('first segment is the 6 AM window', day.segments[0]?.kind === 'window', kinds)

  const ids = day.orderedTasks.map((t) => t.taskId)
  check('orderedTasks are unique', new Set(ids).size === ids.length, ids)
  check('orderedTasks: free job first', ids[0] === 'epics', ids)
  check('block jobs sit between the 3 PM window and the evening windows', (() => {
    const blockIdx = ids.indexOf('grammar')
    const beforeBlock = day.orderedTasks.slice(0, blockIdx)
    return blockIdx > 0 && beforeBlock.every((t) => t.lane === 'free') && day.orderedTasks[blockIdx]?.lane === 'block' && day.orderedTasks[blockIdx]?.blockLabel === 'French'
  })(), ids)
  check('positions renumbered 1..n', day.orderedTasks.every((t, i) => t.position === i + 1))
  check('total used = 360 (240 free + 120 block)', day.totalUsedMinutes === 360, day.totalUsedMinutes)
}

console.log('\n# planDay: a block bigger than the remaining budget still leaves the budget for other missions')
{
  const day = planDay({ projects, tasks, budgetMinutes: 81, blocks: [frenchBlock], busy, calendarConnected: true, planningHours, now, timezone: TZ })
  check('free budget = 81, not 0', day.freeBudgetMinutes === 81, day.freeBudgetMinutes)
  check('other missions get planned', day.orderedTasks.some((t) => t.lane === 'free' && t.projectId !== 'fr'), day.orderedTasks.map((t) => [t.lane, t.title]))
  check('French still gets its full 2h block', day.reservedMinutes === 120 && day.blockUsedMinutes === 120, [day.reservedMinutes, day.blockUsedMinutes])
  const legacy = planDay({ projects, tasks, budgetMinutes: 81, blocks: [frenchBlock], busy, calendarConnected: true, planningHours, now, timezone: TZ, budgetIncludesBlocks: true })
  check('opt-in inclusive mode still exists (free budget 0)', legacy.freeBudgetMinutes === 0, legacy.freeBudgetMinutes)
}

console.log('\n# planDay: during the block (4:31 PM) — remaining block minutes only')
{
  const later = new Date(at(DATE, '16:31'))
  const day = planDay({ projects, tasks, budgetMinutes: 180, blocks: [frenchBlock], busy, calendarConnected: true, planningHours, now: later, timezone: TZ })
  const blockSeg = day.segments[0]
  check('active block comes first', blockSeg?.kind === 'block' && blockSeg.state === 'active', blockSeg?.kind)
  check('reserved = 119 (remaining minutes)', day.reservedMinutes === 119, day.reservedMinutes)
  check('free budget = 180, capped by evening windows (30+30+120)', day.freeBudgetMinutes === 180, day.freeBudgetMinutes)
}

console.log('\n# planDay: spillover lets French use free windows too')
{
  const day = planDay({ projects, tasks, budgetMinutes: 240, blocks: [frenchBlock], busy, calendarConnected: true, planningHours, now, timezone: TZ, spilloverProjectIds: ['fr'] })
  const freeIds = day.orderedTasks.filter((t) => t.lane === 'free').map((t) => t.taskId)
  check('with spillover, leftover French can appear in the free lane', freeIds.some((id) => id === 'grammar' || id === 'anki') || day.freeUsedMinutes === 120, freeIds)
}

console.log('\n# planDay: 15-minute buffer keeps free windows away from events')
{
  const day = planDay({ projects, tasks, budgetMinutes: 240, blocks: [frenchBlock], busy, calendarConnected: true, planningHours: { ...planningHours, bufferMinutes: 15 }, now, timezone: TZ })
  const windows = day.segments.filter((s) => s.kind === 'window')
  // routine ends 6:00 → 6:15; work 7:00 → 6:45 : 30 min
  // work ends 15:00 → 15:15; block 16:30 → 16:15 : 60 min
  // block ends 18:30 → 18:45; gym 19:00 → 18:45 : 0, dropped
  // gym ends 20:00 → 20:15; post 20:30 → 20:15 : 0, dropped
  // post ends 21:00 → 21:15; day end 23:00 : 105 min
  check('three windows survive the buffer', windows.length === 3, windows.map((w) => w.kind === 'window' && [w.startTime, w.minutes]))
  check('window minutes = 195', day.windowMinutes === 195, day.windowMinutes)
  const w0 = windows[0]
  if (w0?.kind === 'window') {
    check('first window starts 6:15, not 6:05', w0.startTime === at(DATE, '06:15') && w0.minutes === 30, [w0.startTime, w0.minutes])
  }
  const w1 = windows[1]
  if (w1?.kind === 'window') {
    check('afternoon window is 3:15–4:15 PM', w1.startTime === at(DATE, '15:15') && w1.endTime === at(DATE, '16:15'), [w1.startTime, w1.endTime])
  }
  const blockSeg = day.segments.find((s) => s.kind === 'block')
  check('the block itself keeps its full 2h', blockSeg?.kind === 'block' && blockSeg.budgetMinutes === 120, blockSeg?.kind === 'block' && blockSeg.budgetMinutes)
  const walls = day.segments.filter((s) => s.kind === 'wall')
  check('walls are still shown at their real times', walls.some((w) => w.startTime === at(DATE, '07:00') && w.endTime === at(DATE, '15:00')), walls.map((w) => [w.startTime, w.endTime]))
  check('free budget capped by the smaller windows (195)', day.freeBudgetMinutes === 195, day.freeBudgetMinutes)
}

console.log('\n# planDay: calendar not connected — behaves like the old flat plan')
{
  const day = planDay({ projects, tasks, budgetMinutes: 240, blocks: [], busy: [], calendarConnected: false, planningHours, now, timezone: TZ })
  check('windowMinutes is null (no cap)', day.windowMinutes === null, day.windowMinutes)
  check('free budget = full 240', day.freeBudgetMinutes === 240, day.freeBudgetMinutes)
  check('no walls', !day.segments.some((s) => s.kind === 'wall'))
  check('one window holding everything', day.segments.filter((s) => s.kind === 'window').length === 1)
  check('French planned like any other mission (no block today)', day.orderedTasks.some((t) => t.projectId === 'fr'))
  check('total used = 240', day.totalUsedMinutes === 240, day.totalUsedMinutes)
}

console.log('\n# planDay: block already ended — folded, mission freed')
{
  const evening = new Date(at(DATE, '21:05'))
  const day = planDay({ projects, tasks, budgetMinutes: 100, blocks: [frenchBlock], busy, calendarConnected: true, planningHours, now: evening, timezone: TZ })
  check('no block segment', !day.segments.some((s) => s.kind === 'block'))
  check('reserved = 0', day.reservedMinutes === 0, day.reservedMinutes)
  check('free budget = 100, within the 21–23 window', day.freeBudgetMinutes === 100, day.freeBudgetMinutes)
  check('French no longer fenced (block is past)', day.coveredProjectIds.length === 0, day.coveredProjectIds)
}

console.log('\n# planWeek: calendar mode carries the pool across days')
{
  const fri = '2026-09-11'
  const friBlock: DayBlock = { ...frenchBlock, id: 'blk-fr-fri', startTime: at(fri, '16:30'), endTime: at(fri, '18:30') }
  const week = planWeek({
    projects,
    tasks,
    dailyBudgetMinutes: 240,
    startDate: now,
    days: 2,
    calendarByDate: {
      [DATE]: { date: DATE, blocks: [frenchBlock], busy },
      [fri]: { date: fri, blocks: [friBlock], busy: [iv(fri, '04:00', '06:00'), iv(fri, '07:00', '15:00')] },
    },
    timezone: TZ,
    planningHours,
    calendarConnected: true,
    nowForFirstDay: now,
  })
  check('two days', week.days.length === 2)
  check('day 0 has segments', Array.isArray(week.days[0].segments) && week.days[0].segments!.length > 0)
  check('day 0 reserved 120', week.days[0].reservedMinutes === 120, week.days[0].reservedMinutes)
  const d0 = week.days[0].tasks.map((t) => t.taskId)
  const d1 = week.days[1].tasks.map((t) => t.taskId)
  check('day 1 does not repeat a fully scheduled day-0 job', !d1.includes('grammar'), { d0, d1 })
  check('day 1 picks up Anki, which did not fit day 0\'s block', d1.includes('anki'), { d0, d1 })
  check('day 1 (Friday) is when the rolled daily job finally appears', !d0.includes('vocab') && d1.includes('vocab'), { d0, d1 })
  check('day 0 finishes the 240-min 41 Prompts job in its 240 free budget', d0.includes('epics') && !d1.includes('epics'), { d0, d1 })
  check('day 1 moves on to the remaining missions', d1.includes('story'), d1)
  check('day 1 plans from planning start (whole day free budget = 240)', week.days[1].freeBudgetMinutes === 240, week.days[1].freeBudgetMinutes)
}

console.log('\n# planWeek: legacy mode unchanged when no calendar is given')
{
  const week = planWeek({ projects, tasks, dailyBudgetMinutes: 240, startDate: now, days: 1 })
  check('no segments in legacy mode', week.days[0].segments === undefined)
  check('legacy day used 240', week.days[0].totalUsedMinutes === 240, week.days[0].totalUsedMinutes)
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
if (failures > 0) process.exit(1)
