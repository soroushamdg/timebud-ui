'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { GanttChart } from '@/components/gantt/GanttChart'
import { useProjects } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'

export default function GanttPage() {
  const router = useRouter()
  const { data: projects = [], isLoading: projectsLoading } = useProjects()
  const { data: allTasks = [], isLoading: tasksLoading } = useTasks()

  const isLoading = projectsLoading || tasksLoading

  const tasks = allTasks

  return (
    <AppShell>
      <div className="flex flex-col min-h-screen bg-bg-primary">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-card bg-bg-primary sticky top-0 z-20">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-lg bg-bg-card border border-border-card flex items-center justify-center text-white hover:bg-bg-card-hover transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-white text-lg font-semibold">Timeline</h1>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-text-sec text-sm">Loading…</p>
          </div>
        ) : projects.length === 0 && tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-12 h-12 bg-bg-card border border-border-card rounded-full flex items-center justify-center mb-4">
              <span className="text-accent-yellow text-xl">◆</span>
            </div>
            <p className="text-white text-base font-medium mb-1">No tasks yet</p>
            <p className="text-text-sec text-sm text-center">
              Add tasks with due dates to see them on the timeline.
            </p>
          </div>
        ) : (
          <GanttChart tasks={tasks} projects={projects} />
        )}
      </div>
    </AppShell>
  )
}
