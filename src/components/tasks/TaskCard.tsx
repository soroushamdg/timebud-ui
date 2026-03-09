import { getDiceBearUrl } from '@/lib/utils'

interface PlannedTask {
  taskId: string
  title: string
  projectId?: string
  projectName?: string
  projectColor?: string
  done?: boolean
  percentage?: number
  estimatedMinutes?: number
}

interface TaskCardProps {
  task: PlannedTask
  onCheckmark?: () => void
  onClick?: () => void
}

export function TaskCard({ task, onCheckmark, onClick }: TaskCardProps) {
  const handleCardClick = () => {
    onClick?.()
  }

  const handleCheckmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onCheckmark?.()
  }

  return (
    <div className="flex items-center gap-3">
      {/* Checkmark - Outside the card on the leading side */}
      <button
        onClick={handleCheckmarkClick}
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
      >
        {task.done ? (
          <div className="w-6 h-6 rounded-full bg-accent-green flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-border-card hover:border-accent-yellow transition-colors" />
        )}
      </button>

      {/* Task Card */}
      <div
        onClick={handleCardClick}
        className={`flex-1 bg-bg-card rounded-2xl px-4 py-3 flex items-center gap-3 border border-border-card cursor-pointer transition-colors hover:bg-bg-card-hover ${
          task.done ? 'bg-bg-card-done border-accent-green/30' : ''
        }`}
      >
        {/* Avatar */}
        {task.projectId && (
          <img
            src={getDiceBearUrl(task.projectId, task.projectColor || '#F5C518')}
            alt={task.projectName || 'Project'}
            className="w-10 h-10 rounded-xl flex-shrink-0"
          />
        )}

        {/* Center content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-white text-base font-semibold truncate">
            {task.title}
          </h4>
          {task.projectName && (
            <p className="text-text-sec text-sm truncate">
              {task.projectName}
              {task.percentage !== undefined && ` (${task.percentage}% done)`}
            </p>
          )}
        </div>

        {/* Estimated Minutes */}
        {task.estimatedMinutes !== undefined && (
          <div className="flex-shrink-0 text-text-sec text-sm font-medium px-2">
            {task.estimatedMinutes}min
          </div>
        )}
      </div>
    </div>
  )
}
