"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, Folder } from "lucide-react";
import { DbTask } from "@/types/database";
import { formatLocal } from "@/lib/dates";

interface EditTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  task: DbTask | null;
  projects: Array<{ id: string; name: string; color: string | null }>;
  onUpdateTask: (id: string, updates: Partial<DbTask>) => Promise<void>;
}

export function EditTaskDialog({ 
  isOpen, 
  onClose, 
  task, 
  projects, 
  onUpdateTask 
}: EditTaskDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    estimated_minutes: '',
    due_date: '',
    priority: false,
    project_id: '' as string | null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper function to format date for input
  const formatDateForInput = (dateString: string | null): string => {
    if (!dateString) return ''
    return dateString.split('T')[0] // Extract YYYY-MM-DD part from ISO string
  }

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        estimated_minutes: task.estimated_minutes?.toString() || '',
        due_date: formatDateForInput(task.due_date),
        priority: task.priority,
        project_id: task.project_id,
      });
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    try {
      await onUpdateTask(task.id, {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        estimated_minutes: formData.estimated_minutes ? parseInt(formData.estimated_minutes) : null,
        due_date: formData.due_date || null,
        priority: formData.priority,
        project_id: formData.project_id,
      });
      onClose();
    } catch (error) {
      console.error('Failed to update task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClearField = (field: string) => {
    setFormData(prev => ({ ...prev, [field]: '' }));
  };

  const handleClearProject = () => {
    setFormData(prev => ({ ...prev, project_id: null }));
  };

  const projectName = task.project_id 
    ? projects.find(p => p.id === task.project_id)?.name 
    : 'Solo task';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg-card rounded-none border border-border-card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">Edit task</h3>
          <button
            onClick={onClose}
            className="text-text-sec hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project info */}
          <div className="text-text-sec text-sm mb-4">
            Current project: {projectName}
          </div>

          {/* Project Selection */}
          <div className="mb-4">
            <label className="block text-white text-sm font-medium mb-2">
              <Folder className="w-4 h-4 inline mr-1" />
              Project (optional)
            </label>
            <div className="relative">
              <select
                value={formData.project_id || ''}
                onChange={(e) => handleInputChange('project_id', e.target.value || null)}
                className="w-full bg-[#2A2A2A] border border-border-card rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#FFD233] appearance-none"
              >
                <option value="">No project (solo task)</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {formData.project_id && (
                <button
                  type="button"
                  onClick={handleClearProject}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-text-sec hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-text-sec text-xs mt-1">
              Leave empty to create a solo task
            </p>
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="block text-white text-sm font-medium mb-2">
              Title
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full bg-[#2A2A2A] border border-border-card rounded-lg px-3 py-2 pr-8 text-white focus:outline-none focus:border-[#FFD233]"
                placeholder="Task title"
                required
              />
              {formData.title && (
                <button
                  type="button"
                  onClick={() => handleClearField('title')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-text-sec hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-white text-sm font-medium mb-2">
              Description
            </label>
            <div className="relative">
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full bg-[#2A2A2A] border border-border-card rounded-lg px-3 py-2 pr-8 text-white focus:outline-none focus:border-[#FFD233] resize-none"
                placeholder="Task description (optional)"
                rows={3}
              />
              {formData.description && (
                <button
                  type="button"
                  onClick={() => handleClearField('description')}
                  className="absolute right-2 top-2 text-text-sec hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Estimated minutes */}
          <div className="mb-4">
            <label className="block text-white text-sm font-medium mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Estimated time (minutes)
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.estimated_minutes}
                onChange={(e) => handleInputChange('estimated_minutes', e.target.value)}
                className="w-full bg-[#2A2A2A] border border-border-card rounded-lg px-3 py-2 pr-8 text-white focus:outline-none focus:border-[#FFD233]"
                placeholder="60"
                min="1"
              />
              {formData.estimated_minutes && (
                <button
                  type="button"
                  onClick={() => handleClearField('estimated_minutes')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-text-sec hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Due date */}
          <div className="mb-4">
            <label className="block text-white text-sm font-medium mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Due date
            </label>
            <div className="relative">
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => handleInputChange('due_date', e.target.value)}
                className="w-full bg-[#2A2A2A] border border-border-card rounded-lg px-3 py-2 pr-8 text-white focus:outline-none focus:border-[#FFD233]"
              />
              {formData.due_date && (
                <button
                  type="button"
                  onClick={() => handleClearField('due_date')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-text-sec hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="priority"
              checked={formData.priority}
              onChange={(e) => handleInputChange('priority', e.target.checked)}
              className="w-4 h-4 text-[#FFD233] bg-[#2A2A2A] border-gray-600 rounded"
            />
            <label htmlFor="priority" className="text-white text-sm font-medium">
              High priority
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !formData.title.trim()}
              className="flex-1 bg-[#FFD233] text-black font-semibold py-2 rounded-lg hover:bg-[#FFD233]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#2A2A2A] text-white py-2 rounded-lg hover:bg-[#2A2A2A]/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
