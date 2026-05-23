"use client";

import { useState, useCallback, use, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  X,
  ChevronDown,
  Lock,
  Check,
  Plus,
  ArrowUpDown,
  Trash2,
  MoreVertical,
  Edit,
  CalendarIcon,
  ChevronLeft,
  Camera,
  Search,
  PauseCircle,
  BarChart2,
  RefreshCw,
  StopCircle,
} from "lucide-react";
import { ChevronDoubleUpIcon } from "@heroicons/react/24/outline";
import { useTasks, useUpdateTask, useCompleteTask } from "@/hooks/useTasks";
import { useProject, useDeleteProject } from "@/hooks/useProjects";
import { AvatarImage } from "@/components/ui/AvatarImage";
import { ProjectAvatarPicker } from "@/components/avatars/ProjectAvatarPicker";
import { formatLocal, formatLocalSmart } from "@/lib/dates";
import { DbTask, TaskStatus } from "@/types/database";
import { TaskCardSkeleton } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMemories, useDeleteMemory } from "@/hooks/useMemories";
import { formatDistanceToNow } from "date-fns";
import { GanttChart } from "@/components/gantt/GanttChart";

// Mobile device detection
const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  return (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768 && "ontouchstart" in window)
  );
};

// Overdue detection helper
const isOverdue = (deadline: string | null | undefined): boolean => {
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(deadline);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
};

// Today detection helper
const isToday = (deadline: string | null | undefined): boolean => {
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(deadline);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate.getTime() === today.getTime();
};

type SortMode = "manual" | "deadline";

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [draggedItem, setDraggedItem] = useState<DbTask | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showDropIndicator, setShowDropIndicator] = useState(false);
  const [dropIndicatorPosition, setDropIndicatorPosition] = useState<number>(0);

  // Swipe gesture states (mobile only)
  const [swipedTask, setSwipedTask] = useState<DbTask | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(
    null,
  );
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);

  // Long-press states (mobile alternative)
  const [longPressTask, setLongPressTask] = useState<DbTask | null>(null);
  const [showLongPressMenu, setShowLongPressMenu] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  // Desktop hover states
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [showTaskMenu, setShowTaskMenu] = useState<string | null>(null);

  // Parallax effect state
  const [scrollY, setScrollY] = useState(0);

  // Inline creation states
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingMilestone, setCreatingMilestone] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Edit states
  const [editingProject, setEditingProject] = useState(false);
  const [editingItem, setEditingItem] = useState<DbTask | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    estimated_minutes: "",
    due_date: "",
    priority: false,
    item_type: "task" as "task" | "milestone",
  });
  const [editFormError, setEditFormError] = useState("");

  // Dependency picker state (edit modal)
  const [editDependencies, setEditDependencies] = useState<string[]>([]);
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [depSearch, setDepSearch] = useState("");

  // On Hold state (edit modal)
  const [editOnHold, setEditOnHold] = useState(false);
  const [editOnHoldType, setEditOnHoldType] = useState<'external' | 'person' | 'date' | ''>('');
  const [editOnHoldReason, setEditOnHoldReason] = useState('');
  const [editOnHoldUntil, setEditOnHoldUntil] = useState('');
  const [editOnHoldError, setEditOnHoldError] = useState('');

  // Recurrence info sheet state
  const [recurrenceSheetTask, setRecurrenceSheetTask] = useState<DbTask | null>(null);
  const [recurrenceTemplate, setRecurrenceTemplate] = useState<DbTask | null>(null);
  const [showStopRecurringConfirm, setShowStopRecurringConfirm] = useState(false);

  // Fetch template when recurrence sheet opens
  useEffect(() => {
    if (!recurrenceSheetTask?.recurrence_parent_id) {
      setRecurrenceTemplate(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from('tasks')
      .select('*')
      .eq('id', recurrenceSheetTask.recurrence_parent_id)
      .single()
      .then(({ data }) => setRecurrenceTemplate(data ?? null));
  }, [recurrenceSheetTask]);

  // Project edit state
  const [projectFormData, setProjectFormData] = useState({
    name: "",
    description: "",
    deadline: "",
    color: "",
  });

  // Toast state
  const [showEditToast, setShowEditToast] = useState(false);

  // Click tracking for confused user detection
  const [clickTracker, setClickTracker] = useState<
    Map<string, { count: number; lastClick: number }>
  >(new Map());

  // Platform detection
  const [isMobile, setIsMobile] = useState(false);

  // Task highlighting
  const searchParams = useSearchParams();
  const highlightedTaskId = searchParams?.get("taskId");
  const taskRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const highlightedTasksRef = useRef<Set<string>>(new Set());
  const glowStylesAddedRef = useRef(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowTaskMenu(null);
    if (showTaskMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showTaskMenu]);

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
      setClickTracker((prev) => {
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

  // Focus input when creation mode starts
  useEffect(() => {
    if ((creatingTask || creatingMilestone) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creatingTask, creatingMilestone]);

  // Inject glow keyframes once
  const ensureGlowStyles = () => {
    if (glowStylesAddedRef.current) return;
    const style = document.createElement("style");
    style.textContent = `@keyframes taskGlowPulse {
      0% { box-shadow: 0 0 0 0 rgba(245, 197, 24, 0); opacity: 1; }
      16% { box-shadow: 0 0 12px 4px rgba(245, 197, 24, 0.55); opacity: 0.5; }
      33% { box-shadow: 0 0 18px 6px rgba(245, 197, 24, 0.9); opacity: 1; }
      50% { box-shadow: 0 0 12px 4px rgba(245, 197, 24, 0.55); opacity: 0.5; }
      66% { box-shadow: 0 0 18px 6px rgba(245, 197, 24, 0.9); opacity: 1; }
      83% { box-shadow: 0 0 12px 4px rgba(245, 197, 24, 0.55); opacity: 0.5; }
      100% { box-shadow: 0 0 0 0 rgba(245, 197, 24, 0); opacity: 1; }
    }`;
    document.head.appendChild(style);
    glowStylesAddedRef.current = true;
  };

  // Scroll to and highlight task (one-time execution per task)
  useEffect(() => {
    if (!highlightedTaskId) return;
    
    // Check if we've already highlighted this task
    if (highlightedTasksRef.current.has(highlightedTaskId)) return;
    
    // Check if the element exists
    const element = taskRefs.current[highlightedTaskId];
    if (!element) return;
    
    // Mark as highlighted immediately to prevent re-execution
    highlightedTasksRef.current.add(highlightedTaskId);
    
    // Remove taskId from URL immediately
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.delete('taskId');
    const newUrl = currentParams.toString() 
      ? `${window.location.pathname}?${currentParams.toString()}`
      : window.location.pathname;
    router.replace(newUrl, { scroll: false });
    
    // Perform scroll and animation
    ensureGlowStyles();
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.style.animation = "taskGlowPulse 2s ease-in-out forwards";
    
    // Cleanup after animation completes
    const timeout = setTimeout(() => {
      element.style.animation = "";
      element.style.boxShadow = "";
      element.style.opacity = "";
      element.style.transition = "";
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [highlightedTaskId, router]);

  // Handle click outside to finish creation
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        if (creatingTask || creatingMilestone) {
          handleFinishCreation();
        }
      }
    };

    if (creatingTask || creatingMilestone) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [creatingTask, creatingMilestone, newItemTitle]);

  // Cleanup long-press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  const resolvedParams = use(params);
  const { id: projectId } = use(params);
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: tasks = [], isLoading: tasksLoading } = useTasks({ projectId });
  const { data: memories = [] } = useMemories(projectId);
  const deleteMemory = useDeleteMemory();
  const deleteProject = useDeleteProject();
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGantt, setShowGantt] = useState(false);

  // Load sort mode from localStorage on mount
  useEffect(() => {
    const savedSortMode = localStorage.getItem(
      `project-${projectId}-sort-mode`,
    );
    if (savedSortMode === "manual" || savedSortMode === "deadline") {
      setSortMode(savedSortMode);
    }
    // Detect mobile device
    setIsMobile(isMobileDevice());
  }, [projectId]);

  // Initialize project form data when project loads
  useEffect(() => {
    if (project && !editingProject) {
      setProjectFormData({
        name: project.name,
        description: project.description || "",
        deadline: formatDateForInput(project.deadline),
        color: project.color || "",
      });
    }
  }, [project, editingProject]);

  // Save sort mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(`project-${projectId}-sort-mode`, sortMode);
  }, [projectId, sortMode]);

  // Auto-lift expired date-hold tasks
  useEffect(() => {
    if (!tasks || tasks.length === 0) return

    const now = new Date()
    const expired = tasks.filter(
      t =>
        t.on_hold === true &&
        t.on_hold_type === 'until_date' &&
        t.on_hold_until != null &&
        new Date(t.on_hold_until) <= now,
    )
    if (expired.length === 0) return

    const expiredIds = expired.map(t => t.id)
    const supabase = createClient()
    supabase
      .from('tasks')
      .update({ on_hold: false, on_hold_reason: null, on_hold_type: null, on_hold_until: null })
      .in('id', expiredIds)
      .then(({ error }) => {
        if (error) {
          console.error('Failed to auto-lift expired on-hold tasks:', error)
          return
        }
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      })
  }, [tasks, queryClient])

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Circular dependency check: returns true if adding candidateDepId as a dep of taskId would create a cycle
  const wouldCreateCycle = useCallback((candidateDepId: string, taskId: string): boolean => {
    const visited = new Set<string>();
    const queue = [candidateDepId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === taskId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const task = tasks.find(t => t.id === current);
      if (task?.dependencies) {
        queue.push(...task.dependencies);
      }
    }
    return false;
  }, [tasks]);

  // Sort items based on selected mode, with on-hold tasks at the bottom
  const sortedItems = useCallback(() => {
    const activeAndCompleted = tasks.filter((item: DbTask) => !item.on_hold);
    const onHoldItems = tasks.filter((item: DbTask) => item.on_hold);

    let sortedActive: DbTask[];
    if (sortMode === "deadline") {
      const withDeadlines = activeAndCompleted
        .filter((item: DbTask) => item.due_date)
        .sort(
          (a: DbTask, b: DbTask) =>
            new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime(),
        );
      const withoutDeadlines = activeAndCompleted
        .filter((item: DbTask) => !item.due_date)
        .sort((a: DbTask, b: DbTask) => a.order - b.order);
      sortedActive = [...withDeadlines, ...withoutDeadlines];
    } else {
      sortedActive = [...activeAndCompleted].sort((a: DbTask, b: DbTask) => a.order - b.order);
    }

    return [...sortedActive, ...onHoldItems.sort((a, b) => a.order - b.order)];
  }, [tasks, sortMode])();

  const taskItems = sortedItems.filter((item) => item.item_type === "task");
  const milestones = sortedItems.filter(
    (item) => item.item_type === "milestone",
  );

  // Create task status map for lock logic
  const taskStatusMap = tasks.reduce((acc, task) => {
    if (task.status !== null) {
      acc[task.id] = task.status as TaskStatus;
    }
    return acc;
  }, {} as Record<string, TaskStatus>);

  // Check if task is locked (only for completion)
  const isLocked = useCallback(
    (task: DbTask) => {
      // Task is locked if ANY of its dependencies are not completed
      if (!task.dependencies || task.dependencies.length === 0) return false;
      
      for (const depId of task.dependencies) {
        if (taskStatusMap[depId] !== "completed") {
          return true;
        }
      }
      
      return false;
    },
    [taskStatusMap],
  );

  // Check if task can be interacted with (for editing, deleting, prioritizing)
  const canInteract = useCallback((task: DbTask) => {
    return task.item_type === "task"; // Only tasks can be interacted with, not milestones
  }, []);

  // Check if task can be swiped (including completed tasks for undo/delete)
  const canSwipe = useCallback((task: DbTask) => {
    return task.item_type === "task"; // All tasks can be swiped, including completed ones
  }, []);

  // Calculate progress — exclude milestones, on_hold, and skipped tasks
  const activeTasks = tasks.filter(
    (t) => t.item_type === "task" && !t.on_hold && t.status !== "skipped",
  );
  const completedTaskCount = activeTasks.filter(
    (t) => t.status === "completed",
  ).length;
  const totalTaskCount = activeTasks.length;
  const onHoldCount = tasks.filter(
    (t) => t.item_type === "task" && t.on_hold,
  ).length;
  const progressPercentage =
    totalTaskCount > 0
      ? Math.round((completedTaskCount / totalTaskCount) * 100)
      : 0;

  // Sequential task numbering - only count tasks
  const getTaskNumber = useCallback(
    (task: DbTask) => {
      return tasks.findIndex((t) => t.id === task.id) + 1;
    },
    [tasks],
  );

  // Swipe gesture handlers (mobile only)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent, task: DbTask) => {
      console.log('Touch start detected:', { task: task.title, isMobile, canSwipe: canSwipe(task) });
      
      if (!isMobile || !canSwipe(task)) {
        console.log('Touch start blocked by conditions');
        return;
      }

      const touch = e.touches[0];
      console.log('Touch coordinates:', { x: touch.clientX, y: touch.clientY });
      
      setStartX(touch.clientX);
      setStartY(touch.clientY);
      setSwipedTask(task);
      setSwipeDistance(0);
      setSwipeDirection(null);

      // Start long-press timer
      const timer = setTimeout(() => {
        console.log('Long-press triggered for task:', task.title);
        setLongPressTask(task);
        setShowLongPressMenu(task.id);
        setSwipedTask(null); // Reset swipe state
        setSwipeDirection(null);
        setSwipeDistance(0);
      }, 500);
      setLongPressTimer(timer);
    },
    [canSwipe, isMobile],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!swipedTask) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      console.log('Touch move:', { deltaX, deltaY, task: swipedTask.title });

      // Cancel long-press if we're moving
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }

      // Only handle horizontal swipes
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        console.log('Vertical movement detected, ignoring');
        return;
      }

      e.preventDefault();

      const direction = deltaX > 0 ? "right" : "left";
      setSwipeDirection(direction);
      setSwipeDistance(Math.abs(deltaX));
      
      console.log('Swipe updated:', { direction, distance: Math.abs(deltaX) });
    },
    [swipedTask, startX, startY, longPressTimer],
  );

  const handleTouchEnd = useCallback(async () => {
    console.log('Touch end:', { 
      hasSwipedTask: !!swipedTask, 
      swipeDirection, 
      swipeDistance,
      task: swipedTask?.title 
    });

    // Clear long-press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (!swipedTask || !swipeDirection) {
      setSwipedTask(null);
      setSwipeDirection(null);
      setSwipeDistance(0);
      return;
    }

    const threshold = 100; // Full swipe threshold
    const fullSwipeThreshold = 200; // Instant action threshold

    console.log('Checking swipe thresholds:', { 
      swipeDistance, 
      threshold, 
      fullSwipeThreshold,
      willTrigger: swipeDistance >= threshold 
    });

    if (swipeDistance >= threshold) {
      // Swipe threshold met - show action options
      try {
        if (swipeDirection === "right") {
          // Right swipe: toggle task completion (undo if completed, complete if pending)
          if (swipedTask.status === "completed") {
            console.log('Undoing task completion via swipe:', swipedTask.title);
            await updateTask.mutateAsync({
              id: swipedTask.id,
              status: "pending",
            });
          } else {
            // Complete task - check if locked
            if (!isLocked(swipedTask)) {
              console.log('Completing task via swipe:', swipedTask.title);
              await completeTask.mutateAsync(swipedTask);
            } else {
              console.log('Task is locked, cannot complete:', swipedTask.title);
            }
          }
        } else if (swipeDirection === "left") {
          // Delete task (works for both completed and pending tasks)
          console.log('Deleting task via swipe:', swipedTask.title);
          const supabase = createClient();
          await supabase.from("tasks").delete().eq("id", swipedTask.id);
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }
      } catch (error) {
        console.error("Failed to perform swipe action:", error);
      }
    }

    // Reset swipe state
    setSwipedTask(null);
    setSwipeDirection(null);
    setSwipeDistance(0);
  }, [swipedTask, swipeDirection, swipeDistance, updateTask, completeTask, queryClient, longPressTimer, isLocked]);

  // Long-press handlers
  const handleLongPressAction = useCallback(async (action: 'complete' | 'priority' | 'delete', task: DbTask) => {
    console.log('Long-press action:', { action, task: task.title });
    
    try {
      if (action === 'complete') {
        if (!isLocked(task)) {
          await completeTask.mutateAsync(task);
        }
      } else if (action === 'priority') {
        await updateTask.mutateAsync({
          id: task.id,
          priority: !task.priority,
        });
      } else if (action === 'delete') {
        const supabase = createClient();
        await supabase.from("tasks").delete().eq("id", task.id);
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }
    } catch (error) {
      console.error('Failed to perform long-press action:', error);
    }
    
    setShowLongPressMenu(null);
    setLongPressTask(null);
  }, [updateTask, queryClient, isLocked]);

  const handleCancelLongPress = useCallback(() => {
    setShowLongPressMenu(null);
    setLongPressTask(null);
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  const handleCompleteTask = useCallback(
    async (task: DbTask) => {
      try {
        await completeTask.mutateAsync(task);
        setSwipedTask(null);
        setSwipeDirection(null);
        setSwipeDistance(0);
      } catch (error) {
        console.error("Failed to complete task:", error);
      }
    },
    [completeTask],
  );

  const handleTogglePriority = useCallback(
    async (task: DbTask) => {
      try {
        await updateTask.mutateAsync({
          id: task.id,
          priority: !task.priority,
        });
        setSwipedTask(null);
        setSwipeDirection(null);
        setSwipeDistance(0);
      } catch (error) {
        console.error("Failed to toggle priority:", error);
      }
    },
    [updateTask],
  );

  // Desktop handlers
  const handleCheckboxChange = useCallback(
    async (task: DbTask, e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (isLocked(task) || task.item_type === "milestone") return;

      try {
        if (task.status === "completed") {
          await updateTask.mutateAsync({ id: task.id, status: "pending" });
        } else {
          await completeTask.mutateAsync(task);
        }
      } catch (error) {
        console.error("Failed to toggle task status:", error);
      }
    },
    [isLocked, updateTask, completeTask],
  );

  const handleTaskMenuToggle = useCallback(
    (taskId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setShowTaskMenu(showTaskMenu === taskId ? null : taskId);
    },
    [showTaskMenu],
  );

  const handleDeleteTask = useCallback(
    async (task: DbTask) => {
      try {
        const supabase = createClient();
        await supabase.from("tasks").delete().eq("id", task.id);
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        setSwipedTask(null);
        setSwipeDirection(null);
        setSwipeDistance(0);
        setShowTaskMenu(null);
      } catch (error) {
        console.error("Failed to delete task:", error);
      }
    },
    [queryClient],
  );

  // Inline creation handlers
  const handleStartCreation = useCallback((type: "task" | "milestone") => {
    if (type === "task") {
      setCreatingTask(true);
      setCreatingMilestone(false);
    } else {
      setCreatingMilestone(true);
      setCreatingTask(false);
    }
    setNewItemTitle("");
  }, []);

  const handleFinishCreation = useCallback(async () => {
    if (!newItemTitle.trim()) {
      setCreatingTask(false);
      setCreatingMilestone(false);
      setNewItemTitle("");
      return;
    }

    try {
      const supabase = createClient();
      const itemType = creatingTask ? "task" : "milestone";

      // Get the highest order value for new item
      const maxOrder = Math.max(...sortedItems.map((item) => item.order), 0);

      const { error } = await supabase.from("tasks").insert({
        user_id: project?.user_id,
        project_id: projectId,
        item_type: itemType,
        title: newItemTitle.trim(),
        order: maxOrder + 1,
        priority: false,
        status: itemType === "task" ? "pending" : null,
        estimated_minutes: itemType === "task" ? null : null,
      });

      if (error) throw error;

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (error) {
      console.error("Failed to create item:", error);
    } finally {
      setCreatingTask(false);
      setCreatingMilestone(false);
      setNewItemTitle("");
    }
  }, [
    newItemTitle,
    creatingTask,
    creatingMilestone,
    sortedItems,
    project,
    projectId,
    queryClient,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleFinishCreation();
      } else if (e.key === "Escape") {
        setCreatingTask(false);
        setCreatingMilestone(false);
        setNewItemTitle("");
      }
    },
    [handleFinishCreation],
  );

  // Helper function to format date for input
  const formatDateForInput = (dateString: string | null): string => {
    if (!dateString) return "";
    return dateString.split("T")[0]; // Extract YYYY-MM-DD part from ISO string
  };

  // Edit handlers
  const handleStartEditItem = useCallback((item: DbTask) => {
    setEditingItem(item);
    setEditFormData({
      title: item.title,
      description: item.description || "",
      estimated_minutes: item.estimated_minutes?.toString() || "",
      due_date: formatDateForInput(item.due_date),
      priority: item.priority,
      item_type: item.item_type,
    });
    // Populate dependency state
    setEditDependencies(item.dependencies || []);
    setShowDepPicker(false);
    setDepSearch("");
    // Populate on-hold state
    setEditOnHold(item.on_hold || false);
    setEditOnHoldType((item.on_hold_type === 'until_date' ? 'date' : item.on_hold_type === 'indefinite' ? 'external' : '') as 'external' | 'person' | 'date' | '');
    setEditOnHoldReason(item.on_hold_reason || '');
    setEditOnHoldUntil(item.on_hold_until || '');
    setEditOnHoldError('');
  }, [])

  const handleSaveEditItem = useCallback(async () => {
    if (!editingItem || !editFormData.title.trim()) return;

    // Clear previous errors
    setEditFormError("");
    setEditOnHoldError('');

    // On-hold validation
    if (editOnHold && !editOnHoldReason.trim()) {
      setEditOnHoldError('Please describe what you are waiting for.');
      return;
    }

    // Deadline validation: task/milestone deadline cannot be after project deadline
    if (project && editFormData.due_date && project.deadline) {
      const itemDeadline = new Date(editFormData.due_date);
      const projectDeadline = new Date(project.deadline);

      if (itemDeadline > projectDeadline) {
        setEditFormError(
          `${
            editFormData.item_type === "milestone" ? "Milestone" : "Task"
          } deadline cannot be after project deadline (${new Date(
            project.deadline,
          ).toLocaleDateString()})`,
        );
        return;
      }
    }

    try {
      const supabase = createClient();
      const updateData: any = {
        title: editFormData.title.trim(),
        description: editFormData.description.trim() || null,
        priority: editFormData.priority,
        item_type: editFormData.item_type,
      };

      // Add task-specific fields
      if (editFormData.item_type === "task") {
        updateData.status = editingItem.status || "pending";
        updateData.estimated_minutes = editFormData.estimated_minutes
          ? parseInt(editFormData.estimated_minutes)
          : null;
        // On hold fields
        updateData.on_hold = editOnHold;
        if (editOnHold) {
          updateData.on_hold_reason = editOnHoldReason.trim() || null;
          updateData.on_hold_type = editOnHoldType === 'date' ? 'until_date' : editOnHoldType === 'person' ? 'indefinite' : 'indefinite';
          updateData.on_hold_until = editOnHoldType === 'date' ? (editOnHoldUntil || null) : null;
        } else {
          updateData.on_hold_reason = null;
          updateData.on_hold_type = null;
          updateData.on_hold_until = null;
        }
      } else {
        // Milestone-specific
        updateData.status = null;
        updateData.estimated_minutes = null;
      }

      // Add due date (null if cleared)
      updateData.due_date = editFormData.due_date.trim() || null;

      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", editingItem.id);

      if (error) throw error;

      // Sync dependencies: diff old vs new
      if (editFormData.item_type === "task") {
        const originalDeps = editingItem.dependencies || [];
        const toAdd = editDependencies.filter(id => !originalDeps.includes(id));
        const toRemove = originalDeps.filter(id => !editDependencies.includes(id));

        if (toRemove.length > 0) {
          for (const depId of toRemove) {
            await supabase
              .from('task_dependencies')
              .delete()
              .eq('task_id', editingItem.id)
              .eq('depends_on_id', depId);
          }
        }
        if (toAdd.length > 0) {
          await supabase
            .from('task_dependencies')
            .insert(toAdd.map(depId => ({ task_id: editingItem.id, depends_on_id: depId })));
        }
      }

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setEditingItem(null);
    } catch (error) {
      console.error("Failed to update item:", error);
    }
  }, [editingItem, editFormData, project, queryClient, editDependencies, editOnHold, editOnHoldType, editOnHoldReason, editOnHoldUntil]);

  const handleCancelEditItem = useCallback(() => {
    setEditingItem(null);
    setEditFormError("");
    setEditFormData({
      title: "",
      description: "",
      estimated_minutes: "",
      due_date: "",
      priority: false,
      item_type: "task",
    });
  }, []);

  // Project edit handlers
  const handleStartEditProject = useCallback(() => {
    if (project) {
      setProjectFormData({
        name: project.name,
        description: project.description || "",
        deadline: formatDateForInput(project.deadline),
        color: project.color || "",
      });
      setEditingProject(true);
    }
  }, [project]);

  const handleSaveEditProject = useCallback(async () => {
    if (!project || !projectFormData.name.trim()) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("projects")
        .update({
          name: projectFormData.name.trim(),
          description: projectFormData.description.trim() || null,
          deadline: projectFormData.deadline || null,
          color: projectFormData.color || null,
        })
        .eq("id", project.id);

      if (error) throw error;

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditingProject(false);
    } catch (error) {
      console.error("Failed to update project:", error);
    }
  }, [project, projectFormData, queryClient]);

  const handleCancelEditProject = useCallback(() => {
    setEditingProject(false);
  }, []);

  // Click handlers for editing
  const handleSingleClick = useCallback((item: DbTask) => {
    const now = Date.now();
    const itemId = item.id;

    // Track clicks to detect confused user
    setClickTracker((prev) => {
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

  const handleDoubleClick = useCallback(
    (item: DbTask) => {
      // Reset click tracker for this item when user successfully double-clicks
      setClickTracker((prev) => {
        const updated = new Map(prev);
        updated.delete(item.id);
        return updated;
      });

      // Open edit modal for double click
      handleStartEditItem(item);
    },
    [handleStartEditItem],
  );

  const handleMilestoneClick = useCallback(
    (item: DbTask) => {
      // Direct edit for milestone labels
      handleStartEditItem(item);
    },
    [handleStartEditItem],
  );

  const handleDeleteProject = useCallback(async () => {
    if (!project) return;

    try {
      await deleteProject.mutateAsync(project.id);
      router.push("/");
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  }, [project, deleteProject, router]);

  const handleAddTask = () => {
    router.push(`/tasks/new?projectId=${projectId}`);
  };

  // Drag and drop handlers for manual sort mode only
  const handleDragStart = (e: React.DragEvent, item: DbTask) => {
    if (sortMode !== "manual") {
      e.preventDefault();
      return;
    }
    setDraggedItem(item);
    setShowDropIndicator(true);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (sortMode !== "manual" || !draggedItem) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);

    // Calculate drop indicator position
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const isAbove = e.clientY < midpoint;
    setDropIndicatorPosition(isAbove ? rect.top : rect.bottom);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    if (sortMode !== "manual" || !draggedItem) return;
    e.preventDefault();

    const dragIndex = sortedItems.findIndex(
      (item) => item.id === draggedItem.id,
    );
    if (dragIndex === dropIndex) {
      setDraggedItem(null);
      setDragOverIndex(null);
      setShowDropIndicator(false);
      return;
    }

    // Calculate new order value - can drop between, before, or after any item including milestones
    let newOrder: number;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isAbove = e.clientY < rect.top + rect.height / 2;

    if (isAbove && dropIndex === 0) {
      // Dropping before first item
      newOrder = sortedItems[0].order - 1;
    } else if (!isAbove && dropIndex === sortedItems.length - 1) {
      // Dropping after last item
      newOrder = sortedItems[sortedItems.length - 1].order + 1;
    } else if (isAbove) {
      // Dropping before an item
      const prevOrder = dropIndex > 0 ? sortedItems[dropIndex - 1].order : 0;
      const nextOrder = sortedItems[dropIndex].order;
      newOrder = (prevOrder + nextOrder) / 2;
    } else {
      // Dropping after an item
      const currentOrder = sortedItems[dropIndex].order;
      const nextOrder =
        dropIndex < sortedItems.length - 1
          ? sortedItems[dropIndex + 1].order
          : currentOrder + 2;
      newOrder = (currentOrder + nextOrder) / 2;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("tasks")
        .update({ order: newOrder })
        .eq("id", draggedItem.id);

      if (error) throw error;

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (error) {
      console.error("Failed to update item order:", error);
    }

    setDraggedItem(null);
    setDragOverIndex(null);
    setShowDropIndicator(false);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
    setShowDropIndicator(false);
  };

  // Render individual item (task or milestone)
  const renderItem = (item: DbTask, index: number, isDraggable: boolean) => {
    const isCurrentlySwipedTask = swipedTask?.id === item.id;
    const swipeTransform =
      isCurrentlySwipedTask && isMobile
        ? `translateX(${
            swipeDirection === "right" ? swipeDistance : -swipeDistance
          }px)`
        : "translateX(0px)";
    const isHovered = hoveredTask === item.id;
    const showMenu = showTaskMenu === item.id;

    if (item.item_type === "milestone") {
      return (
        <div
          key={item.id}
          className="relative"
          onDragOver={isDraggable ? (e) => handleDragOver(e, index) : undefined}
          onDragLeave={isDraggable ? handleDragLeave : undefined}
          onDrop={isDraggable ? (e) => handleDrop(e, index) : undefined}
        >
          <div className="py-3 flex items-center gap-2 mx-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 border border-accent-yellow rotate-45 flex-shrink-0" />
              <span
                className="text-accent-yellow text-sm font-semibold cursor-pointer hover:text-white transition-colors"
                onClick={() => handleMilestoneClick(item)}
              >
                {item.title}
              </span>
            </div>
            <div className="flex-1 h-px bg-border-card" />
            {item.due_date && (
              <span className="text-text-sec text-xs flex-shrink-0">
                {formatLocal(item.due_date)}
              </span>
            )}
          </div>
        </div>
      );
    } else {
      // Task rendering
      const taskNumber = getTaskNumber(item);
      const locked = isLocked(item);
      const completed = item.status === "completed";
      const onHold = item.on_hold || false;
      const canEdit = canInteract(item); // Allow editing for all tasks, including completed ones

      // Blocked-by names (incomplete deps)
      const blockedByNames = locked
        ? (item.dependencies || [])
            .filter(depId => taskStatusMap[depId] !== 'completed')
            .map(depId => tasks.find(t => t.id === depId)?.title)
            .filter(Boolean) as string[]
        : [];

      return (
        <div key={item.id} className="relative">
          {/* Swipe action backgrounds (mobile only) */}
          {isMobile && isCurrentlySwipedTask && swipeDistance > 50 && (
            <>
              {swipeDirection === "right" && (
                <div className="absolute inset-0 bg-accent-green rounded-2xl flex items-center justify-start px-4">
                  <div className="flex items-center gap-2">
                    {completed ? (
                      <>
                        <X size={20} className="text-white" />
                        <span className="text-white font-semibold">
                          {swipeDistance > 150 ? "Release to Undo" : "Undo"}
                        </span>
                      </>
                    ) : (
                      <>
                        <Check size={20} className="text-white" />
                        <span className="text-white font-semibold">
                          {swipeDistance > 150 ? "Release to Complete" : "Complete"}
                        </span>
                      </>
                    )}
                  </div>
                  {!completed && swipeDistance < 150 && !locked && (
                    <button
                      onClick={() => handleTogglePriority(item)}
                      className="ml-4 bg-accent-yellow text-black px-3 py-1 rounded-lg text-sm font-semibold"
                    >
                      {item.priority ? "Normal" : "Priority"}
                    </button>
                  )}
                </div>
              )}
              {swipeDirection === "left" && (
                <div className="absolute inset-0 bg-red-500 rounded-2xl flex items-center justify-end px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">
                      {swipeDistance > 150 ? "Release to Delete" : "Delete"}
                    </span>
                    <Trash2 size={20} className="text-white" />
                  </div>
                </div>
              )}
            </>
          )}

          <div
            ref={(el) => {
              taskRefs.current[item.id] = el;
            }}
            draggable={isDraggable && sortMode === "manual" && !completed}
            onDragStart={
              isDraggable && sortMode === "manual"
                ? (e) => handleDragStart(e, item)
                : undefined
            }
            onDragOver={
              isDraggable ? (e) => handleDragOver(e, index) : undefined
            }
            onDragLeave={isDraggable ? handleDragLeave : undefined}
            onDrop={isDraggable ? (e) => handleDrop(e, index) : undefined}
            onDragEnd={isDraggable ? handleDragEnd : undefined}
            onTouchStart={
              isMobile ? (e) => handleTouchStart(e, item) : undefined
            }
            onTouchMove={isMobile ? handleTouchMove : undefined}
            onTouchEnd={isMobile ? handleTouchEnd : undefined}
            onTouchCancel={isMobile ? () => {
              // Cancel long-press on touch cancel
              if (longPressTimer) {
                clearTimeout(longPressTimer);
                setLongPressTimer(null);
              }
              setSwipedTask(null);
              setSwipeDirection(null);
              setSwipeDistance(0);
            } : undefined}
            onMouseEnter={() => !isMobile && setHoveredTask(item.id)}
            onMouseLeave={() => !isMobile && setHoveredTask(null)}
            onClick={() => {
              if (canEdit) {
                handleSingleClick(item);
              }
            }}
            onDoubleClick={() => {
              if (canEdit) {
                handleDoubleClick(item);
              }
            }}
            style={{ 
              transform: swipeTransform,
              touchAction: isMobile ? 'pan-y' : 'auto'
            }}
            className={`
              mb-3 rounded-none px-4 py-3 flex items-center gap-3 border transition-all relative z-10
              ${
                completed
                  ? "bg-bg-card-done border-accent-green/30"
                  : onHold
                  ? "bg-bg-card border-amber-500/30 opacity-70"
                  : locked
                  ? "bg-bg-card-locked opacity-60"
                  : "bg-bg-card border-border-card"
              }
              ${canEdit ? "cursor-pointer" : ""}
              ${
                isDraggable && sortMode === "manual" && !completed
                  ? "cursor-move"
                  : ""
              }
              ${dragOverIndex === index ? "ring-2 ring-accent-yellow" : ""}
            `}
          >
            {/* Desktop checkbox or Mobile numbered badge */}
            {!isMobile ? (
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => handleCheckboxChange(item, e)}
                disabled={locked || item.item_type !== "task"}
                className="w-5 h-5 rounded flex-shrink-0 accent-accent-yellow cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />
            ) : (
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                  ${
                    completed
                      ? "bg-accent-green text-white"
                      : locked
                      ? "bg-bg-card-locked text-text-sec"
                      : "bg-bg-card text-white"
                  }
                `}
              >
                {completed ? <Check size={16} /> : taskNumber}
              </div>
            )}

            {/* Task title */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                {item.priority && (
                  <ChevronDoubleUpIcon className="w-4 h-4 text-accent-yellow flex-shrink-0" />
                )}
                <h3
                  className={`text-base font-semibold truncate min-w-0 ${
                    locked || onHold ? "text-text-sec" : "text-white"
                  }`}
                >
                  {item.title}
                </h3>
                {item.recurrence_parent_id && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setRecurrenceSheetTask(item); }}
                    className="flex-shrink-0 text-text-sec hover:text-accent-yellow transition-colors"
                    title="Recurring task"
                  >
                    <RefreshCw size={13} />
                  </button>
                )}
                {onHold && (
                  <span className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                    <PauseCircle size={11} />
                    On Hold
                  </span>
                )}
              </div>
              {locked && blockedByNames.length > 0 && (
                <p className="text-text-sec text-xs mt-0.5 truncate">
                  Blocked by: {blockedByNames.join(', ')}
                </p>
              )}
              {item.estimated_minutes && (
                <p className="text-text-sec text-sm mt-1">
                  Estimated: {item.estimated_minutes} min
                </p>
              )}
            </div>

            {/* Deadline in trailing position */}
            {item.due_date && (
              <div className="flex-shrink-0 flex items-center gap-2 ml-3">
                <span className={`text-sm font-medium ${isOverdue(item.due_date) && !completed ? 'text-red-500 font-semibold' : isToday(item.due_date) && !completed ? 'text-blue-500 font-semibold' : 'text-text-sec'}`}>
                  {formatLocalSmart(item.due_date)}
                </span>
                {isOverdue(item.due_date) && !completed && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
                    OVERDUE
                  </span>
                )}
                {!isOverdue(item.due_date) && isToday(item.due_date) && !completed && (
                  <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs font-bold rounded">
                    TODAY
                  </span>
                )}
              </div>
            )}

            {/* Desktop hover actions */}
            {!isMobile && !locked && !completed && isHovered && (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleTogglePriority(item)}
                  className="p-1.5 rounded-lg bg-accent-yellow/20 text-accent-yellow hover:bg-accent-yellow/30 transition-colors"
                  title={item.priority ? "Remove priority" : "Add priority"}
                >
                  <ChevronDoubleUpIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleTaskMenuToggle(item.id, e)}
                  className="p-1.5 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors relative"
                  title="More options"
                >
                  <MoreVertical size={16} />
                  {/* Dropdown menu */}
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-bg-card border border-border-card rounded-lg shadow-lg z-50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(item);
                        }}
                        className="w-full px-3 py-2 text-left text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  )}
                </button>
              </div>
            )}

            {/* Lock icon */}
            {locked && (
              <Lock size={16} className="text-text-sec flex-shrink-0" />
            )}
          </div>
        </div>
      );
    }
  };

  // Long-press menu component
  const LongPressMenu = ({ task }: { task: DbTask }) => {
    const locked = isLocked(task);
    const completed = task.status === "completed";
    
    return (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-end" onClick={handleCancelLongPress}>
        <div className="bg-bg-card w-full rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white text-lg font-semibold">{task.title}</h3>
            <button
              onClick={handleCancelLongPress}
              className="text-text-sec hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="space-y-3">
            {completed ? (
              <button
                onClick={() => handleLongPressAction('complete', task)}
                className="w-full flex items-center gap-3 bg-orange-500/20 text-orange-500 p-4 rounded-2xl hover:bg-orange-500/30 transition-colors"
              >
                <X size={20} />
                <span className="font-medium">Undo Completion</span>
              </button>
            ) : (
              !locked && (
                <button
                  onClick={() => handleLongPressAction('complete', task)}
                  className="w-full flex items-center gap-3 bg-accent-green/20 text-accent-green p-4 rounded-2xl hover:bg-accent-green/30 transition-colors"
                >
                  <Check size={20} />
                  <span className="font-medium">Complete Task</span>
                </button>
              )
            )}
            
            <button
              onClick={() => handleLongPressAction('priority', task)}
              className="w-full flex items-center gap-3 bg-accent-yellow/20 text-accent-yellow p-4 rounded-2xl hover:bg-accent-yellow/30 transition-colors"
            >
              <ChevronDoubleUpIcon className="w-5 h-5" />
              <span className="font-medium">{task.priority ? 'Remove Priority' : 'Add Priority'}</span>
            </button>
            
            <button
              onClick={() => handleLongPressAction('delete', task)}
              className="w-full flex items-center gap-3 bg-red-500/20 text-red-500 p-4 rounded-2xl hover:bg-red-500/30 transition-colors"
            >
              <Trash2 size={20} />
              <span className="font-medium">Delete Task</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (projectLoading || tasksLoading || !project) {
    return (
      <div className="min-h-screen bg-bg-primary">
        {/* Hero skeleton */}
        <div className="relative h-48 bg-gray-800 animate-pulse" />

        {/* Task skeletons */}
        <div className="p-4 space-y-3">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Edit Toast */}
      {showEditToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-bg-card border border-border-card rounded-lg shadow-lg transition-all duration-300">
          <p className="text-text-sec text-sm">
            Double-click to edit task or milestone
          </p>
        </div>
      )}

      {/* Header */}
      <div className="relative">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-xl bg-bg-card border border-border-card flex items-center justify-center text-white hover:bg-opacity-80 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Gantt toggle button */}
        <button
          onClick={() => setShowGantt(g => !g)}
          className={`absolute top-4 right-4 z-10 px-3 py-1 bg-bg-card rounded-full text-sm flex items-center gap-1 transition-colors ${
            showGantt ? 'text-accent-yellow border border-accent-yellow/40' : 'text-text-sec'
          }`}
          title={showGantt ? 'Show task list' : 'Show timeline'}
        >
          <BarChart2 size={14} />
        </button>

        {/* Sort button */}
        {!showGantt && (
          <button
            onClick={() => setShowSortOptions(true)}
            className="absolute top-4 right-16 z-10 px-3 py-1 bg-bg-card text-text-sec rounded-full text-sm flex items-center gap-1"
          >
            <ArrowUpDown size={14} />
            Sort
          </button>
        )}

        {/* Edit button */}
        {!showGantt && (
          <button
            onClick={handleStartEditProject}
            className="absolute top-4 right-36 z-10 px-3 py-1 bg-bg-card text-text-sec rounded-full text-sm flex items-center gap-1"
          >
            <Edit size={14} />
            Edit
          </button>
        )}

        {/* Hero */}
        <div className="relative h-64 overflow-hidden">
          <div className="relative w-full h-full">
            <div className="parallax-container" style={{
                transform: `translateY(${scrollY * 0.5}px) scale(1.1)`,
                transition: 'transform 0.1s ease-out'
              }}>
              <AvatarImage
                src={project.project_avatar_url}
                fallbackType="project"
                fallbackLabel={project.name}
                fallbackColor={project.color || undefined}
                projectId={project.id}
                className="w-full h-full"
              />
            </div>
            <button
              onClick={() => setShowAvatarPicker(true)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <Camera size={20} />
            </button>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />

          {/* Hero content */}
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-3xl font-bold text-white mb-2">
              {project.name}
            </h1>
            <div className="flex justify-between items-end">
              <div className="flex flex-col gap-0.5">
                {totalTaskCount > 0 && (
                  <div className="text-4xl font-bold text-white">
                    {progressPercentage}%
                  </div>
                )}
                {onHoldCount > 0 && (
                  <div className="text-xs text-text-sec">
                    {onHoldCount} on hold
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-text-sec text-xs uppercase">DUE DATE</div>
                <div className="text-white text-sm">
                  {project.deadline
                    ? formatLocalSmart(project.deadline)
                    : "No deadline"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sort Dialog */}
      {showSortOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-bg-primary rounded-2xl w-full max-w-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Sort Items</h2>
                <button
                  onClick={() => setShowSortOptions(false)}
                  className="text-text-sec hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSortMode("manual");
                    setShowSortOptions(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    sortMode === "manual"
                      ? "bg-accent-yellow text-black font-semibold"
                      : "bg-bg-card text-white hover:bg-bg-card-hover border border-border-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ArrowUpDown
                      size={18}
                      className={
                        sortMode === "manual" ? "text-black" : "text-text-sec"
                      }
                    />
                    <div>
                      <div className="font-medium">Manual Order</div>
                      <div className="text-xs opacity-75">
                        Drag to reorder items
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setSortMode("deadline");
                    setShowSortOptions(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    sortMode === "deadline"
                      ? "bg-accent-yellow text-black font-semibold"
                      : "bg-bg-card text-white hover:bg-bg-card-hover border border-border-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CalendarIcon
                      size={18}
                      className={
                        sortMode === "deadline" ? "text-black" : "text-text-sec"
                      }
                    />
                    <div>
                      <div className="font-medium">By Deadline</div>
                      <div className="text-xs opacity-75">
                        Items with deadlines first
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drop indicator */}
      {showDropIndicator && (
        <div
          className="fixed left-4 right-4 h-1 bg-accent-yellow rounded-full flex items-center justify-between pointer-events-none z-50"
          style={{ top: `${dropIndicatorPosition}px` }}
        >
          <div className="w-2 h-2 bg-accent-yellow rounded-full" />
          <div className="w-2 h-2 bg-accent-yellow rounded-full" />
        </div>
      )}

      {/* Gantt Chart View */}
      {showGantt && (
        <div className="pb-20">
          <GanttChart tasks={sortedItems} projects={project ? [project] : []} />
        </div>
      )}

      {/* Content */}
      <div className={`pb-20 ${showGantt ? 'hidden' : ''}`}>
        {sortedItems.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <div className="w-8 h-8 border border-accent-yellow rotate-45 mb-3" />
            <h3 className="text-white text-lg font-semibold mt-3">
              No tasks yet
            </h3>
            <p className="text-text-sec text-sm mt-1">
              Tap + to add your first task or milestone
            </p>

            {/* Add buttons in empty state */}
            <div className="mt-8 w-full space-y-3">
              <button
                onClick={() => handleStartCreation("task")}
                className="w-full px-4 py-3 flex items-center justify-center gap-3 text-text-sec hover:text-white transition-colors"
              >
                <Plus size={20} className="flex-shrink-0" />
                <span className="text-base">Add new task</span>
              </button>
              <button
                onClick={() => handleStartCreation("milestone")}
                className="w-full px-4 py-3 flex items-center justify-center gap-3 text-text-sec hover:text-white transition-colors"
              >
                <Plus size={20} className="flex-shrink-0" />
                <span className="text-base">Add new milestone</span>
              </button>
            </div>

            {/* Inline creation input in empty state */}
            {(creatingTask || creatingMilestone) && (
              <div className="mt-4 w-full">
                <div className="rounded-2xl px-4 py-3 flex items-center gap-3 border border-border-card bg-bg-card">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-bg-card text-white">
                    {creatingTask ? "T" : "M"}
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Enter ${
                      creatingTask ? "task" : "milestone"
                    } name...`}
                    className="flex-1 bg-transparent text-white placeholder-text-sec outline-none text-base font-semibold"
                  />
                  <div className="text-text-sec text-sm">
                    {creatingTask ? "Task" : "Milestone"}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Items List */
          <div className="px-4">
            {/* Show "No deadline" label when in deadline sort mode and there are items without deadlines */}
            {sortMode === "deadline" &&
              sortedItems.some((item) => item.due_date) &&
              sortedItems.some((item) => !item.due_date) && (
                <div className="mb-4">
                  {/* Render items with deadlines first */}
                  {sortedItems
                    .filter((item) => item.due_date)
                    .map((item, index) => (
                      <div key={`deadline-${item.id}`}>
                        {renderItem(item, index, true)}
                      </div>
                    ))}

                  {/* No deadline label */}
                  <div className="py-3 px-6 flex items-center gap-4">
                    <div className="flex-1 h-px border-t border-dashed border-border-card" />
                    <span className="text-text-sec text-sm font-medium leading-none">
                      No deadline
                    </span>
                    <div className="flex-1 h-px border-t border-dashed border-border-card" />
                  </div>

                  {/* Render items without deadlines */}
                  {sortedItems
                    .filter((item) => !item.due_date)
                    .map((item, index) => (
                      <div key={`no-deadline-${item.id}`}>
                        {renderItem(
                          item,
                          sortedItems.filter((item) => item.due_date).length +
                            index,
                          true,
                        )}
                      </div>
                    ))}
                </div>
              )}

            {/* Regular rendering for manual sort or when all items have same deadline status */}
            {(sortMode === "manual" ||
              !sortedItems.some((item) => item.due_date) ||
              !sortedItems.some((item) => !item.due_date)) && (
              <>
                {sortedItems.map((item, index) => (
                  <div key={item.id}>
                    {renderItem(item, index, sortMode === "manual")}
                  </div>
                ))}
              </>
            )}

            {/* Add new item buttons - always show */}
            <div className="mt-6 space-y-3">
              {/* Inline creation input */}
              {(creatingTask || creatingMilestone) && (
                <div className="mb-3 rounded-2xl px-4 py-3 flex items-center gap-3 border border-border-card bg-bg-card">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-bg-card text-white">
                    {creatingTask ? "T" : "M"}
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Enter ${
                      creatingTask ? "task" : "milestone"
                    } name...`}
                    className="flex-1 bg-transparent text-white placeholder-text-sec outline-none text-base font-semibold"
                  />
                  <div className="text-text-sec text-sm">
                    {creatingTask ? "Task" : "Milestone"}
                  </div>
                </div>
              )}

              {/* Add buttons */}
              {!creatingTask && !creatingMilestone && (
                <>
                  <button
                    onClick={() => handleStartCreation("task")}
                    className="w-full px-4 py-3 flex items-center gap-3 text-text-sec hover:text-white transition-colors"
                  >
                    <Plus size={20} className="flex-shrink-0" />
                    <span className="text-base">Add new task</span>
                  </button>
                  <button
                    onClick={() => handleStartCreation("milestone")}
                    className="w-full px-4 py-3 flex items-center gap-3 text-text-sec hover:text-white transition-colors"
                  >
                    <Plus size={20} className="flex-shrink-0" />
                    <span className="text-base">Add new milestone</span>
                  </button>
                </>
              )}
            </div>

            {/* Memories Section */}
            <div className="mt-8 px-6 pb-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-bold text-white">Memories</h3>
              </div>

              {memories.length === 0 ? (
                <div className="bg-bg-card border border-border-card rounded-lg p-4 text-center">
                  <p className="text-text-sec text-sm">
                    AI will save important context here automatically
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="bg-bg-card border border-border-card rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-white text-sm mb-2">
                            {memory.content}
                          </p>
                          <p className="text-text-sec text-xs">
                            {formatDistanceToNow(new Date(memory.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        {deletingMemoryId === memory.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                deleteMemory.mutate(memory.id);
                                setDeletingMemoryId(null);
                              }}
                              className="text-accent-pink text-xs font-semibold hover:opacity-80 transition-opacity"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeletingMemoryId(null)}
                              className="text-text-sec text-xs font-semibold hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingMemoryId(memory.id)}
                            className="text-text-sec hover:text-accent-pink transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button - only show when there are items and not in gantt view */}
      {sortedItems.length > 0 && !showGantt && (
        <button
          onClick={handleAddTask}
          className="fixed bottom-24 right-4 bg-accent-yellow text-black rounded-full w-12 h-12 text-2xl font-bold flex items-center justify-center shadow-lg"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-bg-primary rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  Edit {editingItem.item_type}
                </h2>
                <button
                  onClick={handleCancelEditItem}
                  className="text-text-sec hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Type Toggle */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">
                    Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setEditFormData((prev) => ({
                          ...prev,
                          item_type: "task",
                        }))
                      }
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                        editFormData.item_type === "task"
                          ? "bg-accent-yellow text-black font-semibold"
                          : "bg-bg-card text-text-sec hover:text-white"
                      }`}
                    >
                      Task
                    </button>
                    <button
                      onClick={() =>
                        setEditFormData((prev) => ({
                          ...prev,
                          item_type: "milestone",
                        }))
                      }
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                        editFormData.item_type === "milestone"
                          ? "bg-accent-yellow text-black font-semibold"
                          : "bg-bg-card text-text-sec hover:text-white"
                      }`}
                    >
                      Milestone
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white placeholder-text-sec outline-none focus:border-accent-yellow transition-colors"
                    placeholder="Enter title..."
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">
                    Description
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white placeholder-text-sec outline-none focus:border-accent-yellow transition-colors resize-none"
                    placeholder="Enter description..."
                    rows={3}
                  />
                </div>

                {/* Task-specific fields */}
                {editFormData.item_type === "task" && (
                  <>
                    <div>
                      <label className="text-text-sec text-sm mb-2 block">
                        Estimated Minutes
                      </label>
                      <input
                        type="number"
                        value={editFormData.estimated_minutes}
                        onChange={(e) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            estimated_minutes: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white placeholder-text-sec outline-none focus:border-accent-yellow transition-colors"
                        placeholder="Enter estimated minutes..."
                        min="1"
                      />
                    </div>

                    {/* Dependencies — only shown for project tasks */}
                    {editingItem?.project_id && (
                      <div>
                        <label className="text-text-sec text-sm mb-2 block">Dependencies</label>
                        {/* Current deps list */}
                        <div className="space-y-1 mb-2">
                          {editDependencies.length === 0 ? (
                            <p className="text-text-sec text-xs py-1">No dependencies added.</p>
                          ) : (
                            editDependencies.map(depId => {
                              const depTask = tasks.find(t => t.id === depId);
                              return (
                                <div key={depId} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-bg-card border border-border-card rounded-lg">
                                  <span className="text-white text-sm truncate">{depTask?.title ?? depId}</span>
                                  <button
                                    type="button"
                                    onClick={() => setEditDependencies(prev => prev.filter(id => id !== depId))}
                                    className="flex-shrink-0 text-text-sec hover:text-accent-pink transition-colors"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                        {/* Add dep button / picker */}
                        <div className="relative">
                          {!showDepPicker ? (
                            <button
                              type="button"
                              onClick={() => { setShowDepPicker(true); setDepSearch(''); }}
                              className="flex items-center gap-1.5 text-sm text-text-sec hover:text-white transition-colors py-1"
                            >
                              <Plus size={14} />
                              Add dependency
                            </button>
                          ) : (
                            <div className="border border-border-card rounded-lg bg-bg-primary overflow-hidden">
                              <div className="flex items-center gap-2 px-3 py-2 border-b border-border-card">
                                <Search size={14} className="text-text-sec flex-shrink-0" />
                                <input
                                  autoFocus
                                  type="text"
                                  value={depSearch}
                                  onChange={e => setDepSearch(e.target.value)}
                                  placeholder="Search tasks..."
                                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-text-sec"
                                />
                                <button type="button" onClick={() => setShowDepPicker(false)} className="text-text-sec hover:text-white">
                                  <X size={14} />
                                </button>
                              </div>
                              <div className="max-h-40 overflow-y-auto">
                                {tasks
                                  .filter(t =>
                                    t.id !== editingItem?.id &&
                                    t.item_type === 'task' &&
                                    t.project_id === editingItem?.project_id &&
                                    !editDependencies.includes(t.id) &&
                                    !wouldCreateCycle(t.id, editingItem?.id ?? '')
                                  )
                                  .filter(t => t.title.toLowerCase().includes(depSearch.toLowerCase()))
                                  .map(t => (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => { setEditDependencies(prev => [...prev, t.id]); setShowDepPicker(false); setDepSearch(''); }}
                                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-bg-card transition-colors"
                                    >
                                      {t.title}
                                    </button>
                                  ))
                                }
                                {tasks.filter(t =>
                                  t.id !== editingItem?.id &&
                                  t.item_type === 'task' &&
                                  t.project_id === editingItem?.project_id &&
                                  !editDependencies.includes(t.id) &&
                                  !wouldCreateCycle(t.id, editingItem?.id ?? '')
                                ).filter(t => t.title.toLowerCase().includes(depSearch.toLowerCase())).length === 0 && (
                                  <p className="px-3 py-2 text-text-sec text-sm">No tasks available.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* On Hold section */}
                    <div className="border-t border-border-card pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <PauseCircle size={16} className={editOnHold ? 'text-amber-400' : 'text-text-sec'} />
                          <label className="text-sm font-medium text-white">On Hold</label>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setEditOnHold(prev => !prev); setEditOnHoldError(''); }}
                          className={`w-12 h-6 rounded-full transition-colors relative ${editOnHold ? 'bg-amber-500' : 'bg-bg-card border border-border-card'}`}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${editOnHold ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      {editOnHold && (
                        <div className="space-y-3">
                          {/* Type selector */}
                          <div className="flex gap-1.5">
                            {([
                              { value: 'external', label: 'Waiting for something' },
                              { value: 'person', label: 'Waiting for someone' },
                              { value: 'date', label: 'Until a date' },
                            ] as const).map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setEditOnHoldType(opt.value)}
                                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  editOnHoldType === opt.value
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-bg-card text-text-sec hover:text-white border border-border-card'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {/* Reason */}
                          <div>
                            <input
                              type="text"
                              value={editOnHoldReason}
                              onChange={e => { setEditOnHoldReason(e.target.value); if (editOnHoldError) setEditOnHoldError(''); }}
                              placeholder="What are you waiting for?"
                              className={`w-full px-3 py-2 bg-bg-card border rounded-lg text-white text-sm placeholder-text-sec outline-none transition-colors ${editOnHoldError ? 'border-accent-pink' : 'border-border-card focus:border-amber-500'}`}
                            />
                            {editOnHoldError && <p className="text-accent-pink text-xs mt-1">{editOnHoldError}</p>}
                          </div>
                          {/* Until date — only when type = date */}
                          {editOnHoldType === 'date' && (
                            <div>
                              <label className="text-text-sec text-xs mb-1 block">Until date</label>
                              <input
                                type="date"
                                value={editOnHoldUntil}
                                onChange={e => setEditOnHoldUntil(e.target.value)}
                                className="w-full px-3 py-2 bg-bg-card border border-border-card rounded-lg text-white text-sm outline-none focus:border-amber-500 transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Due Date */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.due_date}
                    onChange={(e) => {
                      setEditFormData((prev) => ({
                        ...prev,
                        due_date: e.target.value,
                      }));
                      if (editFormError) setEditFormError("");
                    }}
                    className={`w-full px-4 py-2 bg-bg-card border rounded-lg text-white placeholder-text-sec outline-none transition-colors ${
                      editFormError
                        ? "border-accent-pink"
                        : "border-border-card focus:border-accent-yellow"
                    }`}
                  />
                  {editFormError && (
                    <p className="text-accent-pink text-sm mt-2">
                      {editFormError}
                    </p>
                  )}
                </div>

                {/* Priority */}
                <div className="flex items-center justify-between">
                  <label className="text-text-sec text-sm">Priority</label>
                  <button
                    onClick={() =>
                      setEditFormData((prev) => ({
                        ...prev,
                        priority: !prev.priority,
                      }))
                    }
                    className={`w-12 h-6 rounded-full transition-colors ${
                      editFormData.priority ? "bg-accent-yellow" : "bg-bg-card"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        editFormData.priority
                          ? "translate-x-6"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancelEditItem}
                  className="flex-1 px-4 py-2 bg-bg-card text-text-sec rounded-lg hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditItem}
                  disabled={!editFormData.title.trim()}
                  className="flex-1 px-4 py-2 bg-accent-yellow text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/50 z-[100] overflow-y-auto min-h-screen">
          <div className="bg-bg-primary rounded-2xl p-4 sm:p-6 w-full max-w-md mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Edit Project</h2>
                <button
                  onClick={handleCancelEditProject}
                  className="text-text-sec hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Avatar Preview Section */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <AvatarImage
                    src={project.project_avatar_url}
                    fallbackType="project"
                    fallbackLabel={projectFormData.name || project.name}
                    fallbackColor={projectFormData.color || project.color || undefined}
                    projectId={project.id}
                    size={96}
                    className="shadow-lg border-4 border-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAvatarPicker(true)}
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-bg-card flex items-center justify-center text-white hover:opacity-90 transition-opacity border-2 border-bg-primary"
                  >
                    <Camera size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Project Name */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectFormData.name}
                    onChange={(e) =>
                      setProjectFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white placeholder-text-sec outline-none focus:border-accent-yellow transition-colors"
                    placeholder="Enter project name..."
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">
                    Description
                  </label>
                  <textarea
                    value={projectFormData.description}
                    onChange={(e) =>
                      setProjectFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white placeholder-text-sec outline-none focus:border-accent-yellow transition-colors resize-none"
                    placeholder="Enter description..."
                    rows={3}
                  />
                </div>

                {/* Deadline */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={projectFormData.deadline}
                    onChange={(e) =>
                      setProjectFormData((prev) => ({
                        ...prev,
                        deadline: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white placeholder-text-sec outline-none focus:border-accent-yellow transition-colors"
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">
                    Project Color
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      "#F5C518",
                      "#FF6B6B",
                      "#4ECDC4",
                      "#45B7D1",
                      "#96CEB4",
                      "#FFEAA7",
                      "#DDA0DD",
                      "#98D8C8",
                    ].map((color) => (
                      <button
                        key={color}
                        onClick={() =>
                          setProjectFormData((prev) => ({ ...prev, color }))
                        }
                        className={`w-8 h-8 rounded-full border-2 transition-all relative ${
                          projectFormData.color === color
                            ? "border-white scale-110"
                            : "border-transparent hover:border-white/50"
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {projectFormData.color === color && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Check
                              size={14}
                              className="text-black"
                              strokeWidth={3}
                            />
                          </div>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setProjectFormData((prev) => ({ ...prev, color: "" }))
                      }
                      className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                        !projectFormData.color
                          ? "bg-accent-yellow text-black font-semibold"
                          : "bg-bg-card text-text-sec hover:text-white"
                      }`}
                    >
                      Default
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancelEditProject}
                  className="flex-1 px-4 py-2 bg-bg-card text-text-sec rounded-lg hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-accent-pink text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
                >
                  Delete Project
                </button>
                <button
                  onClick={handleSaveEditProject}
                  disabled={!projectFormData.name.trim()}
                  className="flex-1 px-4 py-2 bg-accent-yellow text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center">
          <div className="bg-bg-card rounded-none p-6 max-w-sm mx-4">
            <h3 className="text-white font-bold text-lg mb-4">
              Delete Project
            </h3>
            <p className="text-text-sec mb-6">
              Are you sure you want to delete this project? This will
              permanently delete all tasks and memories associated with it. This
              action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 border border-border-card rounded-none text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                className="flex-1 py-2 bg-accent-pink rounded-none text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Long-press Menu */}
      {showLongPressMenu && longPressTask && (
        <LongPressMenu task={longPressTask} />
      )}

      {/* Recurrence Info Sheet */}
      {recurrenceSheetTask && (() => {
        const tmpl = recurrenceTemplate;
        const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let patternDesc = '…';
        if (tmpl) {
          if (tmpl.recurrence_type === 'daily') patternDesc = 'Repeats every day';
          else if (tmpl.recurrence_type === 'specific_days' && tmpl.recurrence_days?.length) {
            const names = tmpl.recurrence_days.map((d: number) => DAY_NAMES[d]).join(', ');
            patternDesc = `Repeats every ${names}`;
          } else if (tmpl.recurrence_type === 'interval' && tmpl.recurrence_interval) {
            patternDesc = `Repeats every ${tmpl.recurrence_interval} days`;
          }
        }
        let endDesc = 'No end date';
        if (tmpl?.recurrence_end_date) endDesc = `Ends on ${new Date(tmpl.recurrence_end_date).toLocaleDateString()}`;
        else if (tmpl?.recurrence_end_after) endDesc = `Ends after ${tmpl.recurrence_end_after} times`;
        const missedDesc = tmpl?.recurrence_missed_behavior === 'skip' ? 'Skips missed days' : 'Shows missed days as overdue';

        const handleStopRecurring = async () => {
          const supabase = createClient();
          const today = new Date().toISOString().split('T')[0];
          await supabase
            .from('tasks')
            .update({ recurrence_end_date: today })
            .eq('id', recurrenceSheetTask.recurrence_parent_id!);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          setShowStopRecurringConfirm(false);
          setRecurrenceSheetTask(null);
        };

        return (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-end" onClick={() => { setRecurrenceSheetTask(null); setShowStopRecurringConfirm(false); }}>
            <div className="bg-bg-card w-full rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <RefreshCw size={18} className="text-accent-yellow" />
                  <h3 className="text-white text-lg font-semibold">Recurring Task</h3>
                </div>
                <button onClick={() => { setRecurrenceSheetTask(null); setShowStopRecurringConfirm(false); }} className="text-text-sec hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-border-card">
                  <span className="text-text-sec text-sm">Pattern</span>
                  <span className="text-white text-sm font-medium">{patternDesc}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border-card">
                  <span className="text-text-sec text-sm">End</span>
                  <span className="text-white text-sm font-medium">{endDesc}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border-card">
                  <span className="text-text-sec text-sm">If missed</span>
                  <span className="text-white text-sm font-medium">{missedDesc}</span>
                </div>
              </div>

              {!showStopRecurringConfirm ? (
                <button
                  onClick={() => setShowStopRecurringConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 bg-red-500/20 text-red-400 p-4 rounded-2xl hover:bg-red-500/30 transition-colors"
                >
                  <StopCircle size={18} />
                  <span className="font-medium">Stop recurring</span>
                </button>
              ) : (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
                  <p className="text-white text-sm font-medium mb-1">Stop this recurring task?</p>
                  <p className="text-text-sec text-xs mb-4">No new occurrences will be created. Existing tasks remain untouched.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowStopRecurringConfirm(false)}
                      className="flex-1 py-2.5 border border-border-card rounded-xl text-text-sec hover:text-white transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleStopRecurring}
                      className="flex-1 py-2.5 bg-red-500 rounded-xl text-white font-semibold text-sm hover:bg-red-600 transition-colors"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Project Avatar Picker */}
      {showAvatarPicker && (
        <ProjectAvatarPicker
          projectId={project.id}
          currentAvatarUrl={project.project_avatar_url}
          onClose={() => setShowAvatarPicker(false)}
          onAvatarChanged={() => {
            queryClient.invalidateQueries({
              queryKey: ["project", project.id],
            });
            queryClient.invalidateQueries({
              queryKey: ["projects"],
            });
          }}
        />
      )}
    </div>
  );
}
