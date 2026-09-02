import { useRef, useState } from "react";
import { AvatarImage } from "@/components/ui/AvatarImage";
import { PlannedTask } from "@/stores/sessionStore";
import { CalendarIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { formatLocalSmart, parseDateLocal } from "@/lib/dates";
import { RecurringBadge } from "@/components/tasks/RecurringBadge";

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
  // A hold fires onHold directly from the timer callback — no nested confirm button
  // inside the card's own onClick subtree (that used to bubble a click back up into
  // handleCardClick, opening the overview dialog on top of the partial-completion one).
  // longPressFiredRef swallows the native synthetic click that both touch and mouse
  // dispatch right after a press-and-release, which would otherwise reach
  // handleCardClick a second way even without any nested button involved.
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressFiredRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  const HOLD_MS = 500;
  const MOVE_CANCEL_PX = 10;

  const clearHoldTimer = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    setIsPressing(false);
  };

  const startHoldTimer = (x: number, y: number) => {
    // Only offer "mark partial" for non-partial tasks that aren't done
    if (task.partial || task.done || !onHold) return;
    startPosRef.current = { x, y };
    setIsPressing(true);
    holdTimeoutRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setIsPressing(false);
      onHold?.();
    }, HOLD_MS);
  };

  const handleCardClick = () => {
    if (longPressFiredRef.current) {
      // Swallow the click that follows a completed long-press.
      longPressFiredRef.current = false;
      return;
    }
    onClick?.();
  };

  const handleCheckmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCheckmark?.();
  };

  const handleMouseDown = (e: React.MouseEvent) => startHoldTimer(e.clientX, e.clientY);
  const handleMouseUp = clearHoldTimer;

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) startHoldTimer(touch.clientX, touch.clientY);
  };
  const handleTouchEnd = clearHoldTimer;

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startPosRef.current || !holdTimeoutRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - startPosRef.current.x);
    const dy = Math.abs(touch.clientY - startPosRef.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
      clearHoldTimer();
    }
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
        onTouchMove={handleTouchMove}
        style={{
          paddingLeft: task.isPartOfChain && task.chainPosition && task.chainPosition > 0 ? '28px' : '16px',
          opacity: isLocked ? 0.6 : 1,
        }}
        className={`flex-1 min-w-0 bg-bg-card rounded-2xl py-3 pr-4 flex items-center gap-3 border border-[#ffffff] cursor-pointer transition-all hover:bg-bg-card-hover relative overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.35)] ${
          task.done ? "bg-bg-card-done border-accent-green/30" : ""
        } ${isPressing ? "scale-[0.98] brightness-90" : ""}`}
      >
        {/* Mission color accent */}
        {task.projectId && !task.done && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5"
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
          <div className="flex items-center gap-2 min-w-0">
            <h4 className={`text-base font-semibold truncate min-w-0 ${
              isLocked ? "text-gray-400" : "text-white"
            }`}>
              {task.title}
            </h4>
            {task.recurrenceType && (
              <RecurringBadge
                task={{
                  recurrence_type: task.recurrenceType,
                  recurrence_days: task.recurrenceDays ?? null,
                  recurrence_interval: task.recurrenceInterval ?? null,
                }}
                iconOnly
              />
            )}
          </div>
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
            <span className="text-[10px] font-bold text-black bg-accent-yellow px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(245,197,24,0.45)]">
              +{xpReward} XP
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
