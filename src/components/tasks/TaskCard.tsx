import { AvatarImage } from '@/components/ui/AvatarImage'
import { ChevronDoubleUpIcon, CalendarIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { Pin } from 'lucide-react'
import { formatLocalSmart, parseDateLocal } from '@/lib/dates'

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
  isPartOfChain?: boolean
  chainPosition?: number
  dependsOnTaskId?: string | null
  isLocked?: boolean
}

interface TaskCardProps {
  task: PlannedTask
  onClick?: () => void
  xpReward?: number
}

export function TaskCard({ task, onClick, xpReward }: TaskCardProps) {
  // Debug: Log chain metadata for tasks
  if (task.isPartOfChain || task.isLocked) {
    console.log('[TaskCard] Chain task:', {
      title: task.title,
      isPartOfChain: task.isPartOfChain,
      chainPosition: task.chainPosition,
      isLocked: task.isLocked,
      dependsOnTaskId: task.dependsOnTaskId
    });
  }

  const handleCardClick = () => {
    onClick?.()
  }

  const isOverdue = (deadline: string | undefined): boolean => {
    if (!deadline) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = parseDateLocal(deadline)
    return dueDate < today
  }

  const isToday = (deadline: string | undefined): boolean => {
    if (!deadline) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = parseDateLocal(deadline)
    return dueDate.getTime() === today.getTime()
  }

  const taskIsOverdue = isOverdue(task.deadline)
  const taskIsToday = isToday(task.deadline)
  const isLocked = task.isLocked && !task.done

  return (
    <div className="flex items-center gap-3 min-w-0 relative">
      {/* Connection line for chain tasks */}
      {task.isPartOfChain && task.chainPosition && task.chainPosition > 0 && (
        <div className="absolute left-0 -top-3 w-px h-6 bg-gray-600" />
      )}
      
      {/* Task Card */}
      <div
        onClick={handleCardClick}
        style={{
          paddingLeft: task.isPartOfChain && task.chainPosition && task.chainPosition > 0 ? '28px' : '16px',
          opacity: isLocked ? 0.6 : 1,
        }}
        className={`flex-1 min-w-0 bg-bg-card rounded-none py-3 pr-4 flex items-center gap-3 border border-[#ffffff] cursor-pointer transition-all hover:bg-bg-card-hover relative overflow-hidden ${
          task.done ? 'bg-bg-card-done border-accent-green/30' : ''
        }`}
      >
        {/* Mission color accent */}
        {task.projectId && !task.done && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1"
            style={{ backgroundColor: task.projectColor || '#f5c518' }}
          />
        )}
        {/* Lock icon for locked tasks */}
        {isLocked && (
          <div className="absolute top-2 right-2">
            <LockClosedIcon className="w-4 h-4 text-gray-500" />
          </div>
        )}
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
            <h4 className={`text-base font-semibold truncate min-w-0 ${
              isLocked ? 'text-gray-400' : 'text-white'
            }`}>
              {task.title}
            </h4>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {task.deadline && (
              <>
                <CalendarIcon className={`w-3 h-3 flex-shrink-0 ${taskIsOverdue && !task.done ? 'text-red-500' : taskIsToday && !task.done ? 'text-blue-500' : 'text-text-sec'}`} />
                <span className={`text-sm truncate ${taskIsOverdue && !task.done ? 'text-red-500 font-semibold' : taskIsToday && !task.done ? 'text-blue-500 font-semibold' : 'text-text-sec'}`}>
                  {formatLocalSmart(task.deadline)}
                </span>
                {taskIsOverdue && !task.done && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded flex-shrink-0">
                    OVERDUE
                  </span>
                )}
                {!taskIsOverdue && taskIsToday && !task.done && (
                  <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs font-bold rounded flex-shrink-0">
                    TODAY
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

        {/* Estimated Minutes + XP reward */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1 px-2">
          {task.estimatedMinutes !== undefined && (
            <div className="text-text-sec text-sm font-medium">
              {task.partial && task.scheduledMinutes
                ? `${task.scheduledMinutes}min/${task.estimatedMinutes}min`
                : `${task.estimatedMinutes}min`
              }
            </div>
          )}
          {xpReward !== undefined && !task.done && (
            <span className="text-[10px] font-bold text-accent-yellow bg-accent-yellow/10 px-1.5 py-0.5 rounded">
              +{xpReward} XP
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
