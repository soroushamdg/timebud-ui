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
  scheduledMinutes?: number
  partial?: boolean
}

interface TaskCardProps {
  task: PlannedTask
  onClick?: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const handleCardClick = () => {
    onClick?.()
  }

  return (
    <div className="flex items-center gap-3">
      {/* Task Card */}
      <div
        onClick={handleCardClick}
        className={`flex-1 bg-bg-card rounded-none px-4 py-3 flex items-center gap-3 border border-[#ffffff] cursor-pointer transition-colors hover:bg-bg-card-hover ${
          task.done ? 'bg-bg-card-done border-accent-green/30' : ''
        }`}
      >
        {/* Avatar */}
        {task.projectId && (
          <img
            src={getDiceBearUrl(task.projectId, task.projectColor || '#F5C518')}
            alt={task.projectName || 'Project'}
            className="w-10 h-10 rounded-none flex-shrink-0"
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
            {task.partial && task.scheduledMinutes 
              ? `${task.scheduledMinutes}min/${task.estimatedMinutes}min`
              : `${task.estimatedMinutes}min`
            }
          </div>
        )}
      </div>
    </div>
  )
}
