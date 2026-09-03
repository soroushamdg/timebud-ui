'use client'

import { SessionPlan } from '@/types/ai'
import { Clock, Zap } from 'lucide-react'
import { AvatarImage } from '@/components/ui/AvatarImage'

interface SessionPlanPreviewProps {
  plan: SessionPlan
  onStartSession: () => void
  onAdjustTime: () => void
}

export function SessionPlanPreview({
  plan,
  onStartSession,
  onAdjustTime,
}: SessionPlanPreviewProps) {
  return (
    <div className="mt-4 border border-border-card rounded-lg p-4 bg-bg-primary">
      {/* Summary stats */}
      <div className="flex gap-4 mb-4 pb-4 border-b border-border-card">
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-text-primary">{plan.budgetMinutes}m</div>
          <div className="text-xs text-text-sec">Budget</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-accent-yellow">{plan.totalUsedMinutes}m</div>
          <div className="text-xs text-text-sec">Planned</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-text-sec">{plan.slackMinutes}m</div>
          <div className="text-xs text-text-sec">Slack</div>
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2 mb-4">
        {plan.tasks.map((task, idx) => (
          <div
            key={task.taskId}
            className="bg-bg-card rounded-lg p-3 border border-border-card"
          >
            <div className="flex items-start gap-3">
              {/* Project avatar */}
              {task.projectId && (
                <AvatarImage
                  src={task.projectAvatarUrl}
                  fallbackType="project"
                  fallbackSeed={task.projectName || ''}
                  size={32}
                  className="flex-shrink-0"
                />
              )}
              
              <div className="flex-1 min-w-0">
                {/* Task title */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-text-primary font-medium truncate">
                    {task.title}
                  </span>
                  {task.priority && (
                    <span className="text-xs bg-accent-pink/20 text-accent-pink px-2 py-0.5 rounded flex-shrink-0">
                      Priority
                    </span>
                  )}
                  {task.partial && (
                    <span className="text-xs bg-accent-yellow/20 text-accent-yellow px-2 py-0.5 rounded flex-shrink-0">
                      Partial
                    </span>
                  )}
                </div>

                {/* Project name */}
                {task.projectName && (
                  <div className="text-xs text-text-sec mb-1">
                    {task.projectName}
                  </div>
                )}

                {/* Time and reasoning */}
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 text-text-sec">
                    <Clock className="w-3 h-3" />
                    <span>{task.scheduledMinutes}min</span>
                  </div>
                  <div className="text-text-sec truncate">
                    {task.reasoning}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onStartSession}
          className="flex-1 bg-accent-yellow text-on-light-accent font-bold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Start Focus Session
        </button>
        <button
          onClick={onAdjustTime}
          className="bg-bg-card border border-border-card text-text-primary font-semibold py-3 px-4 rounded-lg hover:bg-bg-card-hover transition-colors"
        >
          Change Time
        </button>
      </div>
    </div>
  )
}
