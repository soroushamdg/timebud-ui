"use client";

import { useState } from "react";
import { X, Calendar, CheckSquare, Star, Folder, RefreshCw } from "lucide-react";

// Filter types
type FilterType = 'status' | 'priority' | 'deadline' | 'projects' | 'recurring';

interface Filter {
  type: FilterType;
  value: string;
  label: string;
}

interface FilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: Filter[]) => void;
  currentFilters: Filter[];
  editingFilter: Filter | null;
  projects: Array<{ id: string; name: string; color: string | null }>;
}

export function FilterDialog({ 
  isOpen, 
  onClose, 
  onApplyFilters, 
  currentFilters, 
  editingFilter,
  projects 
}: FilterDialogProps) {
  const [selectedFilterType, setSelectedFilterType] = useState<FilterType | null>(
    editingFilter?.type || null
  );
  
  // Status filter state
  const [statusValue, setStatusValue] = useState(
    editingFilter?.type === 'status' ? editingFilter.value : 'pending'
  );
  
  // Priority filter state
  const [priorityValue, setPriorityValue] = useState(
    editingFilter?.type === 'priority' ? editingFilter.value : 'all'
  );
  
  // Deadline filter state
  const [deadlineValue, setDeadlineValue] = useState(
    editingFilter?.type === 'deadline' ? editingFilter.value : 'all'
  );
  
  // Projects filter state
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    editingFilter?.type === 'projects' ? editingFilter.value.split(',') : []
  );
  const [includeSoloTasks, setIncludeSoloTasks] = useState(
    editingFilter?.type === 'projects' && editingFilter.value === 'solo'
  );

  // Recurring filter state
  const [recurringValue, setRecurringValue] = useState(
    editingFilter?.type === 'recurring' ? editingFilter.value : 'all'
  );

  if (!isOpen) return null;

  const getFilterLabel = (type: FilterType, value: string): string => {
    switch (type) {
      case 'status':
        return value === 'pending' ? 'Status: Pending' : 'Status: Completed';
      case 'priority':
        return value === 'high' ? 'Priority: High' : 'Priority: Normal';
      case 'deadline':
        const deadlineLabels = {
          'all': 'Deadline: All',
          'overdue': 'Deadline: Overdue',
          'today': 'Deadline: Today',
          'this_week': 'Deadline: This week',
          'this_month': 'Deadline: This month',
          'no_deadline': 'Deadline: No deadline'
        };
        return deadlineLabels[value as keyof typeof deadlineLabels] || 'Deadline: All';
      case 'projects':
        if (value === 'solo') return 'Projects: Solo tasks';
        if (value === '') return 'Projects: All';
        const projectNames = value.split(',').map(id => {
          const project = projects.find(p => p.id === id);
          return project?.name || 'Unknown';
        });
        return `Projects: ${projectNames.join(', ')}`;
      case 'recurring':
        return value === 'recurring' ? 'Recurring only' : 'One-time only';
      default:
        return '';
    }
  };

  const handleApply = () => {
    let newFilter: Filter | null = null;
    
    switch (selectedFilterType) {
      case 'status':
        if (statusValue !== 'all') {
          newFilter = {
            type: 'status',
            value: statusValue,
            label: getFilterLabel('status', statusValue)
          };
        }
        break;
      case 'priority':
        if (priorityValue !== 'all') {
          newFilter = {
            type: 'priority',
            value: priorityValue,
            label: getFilterLabel('priority', priorityValue)
          };
        }
        break;
      case 'deadline':
        if (deadlineValue !== 'all') {
          newFilter = {
            type: 'deadline',
            value: deadlineValue,
            label: getFilterLabel('deadline', deadlineValue)
          };
        }
        break;
      case 'projects':
        if (includeSoloTasks) {
          newFilter = {
            type: 'projects',
            value: 'solo',
            label: getFilterLabel('projects', 'solo')
          };
        } else if (selectedProjectIds.length > 0) {
          newFilter = {
            type: 'projects',
            value: selectedProjectIds.join(','),
            label: getFilterLabel('projects', selectedProjectIds.join(','))
          };
        }
        break;
      case 'recurring':
        if (recurringValue !== 'all') {
          newFilter = {
            type: 'recurring',
            value: recurringValue,
            label: getFilterLabel('recurring', recurringValue)
          };
        }
        break;
    }

    let updatedFilters = [...currentFilters];
    
    // Remove existing filter of the same type
    updatedFilters = updatedFilters.filter(f => f.type !== selectedFilterType);
    
    // Add new filter if it exists
    if (newFilter) {
      updatedFilters.push(newFilter);
    }
    
    onApplyFilters(updatedFilters);
    onClose();
  };

  const handleProjectToggle = (projectId: string) => {
    setSelectedProjectIds(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const renderFilterContent = () => {
    switch (selectedFilterType) {
      case 'status':
        return (
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="pending"
                checked={statusValue === 'pending'}
                onChange={(e) => setStatusValue(e.target.value)}
                className="w-4 h-4 text-accent-yellow bg-secondary-surface border-form-border"
              />
              <CheckSquare className="w-4 h-4 text-text-sec" />
              <span className="text-text-primary">Pending jobs</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="completed"
                checked={statusValue === 'completed'}
                onChange={(e) => setStatusValue(e.target.value)}
                className="w-4 h-4 text-accent-yellow bg-secondary-surface border-form-border"
              />
              <CheckSquare className="w-4 h-4 text-accent-green" />
              <span className="text-text-primary">Completed jobs</span>
            </label>
          </div>
        );
        
      case 'priority':
        return (
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="priority"
                value="high"
                checked={priorityValue === 'high'}
                onChange={(e) => setPriorityValue(e.target.value)}
                className="w-4 h-4 text-accent-yellow bg-secondary-surface border-form-border"
              />
              <Star className="w-4 h-4 text-accent-yellow" />
              <span className="text-text-primary">High priority</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="priority"
                value="normal"
                checked={priorityValue === 'normal'}
                onChange={(e) => setPriorityValue(e.target.value)}
                className="w-4 h-4 text-accent-yellow bg-secondary-surface border-form-border"
              />
              <Star className="w-4 h-4 text-text-sec" />
              <span className="text-text-primary">Normal priority</span>
            </label>
          </div>
        );
        
      case 'deadline':
        return (
          <div className="space-y-3">
            {[
              { value: 'overdue', label: 'Overdue' },
              { value: 'today', label: 'Today' },
              { value: 'this_week', label: 'This week' },
              { value: 'this_month', label: 'This month' },
              { value: 'no_deadline', label: 'No deadline' }
            ].map(({ value, label }) => (
              <label key={value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="deadline"
                  value={value}
                  checked={deadlineValue === value}
                  onChange={(e) => setDeadlineValue(e.target.value)}
                  className="w-4 h-4 text-accent-yellow bg-secondary-surface border-form-border"
                />
                <Calendar className="w-4 h-4 text-text-sec" />
                <span className="text-text-primary">{label}</span>
              </label>
            ))}
          </div>
        );
        
      case 'projects':
        return (
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSoloTasks}
                onChange={(e) => setIncludeSoloTasks(e.target.checked)}
                className="w-4 h-4 text-accent-yellow bg-secondary-surface border-form-border rounded"
              />
              <Folder className="w-4 h-4 text-text-sec" />
              <span className="text-text-primary">Solo jobs (no mission)</span>
            </label>
            
            <div className="border-t border-border-card pt-3">
              <p className="text-text-sec text-sm mb-2">Select missions:</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {projects.map((project) => (
                  <label key={project.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProjectIds.includes(project.id)}
                      onChange={() => handleProjectToggle(project.id)}
                      disabled={includeSoloTasks}
                      className="w-4 h-4 text-accent-yellow bg-secondary-surface border-form-border rounded disabled:opacity-50"
                    />
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: project.color || '#F5C518' }} />
                    <span className="text-text-primary">{project.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
        
      case 'recurring':
        return (
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="recurring"
                value="recurring"
                checked={recurringValue === 'recurring'}
                onChange={(e) => setRecurringValue(e.target.value)}
                className="w-4 h-4 text-accent-yellow bg-secondary-surface border-form-border"
              />
              <RefreshCw className="w-4 h-4 text-accent-yellow" />
              <span className="text-text-primary">Recurring only</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="recurring"
                value="one_time"
                checked={recurringValue === 'one_time'}
                onChange={(e) => setRecurringValue(e.target.value)}
                className="w-4 h-4 text-accent-yellow bg-secondary-surface border-form-border"
              />
              <RefreshCw className="w-4 h-4 text-text-sec" />
              <span className="text-text-primary">One-time only</span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-scrim/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-bg-card rounded-2xl border border-border-card p-6 w-96 max-h-[80vh] overflow-y-auto shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary text-lg font-semibold">
            {editingFilter ? 'Edit filter' : 'Add filter'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-sec hover:text-text-primary hover:bg-bg-card-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!selectedFilterType ? (
          // Filter type selection
          <div className="space-y-2">
            {[
              { type: 'status' as FilterType, label: 'Status', icon: CheckSquare },
              { type: 'priority' as FilterType, label: 'Priority', icon: Star },
              { type: 'deadline' as FilterType, label: 'Deadline', icon: Calendar },
              { type: 'projects' as FilterType, label: 'Projects', icon: Folder },
              { type: 'recurring' as FilterType, label: 'Recurring', icon: RefreshCw }
            ].map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setSelectedFilterType(type)}
                className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl hover:bg-bg-card-hover transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-accent-yellow/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-accent-yellow" />
                </div>
                <span className="text-text-primary font-medium">{label}</span>
              </button>
            ))}
          </div>
        ) : (
          // Filter configuration
          <div>
            <button
              onClick={() => setSelectedFilterType(null)}
              className="mb-4 text-accent-yellow text-sm font-medium hover:underline"
            >
              ← Back to filter types
            </button>
            {renderFilterContent()}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleApply}
            disabled={!selectedFilterType}
            className="flex-1 bg-accent-yellow text-on-light-accent font-bold py-3 rounded-xl hover:bg-accent-yellow/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(255,210,51,0.35)]"
          >
            {editingFilter ? 'Update filter' : 'Add filter'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-secondary-surface text-text-primary font-medium py-3 rounded-xl hover:bg-bg-card-hover transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
