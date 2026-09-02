"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, Folder } from "lucide-react";
import { DbTask } from "@/types/database";
import { formatLocal } from "@/lib/dates";
import { RecurrenceEditor, RecurrenceValue, defaultRecurrenceValue, recurrenceValueFromTask, recurrenceValueToFields } from "@/components/tasks/RecurrenceEditor";
import { RecurringBadge } from "@/components/tasks/RecurringBadge";

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

  const [recurrence, setRecurrence] = useState<RecurrenceValue>(defaultRecurrenceValue());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setRecurrence(recurrenceValueFromTask(task));
      setError(null);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const trimmedDueDate = formData.due_date.trim();
      // A recurring task needs a due date to anchor its next occurrence from — default
      // to today if the user turned recurrence on without picking one.
      const dueDate = trimmedDueDate
        ? trimmedDueDate
        : recurrence.isRecurring
        ? new Date().toISOString().split('T')[0]
        : null;

      await onUpdateTask(task.id, {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        estimated_minutes: formData.estimated_minutes ? parseInt(formData.estimated_minutes) : null,
        due_date: dueDate,
        priority: formData.priority,
        project_id: formData.project_id,
        ...recurrenceValueToFields(recurrence),
      });
      onClose();
    } catch (err) {
      console.error('Failed to update task:', err);
      setError(err instanceof Error ? err.message : 'Failed to update task');
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-bg-primary rounded-2xl border border-border-card w-full max-w-md max-h-[85vh] overflow-y-auto shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-semibold">Edit Job</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-text-sec hover:text-white hover:bg-bg-card transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Project info */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-text-sec text-sm">
                Current mission: {projectName}
              </p>
              {recurrence.isRecurring && (
                <RecurringBadge
                  task={{
                    recurrence_type: recurrence.recurrenceType,
                    recurrence_days: recurrence.recurrenceType === 'specific_days' ? recurrence.recurrenceDays : null,
                    recurrence_interval: recurrence.recurrenceType === 'interval' ? recurrence.recurrenceInterval : null,
                  }}
                  className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-full px-2 py-0.5 text-xs"
                />
              )}
            </div>

            {/* Project Selection */}
            <div>
              <label className="flex items-center gap-1.5 text-text-sec text-sm font-medium mb-2">
                <Folder className="w-4 h-4" />
                Mission (optional)
              </label>
              <div className="relative">
                <select
                  value={formData.project_id || ''}
                  onChange={(e) => handleInputChange('project_id', e.target.value || null)}
                  className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-[#FFD233] appearance-none"
                >
                  <option value="">No mission (solo job)</option>
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-sec hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-text-sec text-sm font-medium mb-2">
                Title
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 pr-10 text-white focus:outline-none focus:border-[#FFD233] transition-colors"
                  placeholder="Job title"
                  required
                />
                {formData.title && (
                  <button
                    type="button"
                    onClick={() => handleClearField('title')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-sec hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-text-sec text-sm font-medium mb-2">
                Description
              </label>
              <div className="relative">
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 pr-10 text-white focus:outline-none focus:border-[#FFD233] resize-none transition-colors"
                  placeholder="Job description (optional)"
                  rows={3}
                />
                {formData.description && (
                  <button
                    type="button"
                    onClick={() => handleClearField('description')}
                    className="absolute right-4 top-3 text-text-sec hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Estimated minutes */}
            <div>
              <label className="flex items-center gap-1.5 text-text-sec text-sm font-medium mb-2">
                <Clock className="w-4 h-4" />
                Estimated time (minutes)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.estimated_minutes}
                  onChange={(e) => handleInputChange('estimated_minutes', e.target.value)}
                  className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 pr-10 text-white focus:outline-none focus:border-[#FFD233] transition-colors"
                  placeholder="60"
                  min="1"
                />
                {formData.estimated_minutes && (
                  <button
                    type="button"
                    onClick={() => handleClearField('estimated_minutes')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-sec hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Due date */}
            <div>
              <label className="flex items-center gap-1.5 text-text-sec text-sm font-medium mb-2">
                <Calendar className="w-4 h-4" />
                Due date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleInputChange('due_date', e.target.value)}
                  className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 pr-10 text-white focus:outline-none focus:border-[#FFD233] transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70"
                />
                {formData.due_date && (
                  <button
                    type="button"
                    onClick={() => handleClearField('due_date')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-sec hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-center justify-between bg-bg-card border border-border-card rounded-2xl px-5 py-4">
              <span className="text-white font-medium">High priority</span>
              <button
                type="button"
                onClick={() => handleInputChange('priority', !formData.priority)}
                className={`w-14 h-7 rounded-full transition-all duration-200 relative border-2 ${
                  formData.priority ? 'bg-[#FFD233] border-[#FFD233]' : 'bg-border-card border-border-card'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm ${
                    formData.priority ? 'translate-x-7' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Recurrence */}
            <RecurrenceEditor value={recurrence} onChange={setRecurrence} />

            {error && (
              <p className="text-accent-pink text-sm">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !formData.title.trim()}
                className="flex-1 bg-[#FFD233] text-black font-bold py-3 rounded-xl hover:bg-[#FFD233]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(255,210,51,0.35)]"
              >
                {isSubmitting ? 'Saving...' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-[#2A2A2A] text-white font-medium py-3 rounded-xl hover:bg-[#2A2A2A]/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
