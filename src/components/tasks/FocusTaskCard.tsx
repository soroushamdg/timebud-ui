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
    <div
      onClick={handleCardClick}
      className={`bg-bg-card rounded-2xl px-4 py-3 flex items-center gap-3 border border-border-card cursor-pointer transition-colors hover:bg-bg-card-hover ${
        task.done ? 'bg-bg-card-done border-accent-green/30' : ''
      }`}
    >
      {/* Avatar placeholder - since we don't have project info in PlannedTask */}
      <div className="w-10 h-10 rounded-xl bg-accent-pink/20 flex items-center justify-center flex-shrink-0">
        <div className="w-6 h-6 rounded-full bg-accent-pink"></div>
      </div>

      {/* Center content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-white text-base font-semibold truncate">
          {task.title}
        </h4>
        <p className="text-text-sec text-sm truncate">
          {task.milestoneTitle || 'Solo Task'}
          {task.priority && ' • High Priority'}
        </p>
      </div>

      {/* Checkmark */}
      <button
        onClick={handleCheckmarkClick}
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-accent-pink border-t-transparent rounded-full animate-spin"></div>
        ) : task.done ? (
          <div className="w-6 h-6 rounded-full bg-accent-green flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-border-card hover:border-accent-yellow transition-colors" />
        )}
      </button>
    </div>
  )
}
