"use client";

import { useState } from "react";
import { AvatarImage } from '@/components/ui/AvatarImage';
import { ChevronDoubleUpIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { formatLocalSmart, parseDateLocal } from '@/lib/dates';
import { Check, X, MoreVertical, Trash2, Edit } from 'lucide-react';
import { DbTask, MissionDifficulty } from '@/types/database';
import { getJobXpPreview } from '@/lib/gamification/xp';

interface AllTasksTaskCardProps {
  task: DbTask;
  projectName?: string;
  projectColor?: string;
  projectAvatarUrl?: string;
  projectDifficulty?: MissionDifficulty;
  onUpdateTask: (id: string, updates: Partial<DbTask>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onEditTask: (task: DbTask) => void;
  onSingleClick: (task: DbTask) => void;
  onDoubleClick: (task: DbTask) => void;
}

export function AllTasksTaskCard({
  task,
  projectName,
  projectColor,
  projectAvatarUrl,
  projectDifficulty,
  onUpdateTask,
  onDeleteTask,
  onEditTask,
  onSingleClick,
  onDoubleClick
}: AllTasksTaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleCheckboxChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    try {
      await onUpdateTask(task.id, {
        status: task.status === 'completed' ? 'pending' : 'completed'
      });
    } catch (error) {
      console.error('Failed to toggle task status:', error);
    }
  };

  const handleTogglePriority = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onUpdateTask(task.id, {
        priority: !task.priority
      });
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to toggle priority:', error);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onDeleteTask(task.id);
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditTask(task);
    setShowMenu(false);
  };

  const handleDoubleClick = () => {
    onDoubleClick(task);
  };

  const handleCardClick = () => {
    onSingleClick(task);
  };

  const isOverdue = (deadline: string | null | undefined): boolean => {
    if (!deadline) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = parseDateLocal(deadline);
    return dueDate < today;
  };

  const isToday = (deadline: string | null | undefined): boolean => {
    if (!deadline) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = parseDateLocal(deadline);
    return dueDate.getTime() === today.getTime();
  };

  const completed = task.status === 'completed';
  const taskIsOverdue = isOverdue(task.due_date);
  const taskIsToday = isToday(task.due_date);

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        onClick={handleCardClick}
        onDoubleClick={handleDoubleClick}
        className={`flex-1 min-w-0 bg-bg-card rounded-2xl px-4 py-3 flex items-center gap-3 border border-[#ffffff] cursor-pointer transition-all hover:bg-bg-card-hover min-h-[72px] relative shadow-[0_4px_16px_rgba(0,0,0,0.35)] ${
          completed ? 'bg-bg-card-done border-accent-green/30' : ''
        }`}
      >
        {/* Mission color accent */}
        {task.project_id && !completed && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
            style={{ backgroundColor: projectColor || '#f5c518' }}
          />
        )}
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={completed}
          onChange={handleCheckboxChange}
          className="w-6 h-6 rounded-md flex-shrink-0 accent-[#FFD233] cursor-pointer"
        />

        {/* Avatar */}
        {task.project_id && (
          <AvatarImage
            src={projectAvatarUrl}
            fallbackType="project"
            fallbackLabel={projectName || 'Project'}
            fallbackColor={projectColor || '#F5C518'}
            projectId={task.project_id}
            size={40}
            className="flex-shrink-0"
          />
        )}

        {/* Center content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {task.priority && (
              <ChevronDoubleUpIcon className="w-4 h-4 text-accent-yellow flex-shrink-0" />
            )}
            <h4 className="text-white text-base font-semibold truncate min-w-0">
              {task.title}
            </h4>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {task.due_date && (
              <>
                <CalendarIcon className={`w-3 h-3 flex-shrink-0 ${taskIsOverdue && !completed ? 'text-red-500' : taskIsToday && !completed ? 'text-blue-500' : 'text-text-sec'}`} />
                <span className={`text-sm truncate ${taskIsOverdue && !completed ? 'text-red-500 font-semibold' : taskIsToday && !completed ? 'text-blue-500 font-semibold' : 'text-text-sec'}`}>
                  {formatLocalSmart(task.due_date)}
                </span>
                {taskIsOverdue && !completed && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded flex-shrink-0">
                    OVERDUE
                  </span>
                )}
                {!taskIsOverdue && taskIsToday && !completed && (
                  <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs font-bold rounded flex-shrink-0">
                    TODAY
                  </span>
                )}
              </>
            )}
            {projectName && !task.due_date && (
              <p className="text-text-sec text-sm truncate">
                {projectName}
              </p>
            )}
            {projectName && task.due_date && (
              <span className="text-text-sec text-sm truncate">
                • {projectName}
              </span>
            )}
          </div>
        </div>

        {/* Estimated Minutes + XP reward */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1 px-2">
          {task.estimated_minutes !== undefined && (
            <div className="text-text-sec text-sm font-medium">
              {task.estimated_minutes}min
            </div>
          )}
          {!completed && (
            <span className="text-[10px] font-bold text-black bg-[#FFD233] px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(255,210,51,0.45)]">
              +{getJobXpPreview(projectDifficulty || 'medium')} XP
            </span>
          )}
        </div>

        {/* Menu button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 rounded-xl hover:bg-[#2A2A2A] transition-colors"
          >
            <MoreVertical size={16} className="text-text-sec" />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-bg-card border border-border-card rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-50 overflow-hidden p-1">
              <button
                onClick={handleEdit}
                className="w-full px-3 py-2.5 text-left text-white hover:bg-[#2A2A2A] rounded-xl transition-colors flex items-center gap-2"
              >
                <Edit size={16} />
                Edit
              </button>
              <button
                onClick={handleTogglePriority}
                className="w-full px-3 py-2.5 text-left text-[#FFD233] hover:bg-[#FFD233]/10 rounded-xl transition-colors flex items-center gap-2"
              >
                <ChevronDoubleUpIcon className="w-4 h-4" />
                {task.priority ? 'Normal priority' : 'High priority'}
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-3 py-2.5 text-left text-red-500 hover:bg-red-500/10 rounded-xl transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
