"use client";

import { useState, useCallback } from "react";
import { AvatarImage } from '@/components/ui/AvatarImage';
import { ChevronDoubleUpIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { formatLocalSmart } from '@/lib/dates';
import { Check, X, MoreVertical, Trash2, Edit } from 'lucide-react';
import { DbTask } from '@/types/database';

interface AllTasksTaskCardProps {
  task: DbTask;
  projectName?: string;
  projectColor?: string;
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

  const completed = task.status === 'completed';

  return (
    <div className="flex items-center gap-3">
      <div
        onClick={handleCardClick}
        onDoubleClick={handleDoubleClick}
        className={`flex-1 bg-bg-card rounded-none px-4 py-3 flex items-center gap-3 border border-[#ffffff] cursor-pointer transition-colors hover:bg-bg-card-hover min-h-[72px] ${
          completed ? 'bg-bg-card-done border-accent-green/30' : ''
        }`}
      >
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
            src={undefined}
            fallbackType="project"
            fallbackLabel={projectName || 'Project'}
            fallbackColor={projectColor || '#F5C518'}
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
            {task.due_date && (
              <>
                <CalendarIcon className="w-3 h-3 text-text-sec flex-shrink-0" />
                <span className="text-text-sec text-sm truncate">
                  {formatLocalSmart(task.due_date)}
                </span>
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

        {/* Estimated Minutes */}
        {task.estimated_minutes !== undefined && (
          <div className="flex-shrink-0 text-text-sec text-sm font-medium px-2">
            {task.estimated_minutes}min
          </div>
        )}

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
