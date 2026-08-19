"use client";

import { useState, useCallback } from "react";
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
  const [isMobile, setIsMobile] = useState(false);

  // Mobile device detection
  useState(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                (window.innerWidth <= 768 && 'ontouchstart' in window));
    }
  });

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
        className={`flex-1 min-w-0 bg-bg-card rounded-none px-4 py-3 flex items-center gap-3 border border-[#ffffff] cursor-pointer transition-colors hover:bg-bg-card-hover min-h-[72px] relative overflow-hidden ${
          completed ? 'bg-bg-card-done border-accent-green/30' : ''
        }`}
      >
        {/* Mission color accent */}
        {task.project_id && !completed && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1"
            style={{ backgroundColor: projectColor || '#f5c518' }}
          />
        )}
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={completed}
          onChange={handleCheckboxChange}
          className="w-5 h-5 rounded flex-shrink-0 accent-accent-yellow cursor-pointer"
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
            <span className="text-[10px] font-bold text-accent-yellow bg-accent-yellow/10 px-1.5 py-0.5 rounded">
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
            className="p-1.5 rounded-lg hover:bg-[#2A2A2A] transition-colors"
          >
            <MoreVertical size={16} className="text-text-sec" />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-bg-card border border-border-card rounded-lg shadow-lg z-50">
              <button
                onClick={handleEdit}
                className="w-full px-3 py-2 text-left text-white hover:bg-[#2A2A2A] transition-colors flex items-center gap-2"
              >
                <Edit size={16} />
                Edit
              </button>
              <button
                onClick={handleTogglePriority}
                className="w-full px-3 py-2 text-left text-[#FFD233] hover:bg-[#FFD233]/10 transition-colors flex items-center gap-2"
              >
                <ChevronDoubleUpIcon className="w-4 h-4" />
                {task.priority ? 'Normal priority' : 'High priority'}
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-3 py-2 text-left text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
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
