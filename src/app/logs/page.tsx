'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useSessions } from '@/hooks/useSessions'
import { createClient } from '@/lib/supabase/client'
import { formatLocal, formatLocalTime, formatDuration } from '@/lib/dates'
import { Skeleton } from '@/components/ui/Skeleton'
import { Calendar } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { DbTask } from '@/types/database'

export default function LogsPage() {
  const { data: sessions, isLoading: sessionsLoading } = useSessions()

  // Collect all task IDs from all sessions
  const allTaskIds = sessions?.flatMap(session => session.tasks_list) || []
  const uniqueTaskIds = Array.from(new Set(allTaskIds))

  // Batch fetch all task titles
  const { data: tasks } = useQuery({
    queryKey: ['tasks', 'batch', uniqueTaskIds],
    queryFn: async (): Promise<{ id: string; title: string }[]> => {
      if (uniqueTaskIds.length === 0) return []
      
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title')
        .in('id', uniqueTaskIds)
      
      if (error) throw error
      return data || []
    },
    enabled: uniqueTaskIds.length > 0,
  })

  // Build task title map
  const taskTitleMap = new Map(
    tasks?.map(task => [task.id, task.title]) || []
  )

  if (sessionsLoading) {
    return (
      <AppShell>
        <div className="px-4 pt-6 pb-2">
          <h1 className="text-2xl font-bold text-white">Logs</h1>
        </div>
        <Skeleton className="h-28 rounded-2xl mx-4 mb-3" />
        <Skeleton className="h-28 rounded-2xl mx-4 mb-3" />
        <Skeleton className="h-28 rounded-2xl mx-4 mb-3" />
      </AppShell>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <AppShell>
        <div className="px-4 pt-6 pb-2">
          <h1 className="text-2xl font-bold text-white">Logs</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <Calendar className="w-16 h-16 text-text-sec mb-4" />
          <p className="text-text-sec text-center">No sessions yet.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-white">Logs</h1>
      </div>
      
      <div className="space-y-3">
        {sessions.map((session) => {
          const duration = session.end_time 
            ? formatDuration(session.start_time!, session.end_time)
            : 'In progress'
          
          const timeRange = session.end_time
            ? `${formatLocalTime(session.start_time!)} – ${formatLocalTime(session.end_time)}`
            : `${formatLocalTime(session.start_time!)} – In progress`

          return (
            <div
              key={session.id}
              className="bg-bg-card rounded-2xl p-4 mx-4 mb-3 border border-border-card"
            >
              {/* Top section */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-semibold">
                  {formatLocal(session.start_time!, 'EEE MMM d')}
                </span>
                <span className="text-text-sec">
                  {duration}
                </span>
              </div>

              {/* Time range */}
              <div className="text-text-sec text-sm mb-1">
                {timeRange}
              </div>

              {/* Budget */}
              <div className="text-text-sec text-xs mb-3">
                {session.budget_minutes} min planned
              </div>

              {/* Task tags */}
              {session.tasks_list.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {session.tasks_list.map((taskId) => {
                    const taskTitle = taskTitleMap.get(taskId)
                    return taskTitle ? (
                      <span
                        key={taskId}
                        className="text-text-sec text-xs bg-black border border-border-card px-2 py-1 rounded"
                      >
                        {taskTitle}
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
