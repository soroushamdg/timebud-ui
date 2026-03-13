import { AvatarImage } from '@/components/ui/AvatarImage'
import { ChevronDoubleUpIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { formatLocalSmart } from '@/lib/dates'

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
  priority?: boolean
  deadline?: string
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
          <AvatarImage
            src={undefined}
            fallbackType="project"
            fallbackLabel={task.projectName || 'Project'}
            fallbackColor={task.projectColor || '#F5C518'}
            size={40}
            className="flex-shrink-0"
          />
        )}

        {/* Center content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {task.priority && (
              <ChevronDoubleUpIcon className="w-4 h-4 text-accent-yellow flex-shrink-0" />
            )}
            <h4 className="text-white text-base font-semibold truncate">
              {task.title}
            </h4>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {task.deadline && (
              <>
                <CalendarIcon className="w-3 h-3 text-text-sec flex-shrink-0" />
                <span className="text-text-sec text-sm truncate">
                  {formatLocalSmart(task.deadline)}
                </span>
              </>
            )}
            {task.projectName && !task.deadline && (
              <p className="text-text-sec text-sm truncate">
                {task.projectName}
                {task.percentage !== undefined && ` (${task.percentage}% done)`}
              </p>
            )}
            {task.projectName && task.deadline && (
              <span className="text-text-sec text-sm truncate">
                • {task.projectName}
                {task.percentage !== undefined && ` (${task.percentage}% done)`}
              </span>
            )}
          </div>
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
