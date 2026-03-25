import { AvatarImage } from '@/components/ui/AvatarImage'
import { PlannedTask } from '@/stores/sessionStore'
import { CalendarIcon } from '@heroicons/react/24/outline'
import { formatLocalSmart } from '@/lib/dates'

interface FocusTaskCardProps {
  task: PlannedTask
  onCheckmark?: () => void
  onClick?: () => void
  isLoading?: boolean
}

export function FocusTaskCard({ task, onCheckmark, onClick, isLoading }: FocusTaskCardProps) {
  const handleCardClick = () => {
    onClick?.()
  }

  const handleCheckmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onCheckmark?.()
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
    <div className="flex items-center gap-3 min-w-0 max-w-full">
      {/* Checkmark - Outside the card on the leading side */}
      <button
        onClick={handleCheckmarkClick}
        className="flex-shrink-0 w-6 h-6 rounded-none flex items-center justify-center transition-colors"
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-accent-pink border-t-transparent rounded-full animate-spin"></div>
        ) : task.done ? (
          <div className="w-6 h-6 rounded-none bg-accent-green flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-6 h-6 rounded-none border-2 border-border-card hover:border-accent-yellow transition-colors" />
        )}
      </button>

      {/* Task Card */}
      <div
        onClick={handleCardClick}
        className={`flex-1 min-w-0 bg-bg-card rounded-none px-4 py-3 flex items-center gap-3 border border-[#ffffff] cursor-pointer transition-colors hover:bg-bg-card-hover ${
          task.done ? 'bg-bg-card-done border-accent-green/30' : ''
        }`}
      >
        {/* Project Avatar or Solo Task Avatar */}
        {task.projectId && task.projectName ? (
          <AvatarImage
            src={task.projectAvatarUrl}
            fallbackType="project"
            fallbackLabel={task.projectName}
            fallbackColor={task.projectColor || '#F5C518'}
            projectId={task.projectId}
            size={40}
            className="flex-shrink-0 border-3 border-white"
          />
        ) : (
          <div className="w-10 h-10 rounded-none bg-accent-pink/20 flex items-center justify-center flex-shrink-0">
            <div className="w-6 h-6 rounded-full bg-accent-pink"></div>
          </div>
        )}

        {/* Center content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-white text-base font-semibold truncate">
            {task.title}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            {task.deadline ? (
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
                {task.projectName && (
                  <span className="text-text-sec text-sm truncate">
                    • {task.projectName}
                  </span>
                )}
              </>
            ) : (
              <p className="text-text-sec text-sm truncate">
                {task.projectName || task.milestoneTitle || 'Solo Task'}
                {task.priority && ' • High Priority'}
              </p>
            )}
          </div>
        </div>

        {/* Estimated Time */}
        {task.estimatedMinutes && (
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
