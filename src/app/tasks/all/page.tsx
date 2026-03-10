"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskCardSkeleton } from "@/components/tasks/TaskCardSkeleton";
import { useTasks, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { getDiceBearUrl } from "@/lib/utils";
import { formatLocalSmart } from "@/lib/dates";
import { DbTask, TaskStatus } from "@/types/database";
import { ArrowUpDown, Plus, X, ChevronLeft } from "lucide-react";
import { FilterDialog } from "./components/FilterDialog";
import { AllTasksTaskCard } from "./components/AllTasksTaskCard";
import { EditTaskDialog } from "./components/EditTaskDialog";

// Filter types
type FilterType = 'status' | 'priority' | 'deadline' | 'projects';

interface Filter {
  type: FilterType;
  value: string;
  label: string;
}

type SortOption = 'created_desc' | 'created_asc' | 'deadline_asc' | 'deadline_desc' | 'name_asc' | 'name_desc';

interface SortConfig {
  option: SortOption;
  label: string;
}

const SORT_OPTIONS: SortConfig[] = [
  { option: 'created_desc', label: 'Newest first' },
  { option: 'created_asc', label: 'Oldest first' },
  { option: 'deadline_asc', label: 'Deadline soonest' },
  { option: 'deadline_desc', label: 'Deadline latest' },
  { option: 'name_asc', label: 'Name A-Z' },
  { option: 'name_desc', label: 'Name Z-A' },
];

const DEFAULT_SORT: SortOption = 'created_desc';

export default function AllTasksPage() {
  const router = useRouter();
  const [showSortDialog, setShowSortDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [editingFilter, setEditingFilter] = useState<Filter | null>(null);
  const [editingTask, setEditingTask] = useState<DbTask | null>(null);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>(DEFAULT_SORT);
  
  // Toast state
  const [showEditToast, setShowEditToast] = useState(false);
  
  // Click tracking for confused user detection
  const [clickTracker, setClickTracker] = useState<Map<string, { count: number; lastClick: number }>>(new Map());
  
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: allTasks = [], isLoading: tasksLoading } = useTasks({ type: 'task' });
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Load saved state from localStorage
  useEffect(() => {
    const savedFilters = localStorage.getItem('all-tasks-filters');
    const savedSort = localStorage.getItem('all-tasks-sort');
    
    if (savedFilters) {
      try {
        setFilters(JSON.parse(savedFilters));
      } catch (e) {
        console.error('Failed to load filters:', e);
      }
    }
    
    if (savedSort) {
      try {
        setSortOption(JSON.parse(savedSort));
      } catch (e) {
        console.error('Failed to load sort:', e);
      }
    }
  }, []);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (showEditToast) {
      const timer = setTimeout(() => {
        setShowEditToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showEditToast]);

  // Clean up old click tracking data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setClickTracker(prev => {
        const now = Date.now();
        const cleaned = new Map();
        prev.forEach((data, itemId) => {
          // Keep only clicks from last 10 seconds
          if (now - data.lastClick < 10000) {
            cleaned.set(itemId, data);
          }
        });
        return cleaned;
      });
    }, 5000); // Clean every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('all-tasks-filters', JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem('all-tasks-sort', JSON.stringify(sortOption));
  }, [sortOption]);

  // Apply filters and sorting
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...allTasks];

    // Apply filters
    filters.forEach(filter => {
      switch (filter.type) {
        case 'status':
          if (filter.value === 'pending') {
            filtered = filtered.filter(task => task.status === 'pending');
          } else if (filter.value === 'completed') {
            filtered = filtered.filter(task => task.status === 'completed');
          }
          break;
        case 'priority':
          if (filter.value === 'high') {
            filtered = filtered.filter(task => task.priority);
          } else if (filter.value === 'normal') {
            filtered = filtered.filter(task => !task.priority);
          }
          break;
        case 'deadline':
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const thisWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          const thisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          
          if (filter.value === 'overdue') {
            filtered = filtered.filter(task => task.due_date && new Date(task.due_date) < today);
          } else if (filter.value === 'today') {
            filtered = filtered.filter(task => {
              if (!task.due_date) return false;
              const dueDate = new Date(task.due_date);
              return dueDate >= today && dueDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
            });
          } else if (filter.value === 'this_week') {
            filtered = filtered.filter(task => {
              if (!task.due_date) return false;
              const dueDate = new Date(task.due_date);
              return dueDate >= today && dueDate < thisWeek;
            });
          } else if (filter.value === 'this_month') {
            filtered = filtered.filter(task => {
              if (!task.due_date) return false;
              const dueDate = new Date(task.due_date);
              return dueDate >= today && dueDate < thisMonth;
            });
          } else if (filter.value === 'no_deadline') {
            filtered = filtered.filter(task => !task.due_date);
          }
          break;
        case 'projects':
          if (filter.value === 'solo') {
            filtered = filtered.filter(task => !task.project_id);
          } else {
            // Specific project IDs
            const projectIds = filter.value.split(',');
            filtered = filtered.filter(task => task.project_id && projectIds.includes(task.project_id));
          }
          break;
      }
    });

    // Apply default filter for pending tasks if no status filter is set
    const hasStatusFilter = filters.some(f => f.type === 'status');
    if (!hasStatusFilter) {
      filtered = filtered.filter(task => task.status === 'pending');
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'deadline_asc':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'deadline_desc':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return -1;
          if (!b.due_date) return 1;
          return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
        case 'name_asc':
          return a.title.localeCompare(b.title);
        case 'name_desc':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    return filtered;
  }, [allTasks, filters, sortOption]);

  const handleAddFilter = () => {
    setEditingFilter(null);
    setShowFilterDialog(true);
  };

  const handleEditFilter = (filter: Filter) => {
    setEditingFilter(filter);
    setShowFilterDialog(true);
  };

  const handleRemoveFilter = (filterToRemove: Filter) => {
    setFilters(filters.filter(f => f !== filterToRemove));
  };

  const handleUpdateFilters = (newFilters: Filter[]) => {
    setFilters(newFilters);
    setShowFilterDialog(false);
    setEditingFilter(null);
  };

  const getCurrentSortLabel = () => {
    return SORT_OPTIONS.find(opt => opt.option === sortOption)?.label || 'Newest first';
  };

  const handleSortChange = (option: SortOption) => {
    setSortOption(option);
    setShowSortDialog(false);
  };

  const handleUpdateTask = async (id: string, updates: Partial<DbTask>) => {
    await updateTask.mutateAsync({ id, ...updates });
  };

  const handleDeleteTask = async (id: string) => {
    await deleteTask.mutateAsync(id);
  };

  const handleEditTask = (task: DbTask) => {
    setEditingTask(task);
  };

  const handleCloseEditDialog = () => {
    setEditingTask(null);
  };

  // Click handlers for editing
  const handleSingleClick = useCallback((task: DbTask) => {
    const now = Date.now();
    const itemId = task.id;
    
    // Track clicks to detect confused user
    setClickTracker(prev => {
      const current = prev.get(itemId) || { count: 0, lastClick: 0 };
      const timeSinceLastClick = now - current.lastClick;
      
      // If clicks are spaced out (not rapid double-click), increment counter
      if (timeSinceLastClick > 500) {
        const newCount = current.count + 1;
        const updated = new Map(prev);
        updated.set(itemId, { count: newCount, lastClick: now });
        
        // Show toast if user seems confused (3+ spaced clicks)
        if (newCount >= 3) {
          setShowEditToast(true);
          // Reset counter after showing toast
          updated.set(itemId, { count: 0, lastClick: now });
        }
        
        return updated;
      }
      
      return prev;
    });
  }, []);

  const handleDoubleClick = useCallback((task: DbTask) => {
    // Reset click tracker for this item when user successfully double-clicks
    setClickTracker(prev => {
      const updated = new Map(prev);
      updated.delete(task.id);
      return updated;
    });
    
    // Open edit dialog for double click
    handleEditTask(task);
  }, [handleEditTask]);

  if (tasksLoading || projectsLoading) {
    return (
      <AppShell>
        <div className="flex flex-col h-[calc(100vh-5rem)] pb-5">
          <div className="flex-shrink-0">
            <div className="h-[2vh]"></div>
            <div className="px-6 pt-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-bg-card border border-border-card animate-pulse"></div>
                <div className="w-24 h-6 bg-gray-700 animate-pulse rounded"></div>
              </div>
              <div className="w-32 h-8 bg-gray-700 animate-pulse rounded-full"></div>
            </div>
          </div>
          <div className="flex-1 px-6">
            <div className="bg-bg-card rounded-none px-4 py-3 flex items-center gap-3 border border-[#ffffff] min-h-[72px] mb-3 animate-pulse">
              <div className="w-5 h-5 bg-gray-700 rounded animate-pulse"></div>
              <div className="w-10 h-10 bg-gray-700 rounded animate-pulse"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-700 rounded animate-pulse w-3/4"></div>
              </div>
              <div className="w-12 h-4 bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div className="bg-bg-card rounded-none px-4 py-3 flex items-center gap-3 border border-[#ffffff] min-h-[72px] mb-3 animate-pulse">
              <div className="w-5 h-5 bg-gray-700 rounded animate-pulse"></div>
              <div className="w-10 h-10 bg-gray-700 rounded animate-pulse"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-700 rounded animate-pulse w-3/4"></div>
              </div>
              <div className="w-12 h-4 bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div className="bg-bg-card rounded-none px-4 py-3 flex items-center gap-3 border border-[#ffffff] min-h-[72px] mb-3 animate-pulse">
              <div className="w-5 h-5 bg-gray-700 rounded animate-pulse"></div>
              <div className="w-10 h-10 bg-gray-700 rounded animate-pulse"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-700 rounded animate-pulse w-3/4"></div>
              </div>
              <div className="w-12 h-4 bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // Convert DbTask to TaskCard format and render with AllTasksTaskCard
  const taskElements = filteredAndSortedTasks.map((task) => {
    const projectName = task.project_id ? projects.find(p => p.id === task.project_id)?.name : undefined;
    const projectColor = task.project_id ? (projects.find(p => p.id === task.project_id)?.color || undefined) : undefined;
    
    return (
      <AllTasksTaskCard
        key={task.id}
        task={task}
        projectName={projectName}
        projectColor={projectColor}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onEditTask={handleEditTask}
        onSingleClick={handleSingleClick}
        onDoubleClick={handleDoubleClick}
      />
    );
  });

  return (
    <AppShell>
      {/* Edit Toast */}
      {showEditToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-bg-card border border-border-card rounded-lg shadow-lg transition-all duration-300">
          <p className="text-text-sec text-sm">Double-click to edit task</p>
        </div>
      )}
      
      <div className="flex flex-col h-[calc(100vh-5rem)] pb-5">
        {/* Fixed Header Section */}
        <div className="flex-shrink-0">
          {/* 2% top padding */}
          <div className="h-[2vh]"></div>

          {/* Header */}
          <div className="px-6 pt-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => router.back()} 
                className="w-10 h-10 rounded-xl bg-bg-card border border-border-card flex items-center justify-center text-white hover:bg-opacity-80 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="text-white text-xl font-bold">
                All Tasks
              </h1>
            </div>
            <button
              onClick={() => setShowSortDialog(true)}
              className="bg-[#2A2A2A] rounded-full px-4 py-2 flex items-center gap-2 hover:bg-[#2A2A2A]/80 transition-colors"
            >
              <ArrowUpDown className="w-4 h-4 text-[#949494]" />
              <span className="text-white text-sm font-medium">
                {getCurrentSortLabel()}
              </span>
            </button>
          </div>

          {/* Filters Section */}
          <div className="px-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={handleAddFilter}
                className="bg-[#FFD233]/20 border border-[#FFD233]/50 rounded-full px-4 py-2 flex items-center gap-2 hover:bg-[#FFD233]/30 transition-colors"
              >
                <Plus className="w-4 h-4 text-[#FFD233]" />
                <span className="text-[#FFD233] text-sm font-medium">
                  Add filter
                </span>
              </button>
            </div>
            
            {/* Filter Pills */}
            {filters.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {filters.map((filter, index) => (
                  <button
                    key={index}
                    onClick={() => handleEditFilter(filter)}
                    className="bg-[#FFD233]/20 border border-[#FFD233]/50 rounded-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#FFD233]/30 transition-colors flex-shrink-0"
                  >
                    <span className="text-[#FFD233] text-sm font-medium">
                      {filter.label}
                    </span>
                    <X 
                      className="w-3 h-3 text-[#FFD233] hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFilter(filter);
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Task List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {taskElements.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-text-sec text-center">
                {filters.length > 0 ? 'No tasks match your filters.' : 'No tasks found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {taskElements}
            </div>
          )}
        </div>

        {/* Sort Dialog */}
        {showSortDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-bg-card rounded-none border border-border-card p-6 w-80">
              <h3 className="text-white text-lg font-semibold mb-4">Sort by</h3>
              <div className="space-y-2">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.option}
                    onClick={() => handleSortChange(option.option)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      sortOption === option.option
                        ? 'bg-[#FFD233]/20 text-[#FFD233]'
                        : 'text-white hover:bg-[#2A2A2A]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowSortDialog(false)}
                className="mt-4 w-full bg-[#2A2A2A] text-white rounded-lg py-2 hover:bg-[#2A2A2A]/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filter Dialog */}
        <FilterDialog
          isOpen={showFilterDialog}
          onClose={() => setShowFilterDialog(false)}
          onApplyFilters={handleUpdateFilters}
          currentFilters={filters}
          editingFilter={editingFilter}
          projects={projects}
        />

        {/* Edit Task Dialog */}
        <EditTaskDialog
          isOpen={!!editingTask}
          onClose={handleCloseEditDialog}
          task={editingTask}
          projects={projects}
          onUpdateTask={handleUpdateTask}
        />
      </div>
    </AppShell>
  );
}
