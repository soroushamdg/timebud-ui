import { useState } from "react";
import { AvatarImage } from "@/components/ui/AvatarImage";
import { PlannedTask } from "@/stores/sessionStore";
import { CalendarIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { formatLocalSmart, parseDateLocal } from "@/lib/dates";

interface FocusTaskCardProps {
  task: PlannedTask;
  onCheckmark?: () => void;
  onClick?: () => void;
  onHold?: () => void;
  isLoading?: boolean;
  xpReward?: number;
}

export function FocusTaskCard({
  task,
  onCheckmark,
  onClick,
  onHold,
  isLoading,
  xpReward,
}: FocusTaskCardProps) {
  // Debug: Log chain metadata for tasks
  if (task.isPartOfChain || task.isLocked) {
    console.log('[FocusTaskCard] Chain task:', {
      title: task.title,
      isPartOfChain: task.isPartOfChain,
      chainPosition: task.chainPosition,
      isLocked: task.isLocked,
      dependsOnTaskId: task.dependsOnTaskId
    });
  }

  const [holdTimeout, setHoldTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showPartialOption, setShowPartialOption] = useState(false);

  const handleCardClick = () => {
    onClick?.();
  };

  const handleCheckmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCheckmark?.();
  };

  const handleMouseDown = () => {
    // Only show partial option for non-partial tasks that aren't done
    if (!task.partial && !task.done && onHold) {
      const timeout = setTimeout(() => {
        setShowPartialOption(true);
      }, 500); // 500ms hold time
      setHoldTimeout(timeout);
    }
  };

  const handleMouseUp = () => {
    if (holdTimeout) {
      clearTimeout(holdTimeout);
      setHoldTimeout(null);
    }
  };

  const handleTouchStart = () => {
    // Only show partial option for non-partial tasks that aren't done
    if (!task.partial && !task.done && onHold) {
      const timeout = setTimeout(() => {
        setShowPartialOption(true);
      }, 500); // 500ms hold time
      setHoldTimeout(timeout);
    }
  };

  const handleTouchEnd = () => {
    if (holdTimeout) {
      clearTimeout(holdTimeout);
      setHoldTimeout(null);
    }
  };

  const handlePartialOptionClick = () => {
    setShowPartialOption(false);
    onHold?.();
  };

  const isOverdue = (deadline: string | undefined): boolean => {
    if (!deadline) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = parseDateLocal(deadline);
    return dueDate < today;
  };

  const isToday = (deadline: string | undefined): boolean => {
    if (!deadline) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = parseDateLocal(deadline);
    return dueDate.getTime() === today.getTime();
  };

  const taskIsOverdue = isOverdue(task.deadline);
  const taskIsToday = isToday(task.deadline);

  const isLocked = task.isLocked && !task.done;

  return (
    <div className="flex items-center gap-3 min-w-0 max-w-full relative">
      {/* Connection line for chain tasks */}
      {task.isPartOfChain && task.chainPosition && task.chainPosition > 0 && (
        <div className="absolute left-3 -top-3 w-px h-6 bg-gray-600" />
      )}
      
      {/* Checkmark - Outside the card on the leading side */}
      <button
        onClick={handleCheckmarkClick}
        className="flex-shrink-0 w-6 h-6 rounded-none flex items-center justify-center transition-colors"
        disabled={isLoading || isLocked}
        title={isLocked ? "Complete the previous job first" : undefined}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-accent-pink border-t-transparent rounded-full animate-spin"></div>
        ) : task.done ? (
          <div className="w-6 h-6 rounded-none bg-accent-green flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        ) : (
          <div className={`w-6 h-6 rounded-none border-2 transition-colors ${
            isLocked 
              ? "border-gray-600 cursor-not-allowed" 
              : "border-border-card hover:border-accent-yellow cursor-pointer"
          }`} />
        )}
      </button>

      {/* Task Card */}
      <div
        onClick={handleCardClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          paddingLeft: task.isPartOfChain && task.chainPosition && task.chainPosition > 0 ? '28px' : '16px',
          opacity: isLocked ? 0.6 : 1,
        }}
        className={`flex-1 min-w-0 bg-bg-card rounded-none py-3 pr-4 flex items-center gap-3 border border-[#ffffff] cursor-pointer transition-all hover:bg-bg-card-hover relative overflow-hidden ${
          task.done ? "bg-bg-card-done border-accent-green/30" : ""
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
        {/* Project Avatar or Solo Task Avatar */}
        {task.projectId && task.projectName ? (
          <AvatarImage
            src={task.projectAvatarUrl}
            fallbackType="project"
            fallbackLabel={task.projectName}
            fallbackColor={task.projectColor || "#F5C518"}
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
          <h4 className={`text-base font-semibold truncate ${
            isLocked ? "text-gray-400" : "text-white"
          }`}>
            {task.title}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            {task.deadline ? (
              <>
                <CalendarIcon
                  className={`w-3 h-3 flex-shrink-0 ${
                    taskIsOverdue && !task.done
                      ? "text-red-500"
                      : taskIsToday && !task.done
                      ? "text-blue-500"
                      : "text-text-sec"
                  }`}
                />
                <span
                  className={`text-sm truncate ${
                    taskIsOverdue && !task.done
                      ? "text-red-500 font-semibold"
                      : taskIsToday && !task.done
                      ? "text-blue-500 font-semibold"
                      : "text-text-sec"
                  }`}
                >
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
                {task.projectName && (
                  <span className="text-text-sec text-sm truncate">
                    • {task.projectName}
                  </span>
                )}
              </>
            ) : (
              <p className="text-text-sec text-sm truncate">
                {task.projectName || task.milestoneTitle || "Solo Job"}
                {task.priority && " • High Priority"}
              </p>
            )}
          </div>
        </div>

        {/* Estimated Time + XP reward */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1 px-2">
          {task.estimatedMinutes && (
            <div className="text-text-sec text-sm font-medium">
              {task.partial && task.scheduledMinutes
                ? `${task.scheduledMinutes}min/${task.estimatedMinutes}min`
                : `${task.estimatedMinutes}min`}
            </div>
          )}
          {xpReward !== undefined && !task.done && (
            <span className="text-[10px] font-bold text-accent-yellow bg-accent-yellow/10 px-1.5 py-0.5 rounded">
              +{xpReward} XP
            </span>
          )}
        </div>

        {/* Partial completion option overlay */}
        {showPartialOption && !task.partial && !task.done && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-none">
            <button
              onClick={handlePartialOptionClick}
              className="px-4 py-2 bg-accent-pink text-white font-bold rounded-lg hover:bg-accent-pink/90 transition-colors"
            >
              Mark as done partially
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
