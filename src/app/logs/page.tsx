'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { useSessionsWithLogs } from '@/hooks/useSessions'
import { useProjects } from '@/hooks/useProjects'
import { DbFocusSession, DbSessionTaskLog, MissionDifficulty } from '@/types/database'
import { CheckCircle2, Clock, SkipForward, ChevronDown, ChevronUp, CalendarDays, BarChart2 } from 'lucide-react'
import { getJobXpPreview } from '@/lib/gamification/xp'

const getWeekStart = (): Date => {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon ...
  const diff = day === 0 ? -6 : 1 - day // shift to Monday
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + diff)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

const formatDuration = (start: string | null, end: string | null): string => {
  if (!start || !end) return '—'
  const minutes = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000,
  )
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${minutes}m`
}

const formatSessionDate = (start: string | null): string => {
  if (!start) return '—'
  return new Date(start).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

const formatSessionTime = (start: string | null): string => {
  if (!start) return ''
  return new Date(start).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatStatTime = (minutes: number): string => {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${minutes}m`
}

function TimeDelta({ actual, scheduled }: { actual: number; scheduled: number }) {
  const delta = actual - scheduled
  if (!scheduled || delta === 0) return null
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
        delta < 0 ? 'bg-accent-green/15 text-accent-green' : 'bg-status-negative/15 text-status-negative-text'
      }`}
    >
      {delta > 0 ? '+' : ''}
      {delta}m
    </span>
  )
}

interface SessionCardProps {
  session: DbFocusSession
  taskLogs: DbSessionTaskLog[]
  getDifficulty: (projectId: string | null) => MissionDifficulty
}

function SessionCard({ session, taskLogs, getDifficulty }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false)

  const completed = taskLogs.filter(l => l.outcome === 'completed')
  const partial = taskLogs.filter(l => l.outcome === 'partial')
  const skipped = taskLogs.filter(l => l.outcome === 'skipped')
  const isLegacy = taskLogs.length === 0

  const doneCount = completed.length + partial.length
  const totalCount = isLegacy
    ? (session.tasks_list?.length ?? 0)
    : taskLogs.length
  // Only 'completed' outcomes correspond to a real tasks.status -> 'completed'
  // transition — 'partial' logs never flip DB status, so the tasks_award_xp trigger
  // never fires for them (mirrors the same distinction the trigger itself makes).
  const sessionXp = completed.reduce((sum, l) => sum + getJobXpPreview(getDifficulty(l.project_id)), 0)

  return (
    <div className="bg-tab-bg rounded-xl border border-secondary-surface overflow-hidden">
      <button
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex flex-col">
          <span className="text-text-primary text-sm font-medium">
            {formatSessionDate(session.start_time)}
          </span>
          <span className="text-text-tertiary text-xs mt-0.5">
            {formatSessionTime(session.start_time)}
            {' · '}
            {formatDuration(session.start_time, session.end_time)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isLegacy ? (
            <span className="text-text-muted text-xs bg-bg-card border border-border-card px-2 py-0.5 rounded-full">
              Legacy
            </span>
          ) : (
            <>
              <span className="text-text-sec text-xs">
                {doneCount}/{totalCount} jobs
              </span>
              {sessionXp > 0 && (
                <span className="text-[10px] font-bold text-accent-yellow bg-accent-yellow/10 px-1.5 py-0.5 rounded">
                  +{sessionXp} XP
                </span>
              )}
            </>
          )}
          {expanded ? (
            <ChevronUp size={16} className="text-text-muted" />
          ) : (
            <ChevronDown size={16} className="text-text-muted" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-bg-card-hover pt-3 space-y-4">
          {isLegacy ? (
            <p className="text-text-tertiary text-xs">
              {session.tasks_list?.length ?? 0} job
              {(session.tasks_list?.length ?? 0) !== 1 ? 's' : ''} in this
              run
            </p>
          ) : (
            <>
              {completed.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle2 size={13} className="text-accent-green" />
                    <span className="text-accent-green text-[11px] font-semibold uppercase tracking-wider">
                      Completed
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {completed.map(log => {
                      const actual = log.actual_minutes ?? log.scheduled_minutes
                      return (
                        <div
                          key={log.id}
                          className="flex items-center justify-between"
                        >
                          <div className="flex flex-col min-w-0 flex-1 mr-3">
                            <span className="text-text-primary text-sm truncate">
                              {log.task_title}
                            </span>
                            {log.project_name && (
                              <span className="text-text-tertiary text-xs truncate">
                                {log.project_name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-text-sec text-xs whitespace-nowrap">
                              {actual} min
                            </span>
                            <TimeDelta actual={actual} scheduled={log.scheduled_minutes} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {partial.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock size={13} className="text-status-onhold-text" />
                    <span className="text-status-onhold-text text-[11px] font-semibold uppercase tracking-wider">
                      Partial
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {partial.map(log => {
                      const actual = log.actual_minutes ?? log.scheduled_minutes
                      return (
                        <div
                          key={log.id}
                          className="flex items-center justify-between"
                        >
                          <div className="flex flex-col min-w-0 flex-1 mr-3">
                            <span className="text-text-primary text-sm truncate">
                              {log.task_title}
                            </span>
                            {log.project_name && (
                              <span className="text-text-tertiary text-xs truncate">
                                {log.project_name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-text-sec text-xs whitespace-nowrap">
                              {actual} / {log.scheduled_minutes} min
                            </span>
                            <TimeDelta actual={actual} scheduled={log.scheduled_minutes} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {skipped.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <SkipForward size={13} className="text-text-muted" />
                    <span className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">
                      Skipped
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {skipped.map(log => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex flex-col min-w-0 flex-1 mr-3">
                          <span className="text-text-sec text-sm truncate">
                            {log.task_title}
                          </span>
                          {log.project_name && (
                            <span className="text-text-muted text-xs truncate">
                              {log.project_name}
                            </span>
                          )}
                        </div>
                        <span className="text-text-muted text-xs whitespace-nowrap">
                          {log.scheduled_minutes} min
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function LogsPage() {
  const { data, isLoading } = useSessionsWithLogs()
  const { data: projects } = useProjects()
  const sessions = data?.sessions ?? []
  const taskLogsBySessionId = data?.taskLogsBySessionId ?? new Map<string, DbSessionTaskLog[]>()

  const getDifficulty = (projectId: string | null): MissionDifficulty =>
    (projectId ? projects?.find(p => p.id === projectId)?.difficulty : undefined) || 'medium'

  const weekStart = getWeekStart()

  const thisWeekSessions = sessions.filter(
    s => s.start_time && new Date(s.start_time) >= weekStart,
  )

  const focusMinutesThisWeek = thisWeekSessions
    .filter(s => s.start_time && s.end_time)
    .reduce((sum, s) => {
      return (
        sum +
        Math.round(
          (new Date(s.end_time!).getTime() -
            new Date(s.start_time!).getTime()) /
            60000,
        )
      )
    }, 0)

  const jobsCompletedThisWeek = thisWeekSessions.reduce((sum, s) => {
    const logs = taskLogsBySessionId.get(s.id) ?? []
    return sum + logs.filter((l: DbSessionTaskLog) => l.outcome === 'completed').length
  }, 0)

  const xpEarnedThisWeek = thisWeekSessions.reduce((sum, s) => {
    const logs = taskLogsBySessionId.get(s.id) ?? []
    return (
      sum +
      logs
        .filter((l: DbSessionTaskLog) => l.outcome === 'completed')
        .reduce((logSum, l) => logSum + getJobXpPreview(getDifficulty(l.project_id)), 0)
    )
  }, 0)

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-5rem)] pb-5 bg-bg-primary">
        {/* Header */}
        <div className="flex-shrink-0 bg-tab-bg border-b border-border-card px-4 py-3 flex items-center justify-between">
          <h1 className="text-text-primary text-lg font-semibold">Run History</h1>
          <Link
            href="/gantt"
            className="p-1.5 rounded-lg text-text-sec hover:text-accent-yellow transition-colors"
            title="View Timeline"
            aria-label="View Timeline"
          >
            <BarChart2 size={20} />
          </Link>
        </div>

        {/* Stats strip */}
        <div className="flex-shrink-0 grid grid-cols-4 divide-x divide-secondary-surface border-b border-secondary-surface">
          <div className="bg-bg-inset px-3 py-3 flex flex-col items-center">
            <span className="text-text-primary text-xl font-bold">
              {thisWeekSessions.length}
            </span>
            <span className="text-text-muted text-[11px] text-center mt-0.5">
              runs
            </span>
          </div>
          <div className="bg-bg-inset px-3 py-3 flex flex-col items-center">
            <span className="text-text-primary text-xl font-bold">
              {focusMinutesThisWeek > 0
                ? formatStatTime(focusMinutesThisWeek)
                : '—'}
            </span>
            <span className="text-text-muted text-[11px] text-center mt-0.5">
              focused
            </span>
          </div>
          <div className="bg-bg-inset px-3 py-3 flex flex-col items-center">
            <span className="text-accent-green text-xl font-bold">
              {jobsCompletedThisWeek}
            </span>
            <span className="text-text-muted text-[11px] text-center mt-0.5">
              jobs done
            </span>
          </div>
          <div className="bg-bg-inset px-3 py-3 flex flex-col items-center">
            <span className="text-accent-yellow text-xl font-bold">
              {xpEarnedThisWeek}
            </span>
            <span className="text-text-muted text-[11px] text-center mt-0.5">
              XP earned
            </span>
          </div>
        </div>

        {/* Week label */}
        <div className="flex-shrink-0 px-4 py-2 flex items-center gap-1.5">
          <CalendarDays size={11} className="text-text-faint" />
          <span className="text-text-faint text-[11px]">This week</span>
        </div>

        {/* Session list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-text-muted text-sm">Loading...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-14 h-14 bg-tab-bg rounded-full flex items-center justify-center mb-3">
                <CalendarDays size={22} className="text-border-card" />
              </div>
              <p className="text-text-primary text-base font-medium mb-1">
                No runs yet
              </p>
              <p className="text-text-muted text-sm text-center">
                Your completed runs will appear here.
              </p>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-2 pb-6">
              {sessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  taskLogs={taskLogsBySessionId.get(session.id) ?? []}
                  getDifficulty={getDifficulty}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
