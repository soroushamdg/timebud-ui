import { getDiceBearUrl } from '@/lib/utils'
import { PlannedTask } from '@/stores/sessionStore'

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

  return (
    <div className="flex items-center gap-3">
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
        className={`flex-1 bg-bg-card rounded-none px-4 py-3 flex items-center gap-3 border border-[#ffffff] cursor-pointer transition-colors hover:bg-bg-card-hover ${
          task.done ? 'bg-bg-card-done border-accent-green/30' : ''
        }`}
      >
        {/* Project Avatar or Solo Task Avatar */}
        {task.projectId && task.projectName ? (
          <img
            src={getDiceBearUrl(task.projectId, task.projectColor || '#F5C518')}
            alt={task.projectName}
            className="w-10 h-10 rounded-none flex-shrink-0"
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
          <p className="text-text-sec text-sm truncate">
            {task.projectName || task.milestoneTitle || 'Solo Task'}
            {task.priority && ' • High Priority'}
          </p>
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
