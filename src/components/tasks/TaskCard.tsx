import { AvatarImage } from '@/components/ui/AvatarImage'
import { ChevronDoubleUpIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { Pin } from 'lucide-react'
import { formatLocalSmart } from '@/lib/dates'

interface PlannedTask {
  taskId: string
  title: string
  projectId?: string
  projectName?: string
  projectColor?: string
  projectAvatarUrl?: string
  done?: boolean
  percentage?: number
  estimatedMinutes?: number
  scheduledMinutes?: number
  partial?: boolean
  priority?: boolean
  deadline?: string
  isPinned?: boolean
  isManual?: boolean
}

interface TaskCardProps {
  task: PlannedTask
  onClick?: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const handleCardClick = () => {
    onClick?.()
  }

  const isOverdue = (deadline: string | undefined): boolean => {
    if (!deadline) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(deadline)
    dueDate.setHours(0, 0, 0, 0)
    return dueDate < today
  }

  const taskIsOverdue = isOverdue(task.deadline)

  return (
    <div className="flex items-center gap-3 min-w-0">
      {/* Task Card */}
      <div
        onClick={handleCardClick}
        className={`flex-1 min-w-0 bg-bg-card rounded-none px-4 py-3 flex items-center gap-3 border border-[#ffffff] cursor-pointer transition-colors hover:bg-bg-card-hover ${
          task.done ? 'bg-bg-card-done border-accent-green/30' : ''
        }`}
      >
        {/* Avatar */}
        {task.projectId && (
          <AvatarImage
            src={task.projectAvatarUrl}
            fallbackType="project"
            fallbackLabel={task.projectName || 'Project'}
            fallbackColor={task.projectColor || '#F5C518'}
            projectId={task.projectId}
            size={40}
            className="flex-shrink-0 border-3 border-white"
          />
        )}

        {/* Center content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {(task.isPinned || task.isManual) && (
              <Pin className="w-4 h-4 text-accent-yellow flex-shrink-0 fill-accent-yellow" />
            )}
            {task.priority && (
              <ChevronDoubleUpIcon className="w-4 h-4 text-accent-yellow flex-shrink-0" />
            )}
            <h4 className="text-white text-base font-semibold truncate min-w-0">
              {task.title}
            </h4>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {task.deadline && (
              <>
                <CalendarIcon className={`w-3 h-3 flex-shrink-0 ${taskIsOverdue && !task.done ? 'text-red-500' : 'text-text-sec'}`} />
                <span className={`text-sm truncate ${taskIsOverdue && !task.done ? 'text-red-500 font-semibold' : 'text-text-sec'}`}>
                  {formatLocalSmart(task.deadline)}
                </span>
                {taskIsOverdue && !task.done && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded flex-shrink-0">
                    OVERDUE
                  </span>
                )}
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
