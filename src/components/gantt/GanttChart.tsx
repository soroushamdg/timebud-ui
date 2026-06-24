'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart2, List, Lock, Clock } from 'lucide-react'
import { DbTask, DbProject } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_WIDTH = 32
const ROW_HEIGHT = 36
const HEADER_HEIGHT = 48
const LABEL_WIDTH = 120
const DAYS_BEFORE = 60
const DAYS_AFTER = 90
const TOTAL_DAYS = DAYS_BEFORE + DAYS_AFTER

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sod(d: Date): Date { const r = new Date(d); r.setHours(0, 0, 0, 0); return r }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function diffDays(a: Date, b: Date): number {
  return Math.round((sod(a).getTime() - sod(b).getTime()) / 86_400_000)
}
function fmtShort(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function fmtFull(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtMins(m: number | null): string {
  if (!m) return ''
  if (m >= 60) { const h = Math.floor(m / 60); const r = m % 60; return r ? `${h}h ${r}m` : `${h}h` }
  return `${m}m`
}
function weekMondayKey(d: Date): string {
  const r = sod(d)
  const day = r.getDay()
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day))
  return r.toISOString().split('T')[0]
}
function weekRange(key: string): string {
  const s = new Date(key + 'T00:00:00')
  return `${fmtShort(s)} – ${fmtShort(addDays(s, 6))}`
}

// ─── Bar calculations ─────────────────────────────────────────────────────────
function getBarBounds(
  task: DbTask,
  chartStart: Date,
  chartEnd: Date,
): { startX: number; width: number; openEnd: boolean } {
  const endDate = task.due_date ? sod(new Date(task.due_date)) : chartEnd
  const openEnd = !task.due_date

  let startDate: Date
  if (task.due_date && task.estimated_minutes) {
    const durDays = Math.max(0.5, task.estimated_minutes / 1440)
    startDate = addDays(new Date(task.due_date), -Math.ceil(durDays))
  } else if (task.due_date) {
    startDate = addDays(new Date(task.due_date), -1)
  } else {
    startDate = sod(new Date(task.created_at))
  }

  const rawStart = diffDays(startDate, chartStart)
  const rawEnd = diffDays(endDate, chartStart)
  const clampedStart = Math.max(0, Math.min(rawStart, TOTAL_DAYS - 1))
  const clampedEnd = Math.max(clampedStart + 1, Math.min(rawEnd, TOTAL_DAYS))

  return {
    startX: clampedStart * DAY_WIDTH,
    width: Math.max(DAY_WIDTH, (clampedEnd - clampedStart) * DAY_WIDTH),
    openEnd,
  }
}

function getMilestoneX(task: DbTask, chartStart: Date): number | null {
  if (!task.due_date) return null
  const dx = diffDays(new Date(task.due_date), chartStart)
  if (dx < 0 || dx > TOTAL_DAYS) return null
  return dx * DAY_WIDTH + DAY_WIDTH / 2
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GanttChartProps {
  tasks: DbTask[]
  projects: DbProject[]
}

interface PopoverState {
  task: DbTask
  projName: string
  x: number
  y: number
}

// ─── Timeline View ────────────────────────────────────────────────────────────
function TimelineView({ tasks, projects }: GanttChartProps) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [popover, setPopover] = useState<PopoverState | null>(null)

  const today = sod(new Date())
  const chartStart = addDays(today, -DAYS_BEFORE)
  const chartEnd = addDays(today, DAYS_AFTER)
  const todayOffsetX = DAYS_BEFORE * DAY_WIDTH + DAY_WIDTH / 2

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = (DAYS_BEFORE - 14) * DAY_WIDTH
    }
  }, [])

  const projectMap = new Map(projects.map(p => [p.id, p]))
  const statusMap = new Map(tasks.map(t => [t.id, t.status]))
  const isBlocked = (t: DbTask) =>
    !!t.dependencies?.length && t.dependencies.some(d => statusMap.get(d) !== 'completed')

  const groups = projects
    .map(p => ({ project: p, tasks: tasks.filter(t => t.project_id === p.id) }))
    .filter(g => g.tasks.length > 0)
  const orphan = tasks.filter(t => !t.project_id)
  if (orphan.length > 0) groups.push({ project: { id: '', name: 'No Project', color: null } as DbProject, tasks: orphan })

  // Build header ticks (months + mondays)
  const ticks: { x: number; label: string; bold: boolean }[] = []
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const d = addDays(chartStart, i)
    if (d.getDate() === 1) {
      ticks.push({ x: i * DAY_WIDTH, label: d.toLocaleDateString(undefined, { month: 'short' }), bold: true })
    } else if (d.getDay() === 1) {
      ticks.push({ x: i * DAY_WIDTH, label: String(d.getDate()), bold: false })
    }
  }

  const handleBarClick = useCallback((task: DbTask) => {
    if (task.project_id) router.push(`/projects/${task.project_id}`)
  }, [router])

  const onBarEnter = useCallback((e: React.MouseEvent, task: DbTask) => {
    const proj = task.project_id ? projectMap.get(task.project_id) : undefined
    setPopover({ task, projName: proj?.name ?? '', x: e.clientX, y: e.clientY })
  }, [projectMap])

  return (
    <div className="relative w-full overflow-hidden">
      <div
        ref={scrollRef}
        className="overflow-auto w-full"
        style={{ maxHeight: 'calc(100vh - 180px)' }}
      >
        <div style={{ minWidth: LABEL_WIDTH + TOTAL_DAYS * DAY_WIDTH, position: 'relative' }}>
          {/* Sticky header row */}
          <div
            className="flex sticky top-0 z-20 bg-bg-primary border-b border-border-card"
            style={{ height: HEADER_HEIGHT }}
          >
            <div
              className="sticky left-0 z-30 bg-bg-primary border-r border-border-card flex-shrink-0"
              style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
            />
            <div className="relative flex-shrink-0" style={{ width: TOTAL_DAYS * DAY_WIDTH }}>
              {/* Today marker in header */}
              <div
                className="absolute inset-y-0 w-0.5 bg-accent-yellow/60"
                style={{ left: todayOffsetX }}
              />
              {ticks.map(tk => (
                <span
                  key={tk.x}
                  className={`absolute bottom-1.5 text-[10px] select-none ${tk.bold ? 'text-white font-semibold' : 'text-text-sec'}`}
                  style={{ left: tk.x + 2 }}
                >
                  {tk.label}
                </span>
              ))}
            </div>
          </div>

          {/* Project groups */}
          {groups.map(({ project, tasks: gTasks }) => {
            const color = project.color ?? '#f5c518'
            return (
              <div key={project.id || 'orphan'}>
                {/* Project header row */}
                <div
                  className="flex sticky top-[48px] z-10 border-b border-border-card bg-bg-card"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div
                    className="sticky left-0 z-20 bg-bg-card border-r border-border-card flex items-center gap-1.5 px-2 flex-shrink-0"
                    style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-white text-xs font-semibold truncate">{project.name}</span>
                  </div>
                  <div
                    className="relative flex-shrink-0"
                    style={{ width: TOTAL_DAYS * DAY_WIDTH }}
                  >
                    <div className="absolute inset-y-0 w-0.5 bg-accent-yellow/20" style={{ left: todayOffsetX }} />
                  </div>
                </div>

                {/* Task / milestone rows */}
                {gTasks.map(task => {
                  const isMilestone = task.item_type === 'milestone'
                  const isCompleted = task.status === 'completed'
                  const onHold = task.on_hold
                  const blocked = !onHold && isBlocked(task)
                  const isRecurring = !!task.recurrence_type

                  if (isMilestone) {
                    const mx = getMilestoneX(task, chartStart)
                    return (
                      <div key={task.id} className="flex border-b border-border-card/30" style={{ height: ROW_HEIGHT }}>
                        <div
                          className="sticky left-0 z-20 bg-bg-primary border-r border-border-card flex items-center gap-1 px-2 flex-shrink-0"
                          style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
                        >
                          <span className="text-accent-yellow text-[11px] flex-shrink-0">◆</span>
                          <span className="text-text-sec text-xs truncate">{task.title}</span>
                        </div>
                        <div className="relative flex-shrink-0" style={{ width: TOTAL_DAYS * DAY_WIDTH, height: ROW_HEIGHT }}>
                          <div className="absolute inset-y-0 w-0.5 bg-accent-yellow/20" style={{ left: todayOffsetX }} />
                          {mx !== null && (
                            <div
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer group"
                              style={{ left: mx }}
                              onClick={() => handleBarClick(task)}
                              title={task.title}
                            >
                              <div className="w-3 h-3 bg-accent-yellow rotate-45 group-hover:scale-125 transition-transform" />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  const { startX, width, openEnd } = getBarBounds(task, chartStart, chartEnd)
                  const barBg = isCompleted
                    ? `${color}44`
                    : color

                  return (
                    <div key={task.id} className="flex border-b border-border-card/30" style={{ height: ROW_HEIGHT }}>
                      <div
                        className="sticky left-0 z-20 bg-bg-primary border-r border-border-card flex items-center px-2 flex-shrink-0"
                        style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
                      >
                        <span className={`text-xs truncate ${isCompleted ? 'line-through text-text-sec' : onHold ? 'text-text-sec italic' : 'text-white'}`}>
                          {task.title}
                        </span>
                      </div>
                      <div className="relative flex-shrink-0" style={{ width: TOTAL_DAYS * DAY_WIDTH, height: ROW_HEIGHT }}>
                        <div className="absolute inset-y-0 w-0.5 bg-accent-yellow/20" style={{ left: todayOffsetX }} />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded flex items-center gap-0.5 px-1 overflow-hidden cursor-pointer hover:brightness-110 transition-[filter]"
                          style={{
                            left: startX,
                            width,
                            height: 22,
                            background: barBg,
                            opacity: isCompleted ? 0.55 : 1,
                            backgroundImage: onHold
                              ? `repeating-linear-gradient(45deg, rgba(0,0,0,0.35), rgba(0,0,0,0.35) 4px, transparent 4px, transparent 10px)`
                              : undefined,
                            borderRight: openEnd ? '2px dashed rgba(255,255,255,0.45)' : undefined,
                          }}
                          onMouseEnter={e => onBarEnter(e, task)}
                          onMouseLeave={() => setPopover(null)}
                          onClick={() => handleBarClick(task)}
                        >
                          {onHold && <Clock size={10} className="text-white/80 flex-shrink-0" />}
                          {blocked && <Lock size={10} className="text-white/80 flex-shrink-0" />}
                          {!onHold && !blocked && isRecurring && <span className="text-white/80 text-[10px] flex-shrink-0">↻</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {groups.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <p className="text-text-sec text-sm">No tasks to display</p>
            </div>
          )}
        </div>
      </div>

      {/* Hover popover */}
      {popover && (
        <div
          className="fixed z-50 bg-bg-card border border-border-card rounded-lg p-3 shadow-xl text-xs pointer-events-none"
          style={{
            left: Math.min(popover.x + 14, window.innerWidth - 210),
            top: Math.max(8, popover.y - 80),
            maxWidth: 200,
          }}
        >
          <p className="text-white font-semibold mb-1 leading-snug">{popover.task.title}</p>
          {popover.projName && <p className="text-text-sec mb-0.5">{popover.projName}</p>}
          {popover.task.due_date && <p className="text-text-sec mb-0.5">Due: {fmtFull(new Date(popover.task.due_date))}</p>}
          {popover.task.estimated_minutes != null && (
            <p className="text-text-sec mb-0.5">Est: {fmtMins(popover.task.estimated_minutes)}</p>
          )}
          <p className="text-text-sec capitalize">
            {popover.task.on_hold ? 'on hold' : (popover.task.status ?? 'pending')}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── List View ────────────────────────────────────────────────────────────────
function ListView({ tasks, projects }: GanttChartProps) {
  const router = useRouter()
  const projectMap = new Map(projects.map(p => [p.id, p]))
  const visible = tasks
  const withDue = [...visible.filter(t => t.due_date)].sort(
    (a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime(),
  )
  const noDue = visible.filter(t => !t.due_date)

  const weekGroups = new Map<string, DbTask[]>()
  for (const t of withDue) {
    const k = weekMondayKey(new Date(t.due_date!))
    if (!weekGroups.has(k)) weekGroups.set(k, [])
    weekGroups.get(k)!.push(t)
  }

  const renderRow = (task: DbTask) => {
    const proj = task.project_id ? projectMap.get(task.project_id) : undefined
    const color = proj?.color ?? '#f5c518'
    const isMilestone = task.item_type === 'milestone'
    const isCompleted = task.status === 'completed'
    const onHold = task.on_hold

    return (
      <button
        key={task.id}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-bg-card transition-colors text-left min-w-0"
        onClick={() => task.project_id && router.push(`/projects/${task.project_id}`)}
      >
        {isMilestone ? (
          <span className="text-accent-yellow text-[11px] flex-shrink-0">◆</span>
        ) : (
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
        )}
        <span className={`flex-1 text-sm min-w-0 truncate ${isCompleted ? 'line-through text-text-sec' : onHold ? 'text-text-sec italic' : 'text-white'}`}>
          {task.title}
        </span>
        {onHold && <Clock size={12} className="text-text-sec flex-shrink-0" />}
        {proj && (
          <span className="text-text-sec text-[11px] flex-shrink-0 max-w-[72px] truncate hidden xs:block">
            {proj.name}
          </span>
        )}
        {task.due_date && (
          <span className="text-text-sec text-[11px] flex-shrink-0">{fmtShort(new Date(task.due_date))}</span>
        )}
        {task.estimated_minutes != null && task.estimated_minutes > 0 && (
          <span className="bg-bg-card border border-border-card text-text-sec text-[10px] px-1.5 py-0.5 rounded flex-shrink-0">
            {fmtMins(task.estimated_minutes)}
          </span>
        )}
      </button>
    )
  }

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-text-sec text-sm">No tasks to display</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
      {Array.from(weekGroups.entries()).map(([key, wTasks]) => (
        <div key={key}>
          <div className="px-4 py-1.5 bg-bg-card border-y border-border-card sticky top-0 z-10">
            <span className="text-text-sec text-[11px] font-semibold uppercase tracking-wider">
              {weekRange(key)}
            </span>
          </div>
          {wTasks.map(renderRow)}
        </div>
      ))}
      {noDue.length > 0 && (
        <div>
          <div className="px-4 py-1.5 bg-bg-card border-y border-border-card sticky top-0 z-10">
            <span className="text-text-sec text-[11px] font-semibold uppercase tracking-wider">
              No due date
            </span>
          </div>
          {noDue.map(renderRow)}
        </div>
      )}
    </div>
  )
}

// ─── Main GanttChart ──────────────────────────────────────────────────────────
export function GanttChart({ tasks, projects }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline')

  return (
    <div className="flex flex-col w-full">
      {/* View toggle bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-card bg-bg-primary sticky top-0 z-10">
        <span className="text-text-sec text-[11px] uppercase tracking-wider font-semibold">
          {viewMode === 'timeline' ? 'Timeline' : 'List'}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('timeline')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'timeline' ? 'text-accent-yellow' : 'text-text-sec hover:text-white'}`}
            title="Timeline view"
            aria-label="Switch to timeline view"
          >
            <BarChart2 size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'text-accent-yellow' : 'text-text-sec hover:text-white'}`}
            title="List view"
            aria-label="Switch to list view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        <TimelineView tasks={tasks} projects={projects} />
      ) : (
        <ListView tasks={tasks} projects={projects} />
      )}
    </div>
  )
}
