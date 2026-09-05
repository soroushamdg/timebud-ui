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
import { useTasks, useUpdateTask } from "@/hooks/useTasks";
import { useProject, useDeleteProject } from "@/hooks/useProjects";
import { AppShell } from "@/components/layout/AppShell";
import { AvatarImage } from "@/components/ui/AvatarImage";
import { ProjectAvatarPicker } from "@/components/avatars/ProjectAvatarPicker";
import { formatLocal, formatLocalSmart, parseDateLocal, describeRecurrence } from "@/lib/dates";
import { DbTask, TaskStatus, MissionDifficulty } from "@/types/database";
import { RecurrenceEditor, RecurrenceValue, defaultRecurrenceValue, recurrenceValueFromTask, recurrenceValueToFields } from "@/components/tasks/RecurrenceEditor";
import { RecurringBadge } from "@/components/tasks/RecurringBadge";
import { TaskCardSkeleton } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMemories, useDeleteMemory } from "@/hooks/useMemories";
import { useProjectTimeStats } from "@/hooks/useSessions";
import { formatDistanceToNow } from "date-fns";
import { GanttChart } from "@/components/gantt/GanttChart";
import { getJobXpPreview, MISSION_COMPLETE_BONUS_XP } from "@/lib/gamification/xp";
import { useLevelUpWatcher } from "@/hooks/useLevelUpWatcher";
import { useProjectCalendarLink } from "@/hooks/useProjectCalendarLink";
import { LevelUpModal } from "@/components/gamification/LevelUpModal";
import { MissionCompleteModal } from "@/components/gamification/MissionCompleteModal";

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
  const dueDate = parseDateLocal(deadline);
  return dueDate < today;
};

// Today detection helper
const isToday = (deadline: string | null | undefined): boolean => {
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = parseDateLocal(deadline);
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
  const quickAddRowRef = useRef<HTMLDivElement>(null);
  const [quickAddRecurrence, setQuickAddRecurrence] = useState<RecurrenceValue>(defaultRecurrenceValue());
  const [showQuickAddRecurrence, setShowQuickAddRecurrence] = useState(false);

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

  // Recurrence state (edit modal)
  const [editRecurrence, setEditRecurrence] = useState<RecurrenceValue>(defaultRecurrenceValue());

  // Recurrence info sheet state
  const [recurrenceSheetTask, setRecurrenceSheetTask] = useState<DbTask | null>(null);
  const [recurrenceTemplate, setRecurrenceTemplate] = useState<DbTask | null>(null);
  const [showStopRecurringConfirm, setShowStopRecurringConfirm] = useState(false);

  // When recurrence sheet opens, use the task itself (single-instance model)
  useEffect(() => {
    if (!recurrenceSheetTask?.recurrence_type) {
      setRecurrenceTemplate(null);
    } else {
      setRecurrenceTemplate(recurrenceSheetTask);
    }
  }, [recurrenceSheetTask]);

  // Project edit state
  const [projectFormData, setProjectFormData] = useState({
    name: "",
    description: "",
    deadline: "",
    color: "",
    difficulty: "medium" as MissionDifficulty,
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

  // Handle click outside to finish creation — scoped to the whole quick-add row (not just
  // the text input) so clicking the recurrence toggle/popover inside it doesn't
  // prematurely submit the in-progress title.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickAddRowRef.current && !quickAddRowRef.current.contains(e.target as Node)) {
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
  const { data: timeStats } = useProjectTimeStats(projectId);
  const { data: memories = [] } = useMemories(projectId);
  const { data: isCalendarLinked } = useProjectCalendarLink(projectId);
  const deleteMemory = useDeleteMemory();
  const deleteProject = useDeleteProject();
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const updateTask = useUpdateTask();
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
        difficulty: project.difficulty || "medium",
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

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expired = tasks.filter(
      t =>
        t.on_hold === true &&
        t.on_hold_type === 'until_date' &&
        t.on_hold_until != null &&
        parseDateLocal(t.on_hold_until) <= today,
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

  // Parallax scroll effect. Listens on the capture phase so this also picks up
  // scroll events from the desktop app-box (which scrolls internally, since
  // window itself no longer scrolls once the app is framed) as well as the
  // window scroll used on mobile.
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target;
      const y = target instanceof HTMLElement ? target.scrollTop : window.scrollY;
      setScrollY(y);
    };

    document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
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

  // Calculate progress — exclude milestones and on_hold tasks
  const activeTasks = tasks.filter(
    (t) => t.item_type === "task" && !t.on_hold,
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
  // Mirrors the tasks_award_xp DB trigger's math (same per-job multiplier, same
  // one-time mission bonus) purely for display — the persisted xp_total is the
  // real source of truth, this just previews what this mission has earned.
  const earnedXp = project
    ? completedTaskCount * getJobXpPreview(project.difficulty) +
      (project.mission_bonus_awarded ? MISSION_COMPLETE_BONUS_XP : 0)
    : 0;

  // Time invested: real minutes logged from every run this project has appeared in
  // (see useProjectTimeStats) against the plan currently on the board — works the same
  // whether the project is still active or already marked finished.
  const spentMinutes = timeStats?.actualMinutes ?? 0;
  const plannedTotalMinutes = activeTasks.reduce(
    (sum, t) => sum + (t.estimated_minutes ?? 0),
    0,
  );
  const formatTimeStat = (minutes: number): string => {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${minutes}m`;
  };

  // Mission-complete celebration: fires once when progress crosses into 100% during
  // this session (not on initial load, and not while `tasks` is still loading — priming
  // the baseline before the real task list arrives would see a false totalTaskCount===0
  // "incomplete" state and then wrongly fire the moment real data lands on an already-
  // complete mission). The durable XP bonus itself already came from the Phase 2 DB
  // trigger; this only decides when to show the modal.
  const wasCompleteRef = useRef<boolean | null>(null);
  const [showMissionComplete, setShowMissionComplete] = useState(false);
  useEffect(() => {
    if (tasksLoading) return
    const isComplete = totalTaskCount > 0 && progressPercentage === 100
    if (wasCompleteRef.current === null) {
      wasCompleteRef.current = isComplete
      return
    }
    if (isComplete && !wasCompleteRef.current) {
      setShowMissionComplete(true)
    }
    wasCompleteRef.current = isComplete
  }, [totalTaskCount, progressPercentage, tasksLoading]);

  const { newLevel, dismiss: dismissLevelUp } = useLevelUpWatcher();

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
              await updateTask.mutateAsync({ id: swipedTask.id, status: 'completed' });
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
  }, [swipedTask, swipeDirection, swipeDistance, updateTask, queryClient, longPressTimer, isLocked]);

  // Long-press handlers
  const handleLongPressAction = useCallback(async (action: 'complete' | 'priority' | 'delete', task: DbTask) => {
    console.log('Long-press action:', { action, task: task.title });
    
    try {
      if (action === 'complete') {
        if (!isLocked(task)) {
          await updateTask.mutateAsync({ id: task.id, status: 'completed' });
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
        await updateTask.mutateAsync({ id: task.id, status: 'completed' });
        setSwipedTask(null);
        setSwipeDirection(null);
        setSwipeDistance(0);
      } catch (error) {
        console.error("Failed to complete task:", error);
      }
    },
    [updateTask],
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
          await updateTask.mutateAsync({ id: task.id, status: "completed" });
        }
      } catch (error) {
        console.error("Failed to toggle task status:", error);
      }
    },
    [isLocked, updateTask],
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
    setQuickAddRecurrence(defaultRecurrenceValue());
    setShowQuickAddRecurrence(false);
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
      const isRecurring = itemType === "task" && quickAddRecurrence.isRecurring;

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
        // A recurring task needs a due date to anchor its next occurrence from.
        due_date: isRecurring ? new Date().toISOString().split('T')[0] : null,
        ...(itemType === "task" ? recurrenceValueToFields(quickAddRecurrence) : {}),
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
      setQuickAddRecurrence(defaultRecurrenceValue());
      setShowQuickAddRecurrence(false);
    }
  }, [
    newItemTitle,
    creatingTask,
    creatingMilestone,
    quickAddRecurrence,
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
        setQuickAddRecurrence(defaultRecurrenceValue());
        setShowQuickAddRecurrence(false);
      }
    },
    [handleFinishCreation],
  );

  // Shared row for both quick-add render sites (empty state and regular list) so the
  // recurrence toggle/popover only needs to be built once.
  const renderQuickAddInput = () => (
    <div
      ref={quickAddRowRef}
      className="mb-3 rounded-2xl px-4 py-3 border border-border-card bg-bg-card"
    >
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-bg-card text-text-primary">
          {creatingTask ? "J" : "O"}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Enter ${creatingTask ? "job" : "objective"} name...`}
          className="flex-1 bg-transparent text-text-primary placeholder-text-sec outline-none text-base font-semibold"
        />
        {creatingTask && (
          <button
            type="button"
            onClick={() => setShowQuickAddRecurrence((v) => !v)}
            title="Recurring"
            className={`flex-shrink-0 transition-colors ${
              quickAddRecurrence.isRecurring ? "text-accent-yellow" : "text-text-sec hover:text-text-primary"
            }`}
          >
            <RefreshCw size={16} />
          </button>
        )}
        <div className="text-text-sec text-sm">
          {creatingTask ? "Job" : "Objective"}
        </div>
      </div>
      {creatingTask && showQuickAddRecurrence && (
        <div className="mt-3 pt-3 border-t border-border-card">
          <RecurrenceEditor
            value={quickAddRecurrence}
            onChange={setQuickAddRecurrence}
            compact
          />
        </div>
      )}
    </div>
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
    // Populate recurrence state
    setEditRecurrence(recurrenceValueFromTask(item));
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
      const itemDeadline = parseDateLocal(editFormData.due_date);
      const projectDeadline = parseDateLocal(project.deadline);

      if (itemDeadline > projectDeadline) {
        setEditFormError(
          `${
            editFormData.item_type === "milestone" ? "Objective" : "Job"
          } deadline cannot be after mission deadline (${parseDateLocal(
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
        // Recurrence fields
        Object.assign(updateData, recurrenceValueToFields(editRecurrence));
      } else {
        // Milestone-specific
        updateData.status = null;
        updateData.estimated_minutes = null;
      }

      // Add due date (null if cleared) — a recurring task needs one to anchor its next
      // occurrence from, so default to today if the user turned recurrence on without picking one.
      const trimmedDueDate = editFormData.due_date.trim();
      updateData.due_date = trimmedDueDate
        ? trimmedDueDate
        : editFormData.item_type === "task" && editRecurrence.isRecurring
        ? new Date().toISOString().split('T')[0]
        : null;

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
  }, [editingItem, editFormData, project, queryClient, editDependencies, editOnHold, editOnHoldType, editOnHoldReason, editOnHoldUntil, editRecurrence]);

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
    setEditRecurrence(defaultRecurrenceValue());
  }, []);

  // Project edit handlers
  const handleStartEditProject = useCallback(() => {
    if (project) {
      setProjectFormData({
        name: project.name,
        description: project.description || "",
        deadline: formatDateForInput(project.deadline),
        color: project.color || "",
        difficulty: project.difficulty || "medium",
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
          difficulty: projectFormData.difficulty,
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
          <div className="mt-4 mb-2 mx-1 px-4 py-2.5 rounded-xl bg-accent-yellow/10 border border-accent-yellow/25 flex items-center gap-2.5">
            <div className="w-2 h-2 bg-accent-yellow rotate-45 flex-shrink-0" />
            <span
              className="flex-1 min-w-0 truncate text-accent-yellow text-sm font-bold uppercase tracking-wide cursor-pointer hover:text-text-primary transition-colors"
              onClick={() => handleMilestoneClick(item)}
            >
              {item.title}
            </span>
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

      // Visual-only nesting: does this job fall after an objective in the base
      // manual order? Purely a display cue — no change to sortedItems/reorder math.
      const baseIndex = sortedItems.findIndex((i) => i.id === item.id);
      let isNestedUnderObjective = false;
      for (let i = baseIndex - 1; i >= 0; i--) {
        if (sortedItems[i].item_type === "milestone") {
          isNestedUnderObjective = true;
          break;
        }
      }

      return (
        <div key={item.id} className={`relative ${isNestedUnderObjective ? "pl-3" : ""}`}>
          {isNestedUnderObjective && (
            <div className="absolute left-1 top-0 bottom-3 w-px bg-accent-yellow/20" />
          )}
          {/* Swipe action backgrounds (mobile only) */}
          {isMobile && isCurrentlySwipedTask && swipeDistance > 50 && (
            <>
              {swipeDirection === "right" && (
                <div className="absolute inset-0 bg-accent-green rounded-2xl flex items-center justify-start px-4">
                  <div className="flex items-center gap-2">
                    {completed ? (
                      <>
                        <X size={20} className="text-on-dark-accent" />
                        <span className="text-on-dark-accent font-semibold">
                          {swipeDistance > 150 ? "Release to Undo" : "Undo"}
                        </span>
                      </>
                    ) : (
                      <>
                        <Check size={20} className="text-on-dark-accent" />
                        <span className="text-on-dark-accent font-semibold">
                          {swipeDistance > 150 ? "Release to Complete" : "Complete"}
                        </span>
                      </>
                    )}
                  </div>
                  {!completed && swipeDistance < 150 && !locked && (
                    <button
                      onClick={() => handleTogglePriority(item)}
                      className="ml-4 bg-accent-yellow text-on-light-accent px-3 py-1 rounded-lg text-sm font-semibold"
                    >
                      {item.priority ? "Normal" : "Priority"}
                    </button>
                  )}
                </div>
              )}
              {swipeDirection === "left" && (
                <div className="absolute inset-0 bg-accent-pink rounded-2xl flex items-center justify-end px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-on-dark-accent font-semibold">
                      {swipeDistance > 150 ? "Release to Delete" : "Delete"}
                    </span>
                    <Trash2 size={20} className="text-on-dark-accent" />
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
              mb-3 rounded-2xl px-4 py-3 flex items-center gap-3 border transition-all relative z-10 shadow-[0_4px_16px_rgba(0,0,0,0.35)]
              ${
                completed
                  ? "bg-bg-card-done border-accent-green/30"
                  : onHold
                  ? "bg-bg-card border-status-onhold-surface/30 opacity-70"
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
                className="w-6 h-6 rounded-md flex-shrink-0 accent-accent-yellow cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />
            ) : (
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                  ${
                    completed
                      ? "bg-accent-green text-on-dark-accent"
                      : locked
                      ? "bg-bg-card-locked text-text-sec"
                      : "bg-bg-card text-text-primary"
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
                    locked || onHold ? "text-text-sec" : "text-text-primary"
                  }`}
                >
                  {item.title}
                </h3>
                <RecurringBadge
                  task={item}
                  onClick={(e) => { e.stopPropagation(); setRecurrenceSheetTask(item); }}
                  iconOnly
                />
                {onHold && (
                  <span className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-status-onhold-surface/20 text-status-onhold-text">
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
              {(() => {
                const spent = timeStats?.perTask.get(item.id);
                return (
                  (spent || item.estimated_minutes) && (
                    <p className="text-sm mt-1">
                      {spent && (
                        <span className="text-accent-green font-medium">{spent}m spent</span>
                      )}
                      {spent && item.estimated_minutes && (
                        <span className="text-text-sec"> &middot; </span>
                      )}
                      {item.estimated_minutes && (
                        <span className="text-text-sec">Estimated: {item.estimated_minutes} min</span>
                      )}
                    </p>
                  )
                );
              })()}
            </div>

            {/* Deadline in trailing position */}
            {item.due_date && (
              <div className="flex-shrink-0 flex items-center gap-2 ml-3">
                <span className={`text-sm font-medium ${isOverdue(item.due_date) && !completed ? 'text-status-overdue font-semibold' : isToday(item.due_date) && !completed ? 'text-status-today font-semibold' : 'text-text-sec'}`}>
                  {formatLocalSmart(item.due_date)}
                </span>
                {isOverdue(item.due_date) && !completed && (
                  <span className="px-1.5 py-0.5 bg-status-overdue text-on-dark-accent text-xs font-bold rounded">
                    OVERDUE
                  </span>
                )}
                {!isOverdue(item.due_date) && isToday(item.due_date) && !completed && (
                  <span className="px-1.5 py-0.5 bg-status-today text-on-dark-accent text-xs font-bold rounded">
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
                <div className="relative">
                  <button
                    onClick={(e) => handleTaskMenuToggle(item.id, e)}
                    className="p-1.5 rounded-lg bg-accent-pink/20 text-accent-pink hover:bg-accent-pink/30 transition-colors"
                    title="More options"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {/* Dropdown menu */}
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-2 w-36 bg-bg-card border border-border-card rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-50 overflow-hidden p-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(item);
                        }}
                        className="w-full px-3 py-2.5 text-left text-accent-pink hover:bg-accent-pink/10 rounded-xl transition-colors flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
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
      <div className="fixed inset-x-0 bg-scrim/50 z-[100] flex items-end"
        style={{ top: scrollY, height: '100vh' }} onClick={handleCancelLongPress}>
        <div className="bg-bg-card w-full rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-text-primary text-lg font-semibold">{task.title}</h3>
            <button
              onClick={handleCancelLongPress}
              className="text-text-sec hover:text-text-primary transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="space-y-3">
            {completed ? (
              <button
                onClick={() => handleLongPressAction('complete', task)}
                className="w-full flex items-center gap-3 bg-action-undo/20 text-action-undo p-4 rounded-2xl hover:bg-action-undo/30 transition-colors"
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
                  <span className="font-medium">Complete Job</span>
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
              className="w-full flex items-center gap-3 bg-accent-pink/20 text-accent-pink p-4 rounded-2xl hover:bg-accent-pink/30 transition-colors"
            >
              <Trash2 size={20} />
              <span className="font-medium">Delete Job</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (projectLoading || tasksLoading || !project) {
    return (
      <AppShell showTabBar={false}>
        {/* Hero skeleton */}
        <div className="relative h-48 bg-skeleton animate-pulse" />

        {/* Task skeletons */}
        <div className="p-4 space-y-3">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell showTabBar={false}>
      {/* Edit Toast */}
      {showEditToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-bg-card border border-border-card rounded-lg shadow-lg transition-all duration-300">
          <p className="text-text-sec text-sm">
            Double-click to edit job or objective
          </p>
        </div>
      )}

      {/* Header */}
      <div className="relative">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-xl bg-bg-card border border-border-card flex items-center justify-center text-text-primary hover:bg-opacity-80 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Gantt toggle button */}
        <button
          onClick={() => setShowGantt(g => !g)}
          className={`absolute top-4 right-4 z-10 px-3 py-1 bg-bg-card rounded-full text-sm flex items-center gap-1 transition-colors ${
            showGantt ? 'text-accent-yellow border border-accent-yellow/40' : 'text-text-sec'
          }`}
          title={showGantt ? 'Show job list' : 'Show timeline'}
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
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-scrim/50 backdrop-blur-sm flex items-center justify-center text-on-dark-accent hover:bg-scrim/70 transition-colors"
            >
              <Camera size={20} />
            </button>
          </div>
          {/* bg-primary (not scrim) so this legibility fade tracks the theme: identical
              black in dark mode, but a soft off-white fade in light mode instead of the
              always-black scrim muddying the avatar's brand color underneath. */}
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/95 via-bg-primary/70 to-transparent" />

          {/* Hero content */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-text-primary">
                {project.name}
              </h1>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${
                project.difficulty === 'hard' ? 'bg-accent-pink/90 text-on-dark-accent shadow-[0_0_8px_rgba(232,0,77,0.5)]'
                  : project.difficulty === 'easy' ? 'bg-accent-green/90 text-on-light-accent shadow-[0_0_8px_rgba(46,204,113,0.5)]'
                  : 'bg-accent-yellow/90 text-on-light-accent shadow-[0_0_8px_rgba(245,197,24,0.5)]'
              }`}>
                {project.difficulty}
              </span>
              {isCalendarLinked && (
                <div
                  className="w-5 h-5 rounded-full bg-accent-yellow/90 flex items-center justify-center flex-shrink-0 shadow-[0_0_8px_rgba(245,197,24,0.5)]"
                  title="Linked to a calendar time block"
                >
                  <CalendarIcon className="w-3 h-3 text-on-light-accent" />
                </div>
              )}
            </div>
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-3">
                {totalTaskCount > 0 && (
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="var(--color-border-card)" strokeWidth="6" />
                      <circle
                        cx="32" cy="32" r="28" fill="none"
                        stroke="var(--color-accent-yellow)" strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 28}
                        strokeDashoffset={2 * Math.PI * 28 * (1 - progressPercentage / 100)}
                        style={{ filter: 'drop-shadow(0 0 5px rgba(245,197,24,0.6))', transition: 'stroke-dashoffset 0.4s ease' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base font-bold text-text-primary">{progressPercentage}%</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  {earnedXp > 0 && (
                    <div className="text-xs font-bold text-accent-yellow">
                      {earnedXp} XP earned
                    </div>
                  )}
                  {onHoldCount > 0 && (
                    <div className="text-xs text-text-sec">
                      {onHoldCount} on hold
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-text-sec text-xs uppercase">DUE DATE</div>
                <div className="text-text-primary text-sm">
                  {project.deadline
                    ? formatLocalSmart(project.deadline)
                    : "No deadline"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time invested — real minutes logged across every run this project has
       * appeared in, against what's currently planned. Works the same for a
       * finished project since it's a plain sum over past logs. */}
      {(spentMinutes > 0 || plannedTotalMinutes > 0) && (
        <div className="px-4 pt-4">
          <div className="bg-bg-card rounded-2xl border border-border-card p-4">
            <div className="text-text-sec text-[11px] font-bold uppercase tracking-wider mb-3">
              Time Invested
            </div>
            <div className="flex items-center gap-6 mb-3">
              <div>
                <div className="text-accent-green text-xl font-bold font-mono tabular-nums">
                  {formatTimeStat(spentMinutes)}
                </div>
                <div className="text-text-sec text-[11px] mt-0.5">spent so far</div>
              </div>
              <div>
                <div className="text-text-primary text-xl font-bold font-mono tabular-nums">
                  {formatTimeStat(plannedTotalMinutes)}
                </div>
                <div className="text-text-sec text-[11px] mt-0.5">planned total</div>
              </div>
            </div>
            {plannedTotalMinutes > 0 && (
              <div className="h-2 rounded-full bg-progress-track border border-border-card overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-green to-accent-yellow"
                  style={{ width: `${Math.min(100, Math.round((spentMinutes / plannedTotalMinutes) * 100))}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sort Dialog */}
      {showSortOptions && (
        <div className="fixed inset-x-0 bg-scrim/50 flex items-center justify-center z-[100] p-4"
          style={{ top: scrollY, height: '100vh' }}>
          <div className="bg-bg-primary rounded-2xl w-full max-w-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-text-primary">Sort Items</h2>
                <button
                  onClick={() => setShowSortOptions(false)}
                  className="text-text-sec hover:text-text-primary transition-colors"
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
                      ? "bg-accent-yellow text-on-light-accent font-semibold"
                      : "bg-bg-card text-text-primary hover:bg-bg-card-hover border border-border-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ArrowUpDown
                      size={18}
                      className={
                        sortMode === "manual" ? "text-on-light-accent" : "text-text-sec"
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
                      ? "bg-accent-yellow text-on-light-accent font-semibold"
                      : "bg-bg-card text-text-primary hover:bg-bg-card-hover border border-border-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CalendarIcon
                      size={18}
                      className={
                        sortMode === "deadline" ? "text-on-light-accent" : "text-text-sec"
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

      {/* Bud cameo — reacts to how this mission is going, scrolls with the page so it
          never sits on top of the job list's checkboxes */}
      {!showGantt && totalTaskCount > 0 && (
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bud/bud-avatar.png"
            alt="Bud"
            className="w-9 h-9 rounded-full border-2 border-accent-yellow flex-shrink-0 object-cover"
          />
          <div className="bg-bg-card border border-border-card text-text-primary text-xs font-medium px-3 py-2 rounded-2xl rounded-bl-sm">
            {progressPercentage === 100
              ? "Mission complete. That's how it's done."
              : progressPercentage >= 75
              ? "Almost there. Don't stop now."
              : progressPercentage >= 40
              ? 'Solid pace. Keep grinding.'
              : "Every job counts. Let's go."}
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`pb-20 ${showGantt ? 'hidden' : ''}`}>
        {sortedItems.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <div className="w-8 h-8 border border-accent-yellow rotate-45 mb-3" />
            <h3 className="text-text-primary text-lg font-semibold mt-3">
              No tasks yet
            </h3>
            <p className="text-text-sec text-sm mt-1">
              Tap + to add your first task or milestone
            </p>

            {/* Add buttons in empty state */}
            <div className="mt-8 w-full space-y-3">
              <button
                onClick={() => handleStartCreation("task")}
                className="w-full px-4 py-3 flex items-center justify-center gap-3 text-text-sec hover:text-text-primary transition-colors"
              >
                <Plus size={20} className="flex-shrink-0" />
                <span className="text-base">Add new job</span>
              </button>
              <button
                onClick={() => handleStartCreation("milestone")}
                className="w-full px-4 py-3 flex items-center justify-center gap-3 text-text-sec hover:text-text-primary transition-colors"
              >
                <Plus size={20} className="flex-shrink-0" />
                <span className="text-base">Add new objective</span>
              </button>
            </div>

            {/* Inline creation input in empty state */}
            {(creatingTask || creatingMilestone) && (
              <div className="mt-4 w-full">{renderQuickAddInput()}</div>
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
              {(creatingTask || creatingMilestone) && renderQuickAddInput()}

              {/* Add buttons */}
              {!creatingTask && !creatingMilestone && (
                <>
                  <button
                    onClick={() => handleStartCreation("task")}
                    className="w-full px-4 py-3 flex items-center gap-3 text-text-sec hover:text-text-primary transition-colors"
                  >
                    <Plus size={20} className="flex-shrink-0" />
                    <span className="text-base">Add new job</span>
                  </button>
                  <button
                    onClick={() => handleStartCreation("milestone")}
                    className="w-full px-4 py-3 flex items-center gap-3 text-text-sec hover:text-text-primary transition-colors"
                  >
                    <Plus size={20} className="flex-shrink-0" />
                    <span className="text-base">Add new objective</span>
                  </button>
                </>
              )}
            </div>

            {/* Memories Section */}
            <div className="mt-8 px-6 pb-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-bold text-text-primary">Memories</h3>
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
                          <p className="text-text-primary text-sm mb-2">
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
                              className="text-text-sec text-xs font-semibold hover:text-text-primary transition-colors"
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

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-x-0 bg-scrim/50 flex items-center justify-center z-[100] p-4"
          style={{ top: scrollY, height: '100vh' }}>
          <div className="bg-bg-primary rounded-2xl border border-border-card w-full max-w-md max-h-[85vh] overflow-y-auto shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-text-primary">
                  Edit {editingItem.item_type === "milestone" ? "Objective" : "Job"}
                </h2>
                <button
                  onClick={handleCancelEditItem}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-text-sec hover:text-text-primary hover:bg-bg-card transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Type Toggle */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">
                    Type
                  </label>
                  <div className="bg-bg-card rounded-2xl p-1 flex">
                    <button
                      onClick={() =>
                        setEditFormData((prev) => ({
                          ...prev,
                          item_type: "task",
                        }))
                      }
                      className={`flex-1 px-4 py-2 rounded-xl transition-colors ${
                        editFormData.item_type === "task"
                          ? "bg-accent-yellow text-on-light-accent font-bold"
                          : "text-text-sec hover:text-text-primary"
                      }`}
                    >
                      Job
                    </button>
                    <button
                      onClick={() =>
                        setEditFormData((prev) => ({
                          ...prev,
                          item_type: "milestone",
                        }))
                      }
                      className={`flex-1 px-4 py-2 rounded-xl transition-colors ${
                        editFormData.item_type === "milestone"
                          ? "bg-accent-yellow text-on-light-accent font-bold"
                          : "text-text-sec hover:text-text-primary"
                      }`}
                    >
                      Objective
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
                    className="w-full px-5 py-3.5 bg-bg-card border border-border-card rounded-2xl text-text-primary placeholder-text-sec outline-none focus:border-accent-yellow transition-colors"
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
                    className="w-full px-5 py-3.5 bg-bg-card border border-border-card rounded-2xl text-text-primary placeholder-text-sec outline-none focus:border-accent-yellow transition-colors resize-none"
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
                        className="w-full px-5 py-3.5 bg-bg-card border border-border-card rounded-2xl text-text-primary placeholder-text-sec outline-none focus:border-accent-yellow transition-colors"
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
                                <div key={depId} className="flex items-center justify-between gap-2 px-4 py-2 bg-bg-card border border-border-card rounded-2xl">
                                  <span className="text-text-primary text-sm truncate">{depTask?.title ?? depId}</span>
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
                              className="flex items-center gap-1.5 text-sm text-text-sec hover:text-text-primary transition-colors py-1"
                            >
                              <Plus size={14} />
                              Add dependency
                            </button>
                          ) : (
                            <div className="border border-border-card rounded-2xl bg-bg-primary overflow-hidden">
                              <div className="flex items-center gap-2 px-3 py-2 border-b border-border-card">
                                <Search size={14} className="text-text-sec flex-shrink-0" />
                                <input
                                  autoFocus
                                  type="text"
                                  value={depSearch}
                                  onChange={e => setDepSearch(e.target.value)}
                                  placeholder="Search jobs..."
                                  className="flex-1 bg-transparent text-text-primary text-sm outline-none placeholder-text-sec"
                                />
                                <button type="button" onClick={() => setShowDepPicker(false)} className="text-text-sec hover:text-text-primary">
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
                                      className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-card transition-colors"
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
                    <div className="bg-bg-card border border-border-card rounded-2xl px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PauseCircle size={16} className={editOnHold ? 'text-status-onhold-text' : 'text-text-sec'} />
                          <label className="text-sm font-medium text-text-primary">On Hold</label>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setEditOnHold(prev => !prev); setEditOnHoldError(''); }}
                          className={`w-14 h-7 rounded-full transition-colors relative border-2 ${editOnHold ? 'bg-status-onhold-surface border-status-onhold-surface' : 'bg-border-card border-border-card'}`}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 bg-toggle-thumb rounded-full transition-transform shadow-sm ${editOnHold ? 'translate-x-7' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      {editOnHold && (
                        <div className="space-y-3 mt-4">
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
                                className={`flex-1 px-2 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                                  editOnHoldType === opt.value
                                    ? 'bg-status-onhold-surface text-on-dark-accent'
                                    : 'bg-bg-primary text-text-sec hover:text-text-primary border border-border-card'
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
                              className={`w-full px-4 py-2.5 bg-bg-primary border rounded-xl text-text-primary text-sm placeholder-text-sec outline-none transition-colors ${editOnHoldError ? 'border-accent-pink' : 'border-border-card focus:border-status-onhold-surface'}`}
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
                                className="w-full px-4 py-2.5 bg-bg-primary border border-border-card rounded-xl text-text-primary text-sm outline-none focus:border-status-onhold-surface transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Recurrence */}
                    <RecurrenceEditor value={editRecurrence} onChange={setEditRecurrence} />
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
                    className={`w-full px-5 py-3.5 bg-bg-card border rounded-2xl text-text-primary placeholder-text-sec outline-none transition-colors ${
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
                <div className="flex items-center justify-between bg-bg-card border border-border-card rounded-2xl px-5 py-4">
                  <div className="flex items-center gap-2">
                    <ChevronDoubleUpIcon className="w-4 h-4 text-accent-yellow" />
                    <span className="text-text-primary font-medium">Priority</span>
                  </div>
                  <button
                    onClick={() =>
                      setEditFormData((prev) => ({
                        ...prev,
                        priority: !prev.priority,
                      }))
                    }
                    className={`w-14 h-7 rounded-full transition-all duration-200 relative border-2 ${
                      editFormData.priority ? "bg-accent-yellow border-accent-yellow" : "bg-border-card border-border-card"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 bg-toggle-thumb rounded-full transition-transform duration-200 shadow-sm ${
                        editFormData.priority
                          ? "translate-x-7"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancelEditItem}
                  className="flex-1 py-3 bg-bg-card text-text-primary font-medium rounded-xl hover:bg-bg-card-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditItem}
                  disabled={!editFormData.title.trim()}
                  className="flex-1 py-3 bg-accent-yellow text-on-light-accent font-bold rounded-xl hover:bg-accent-yellow-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(245,197,24,0.35)]"
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
        <div className="fixed inset-x-0 bg-scrim/50 flex items-center justify-center z-[100] p-4"
          style={{ top: scrollY, height: '100vh' }}>
          <div className="bg-bg-primary rounded-2xl border border-border-card w-full max-w-md max-h-[85vh] overflow-y-auto shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-text-primary">Edit Mission</h2>
                <button
                  onClick={handleCancelEditProject}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-text-sec hover:text-text-primary hover:bg-bg-card transition-colors"
                >
                  <X size={20} />
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
                    className="shadow-lg border-4 border-avatar-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAvatarPicker(true)}
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-bg-card flex items-center justify-center text-text-primary hover:opacity-90 transition-opacity border-2 border-bg-primary"
                  >
                    <Camera size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Mission Name */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">
                    Mission Name
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
                    className="w-full px-5 py-3.5 bg-bg-card border border-border-card rounded-2xl text-text-primary placeholder-text-sec outline-none focus:border-accent-yellow transition-colors"
                    placeholder="Enter mission name..."
                  />
                </div>

                {/* Difficulty */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">
                    Difficulty
                  </label>
                  <div className="bg-bg-card rounded-2xl p-1 flex">
                    {(["easy", "medium", "hard"] as MissionDifficulty[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setProjectFormData((prev) => ({ ...prev, difficulty: d }))}
                        className={`flex-1 px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${
                          projectFormData.difficulty === d
                            ? "bg-accent-yellow text-on-light-accent"
                            : "text-text-sec hover:text-text-primary"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
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
                    className="w-full px-5 py-3.5 bg-bg-card border border-border-card rounded-2xl text-text-primary placeholder-text-sec outline-none focus:border-accent-yellow transition-colors resize-none"
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
                    className="w-full px-5 py-3.5 bg-bg-card border border-border-card rounded-2xl text-text-primary placeholder-text-sec outline-none focus:border-accent-yellow transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70"
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">
                    Mission Color
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
                        className={`w-9 h-9 rounded-full border-2 transition-all relative ${
                          projectFormData.color === color
                            ? "border-cta-outline scale-110 shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                            : "border-transparent hover:border-cta-outline/50"
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {projectFormData.color === color && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Check
                              size={14}
                              className="text-on-light-accent"
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        !projectFormData.color
                          ? "bg-accent-yellow text-on-light-accent font-bold"
                          : "bg-bg-card text-text-sec hover:text-text-primary"
                      }`}
                    >
                      Default
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <button
                  onClick={handleCancelEditProject}
                  className="flex-1 py-3 bg-bg-card text-text-primary font-medium rounded-xl hover:bg-bg-card-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="py-3 px-4 bg-accent-pink/15 border border-accent-pink text-accent-pink font-bold rounded-xl hover:bg-accent-pink/25 transition-colors"
                >
                  Delete Mission
                </button>
                <button
                  onClick={handleSaveEditProject}
                  disabled={!projectFormData.name.trim()}
                  className="flex-1 py-3 bg-accent-yellow text-on-light-accent font-bold rounded-xl hover:bg-accent-yellow-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(245,197,24,0.35)]"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-x-0 bg-scrim/70 z-[100] flex items-center justify-center p-4"
          style={{ top: scrollY, height: '100vh' }}
        >
          <div className="bg-bg-card rounded-2xl border border-border-card p-6 max-w-sm w-full shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <h3 className="text-text-primary font-bold text-lg mb-4">
              Delete Mission
            </h3>
            <p className="text-text-sec mb-6">
              Are you sure you want to delete this mission? This will
              permanently delete all jobs and memories associated with it. This
              action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 border border-border-card rounded-xl text-text-primary font-medium hover:bg-bg-card-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                className="flex-1 py-3 bg-accent-pink rounded-xl text-on-dark-accent font-bold hover:bg-accent-pink/90 transition-colors"
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
        const { pattern: patternDesc, end: endDesc, missed: missedDesc } = tmpl
          ? describeRecurrence(tmpl)
          : { pattern: '…', end: '…', missed: '…' };

        const handleEditPattern = () => {
          const task = recurrenceSheetTask;
          setRecurrenceSheetTask(null);
          setShowStopRecurringConfirm(false);
          handleStartEditItem(task);
        };

        const handleStopRecurring = async () => {
          const supabase = createClient();
          await supabase
            .from('tasks')
            .update({ recurrence_type: null, recurrence_days: null, recurrence_interval: null, recurrence_end_date: null, recurrence_end_after: null, recurrence_missed_behavior: null })
            .eq('id', recurrenceSheetTask.id);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          setShowStopRecurringConfirm(false);
          setRecurrenceSheetTask(null);
        };

        return (
          <div className="fixed inset-x-0 bg-scrim/50 z-[100] flex items-end"
        style={{ top: scrollY, height: '100vh' }} onClick={() => { setRecurrenceSheetTask(null); setShowStopRecurringConfirm(false); }}>
            <div className="bg-bg-card w-full rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <RefreshCw size={18} className="text-accent-yellow" />
                  <h3 className="text-text-primary text-lg font-semibold">Recurring Job</h3>
                </div>
                <button onClick={() => { setRecurrenceSheetTask(null); setShowStopRecurringConfirm(false); }} className="text-text-sec hover:text-text-primary transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-border-card">
                  <span className="text-text-sec text-sm">Pattern</span>
                  <span className="text-text-primary text-sm font-medium">{patternDesc}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border-card">
                  <span className="text-text-sec text-sm">End</span>
                  <span className="text-text-primary text-sm font-medium">{endDesc}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border-card">
                  <span className="text-text-sec text-sm">If missed</span>
                  <span className="text-text-primary text-sm font-medium">{missedDesc}</span>
                </div>
              </div>

              {!showStopRecurringConfirm ? (
                <div className="space-y-2">
                  <button
                    onClick={handleEditPattern}
                    className="w-full flex items-center justify-center gap-2 bg-accent-yellow/15 text-accent-yellow p-4 rounded-2xl hover:bg-accent-yellow/25 transition-colors"
                  >
                    <Edit size={18} />
                    <span className="font-medium">Edit pattern</span>
                  </button>
                  <button
                    onClick={() => setShowStopRecurringConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 bg-accent-pink/20 text-accent-pink p-4 rounded-2xl hover:bg-accent-pink/30 transition-colors"
                  >
                    <StopCircle size={18} />
                    <span className="font-medium">Stop recurring</span>
                  </button>
                </div>
              ) : (
                <div className="bg-accent-pink/10 border border-accent-pink/30 rounded-2xl p-4">
                  <p className="text-text-primary text-sm font-medium mb-1">Stop this recurring job?</p>
                  <p className="text-text-sec text-xs mb-4">No new occurrences will be created. Existing tasks remain untouched.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowStopRecurringConfirm(false)}
                      className="flex-1 py-2.5 border border-border-card rounded-xl text-text-sec hover:text-text-primary transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleStopRecurring}
                      className="flex-1 py-2.5 bg-accent-pink rounded-xl text-on-dark-accent font-semibold text-sm hover:bg-accent-pink/90 transition-colors"
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

      {showMissionComplete && project && (
        <MissionCompleteModal
          missionName={project.name}
          xpEarned={earnedXp}
          onDismiss={() => setShowMissionComplete(false)}
        />
      )}

      {newLevel && <LevelUpModal levelProgress={newLevel} onDismiss={dismissLevelUp} />}
    </AppShell>
  );
}
