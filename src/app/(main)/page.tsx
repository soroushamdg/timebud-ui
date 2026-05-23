"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskCardSkeleton } from "@/components/tasks/TaskCardSkeleton";
import { UnfinishedSessionModal } from "@/components/sessions/UnfinishedSessionModal";
import { ChangeSessionTimeDialog } from "@/components/sessions/ChangeSessionTimeDialog";
import { TaskActionMenu } from "@/components/tasks/TaskActionMenu";
import { DeferTaskDialog } from "@/components/dialogs/DeferTaskDialog";
import { AddTaskToPlannerDialog } from "@/components/dialogs/AddTaskToPlannerDialog";
import { SimpleToast } from "@/components/ui/SimpleToast";
import { useLatestUnfinishedFocusSession } from '@/hooks/useSessions'
import { useProjects } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { useCreateFocusSession, useDeleteFocusSession } from '@/hooks/useSessions'
import { planSession, PlannerTask } from '@/lib/planner'
import { useFocusSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'
import { useLoading } from '@/contexts/LoadingContext'
import { useReplan } from '@/contexts/ReplanContext'
import { useReplanOnUIChange } from '@/hooks/useReplanOnUIChange'
import { isValidUuid } from '@/lib/utils'
import { DbFocusSession, DbTask } from '@/types/database'
import { useFocusSessionGuard } from '@/hooks/useSessionGuard'
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { Plus } from 'lucide-react'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { useCurrentUser } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOccurrenceManager } from '@/hooks/useRecurring'

interface PlannedTask {
  taskId: string;
  title: string;
  projectId?: string;
  projectName?: string;
  projectColor?: string;
  projectAvatarUrl?: string;
  done?: boolean;
  percentage?: number;
  estimatedMinutes?: number;
  scheduledMinutes?: number;
  partial?: boolean;
  priority?: boolean;
  deadline?: string;
  description?: string;
  isPinned?: boolean;
  isManual?: boolean;
  isPartOfChain?: boolean;
  chainPosition?: number;
  dependsOnTaskId?: string | null;
  isLocked?: boolean;
  recurrence_parent_id?: string | null;
}

export default function Home() {
  console.log('[Home] Component mounting')
  const router = useRouter();
  useOccurrenceManager();
  const { data: user, isLoading: userLoading, error: userError } = useCurrentUser();
  console.log('[Home] User query state:', { user: user?.id, isLoading: userLoading, error: userError, fullUser: user })
  
  const [unfinishedFocusSession, setUnfinishedFocusSession] = useState<DbFocusSession | null>(
    null,
  );
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([]);
  const [showTimeDialog, setShowTimeDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true);
  const { setLoadingProgress, setLoadingComplete } = useLoading();

  // Swipe/Long-press states
  const [swipedTask, setSwipedTask] = useState<PlannedTask | null>(null);
  const [longPressTask, setLongPressTask] = useState<PlannedTask | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [swipeDistance, setSwipeDistance] = useState(0);

  // Dialog states
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDeferDialog, setShowDeferDialog] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PlannedTask | null>(null);

  // Toast states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'info' | 'warning' | 'error' | 'success'>('info');

  // Query for user profile data
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (error) {
        console.error('Failed to fetch user profile:', error)
        return null
      }
      return data
    },
    enabled: !!user?.id,
    retry: false,
  })

  // Focus session guard - auto-redirect to running focus session
  useFocusSessionGuard();

  // Trigger re-planning when UI settings change
  useReplanOnUIChange();

  const { data: latestUnfinished } = useLatestUnfinishedFocusSession();
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects();
  
  // Debug: Test Supabase auth directly
  useEffect(() => {
    const testAuth = async () => {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('[Home] Direct Supabase auth test:', { user: user?.id, error });
    };
    testAuth();
  }, []);
  
  // Fetch all tasks so planner can check dependencies against completed tasks
  // The planner will filter out completed tasks after dependency checking
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  
  // Calculate completion for all projects
  const projectsWithCompletion = useMemo(() => {
    if (!projects || !tasks) return []
    return projects.map(project => {
      const activeTasks = tasks.filter(task => 
        task.project_id === project.id &&
        task.item_type === 'task' &&
        !task.on_hold &&
        task.status !== 'skipped'
      )
      const onHoldCount = tasks.filter(task =>
        task.project_id === project.id &&
        task.item_type === 'task' &&
        task.on_hold
      ).length
      const completedTaskCount = activeTasks.filter(task => task.status === 'completed').length
      const totalTaskCount = activeTasks.length
      const percentage = totalTaskCount > 0 
        ? Math.round((completedTaskCount / totalTaskCount) * 100) 
        : 0
      const isCompleted = percentage === 100 && totalTaskCount > 0
      
      return {
        ...project,
        completion: {
          percentage,
          isCompleted,
          completedTaskCount,
          totalTaskCount,
          onHoldCount,
        }
      }
    })
  }, [projects, tasks])

  // Sort projects: incomplete first, then completed, both groups sorted by deadline
  const sortedProjects = useMemo(() => {
    const incompleteProjects = projectsWithCompletion.filter((p: any) => !p.completion.isCompleted)
    const completedProjects = projectsWithCompletion.filter((p: any) => p.completion.isCompleted)
    
    const sortByDeadline = (a: any, b: any) => {
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    }
    
    incompleteProjects.sort(sortByDeadline)
    completedProjects.sort(sortByDeadline)
    
    return [...incompleteProjects, ...completedProjects]
  }, [projectsWithCompletion])
  
  // Debug: Test Supabase auth directly
  useEffect(() => {
    const testAuth = async () => {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('[Home] Direct Supabase auth test:', { user: user?.id, error });
    };
    testAuth();
  }, []);
  
  const createFocusSession = useCreateFocusSession();
  const deleteFocusSession = useDeleteFocusSession();
  const { 
    preferredBudgetMinutes, 
    allowPartialTasks,
    pinnedTaskIds,
    manualTaskIds,
    clearCompletedTasks,
    isPinned,
    isManual
  } = useUIStore();
  const { registerReplanFunction } = useReplan();
  const setFocusSession = useFocusSessionStore((state) => state.setFocusSession);
  const markTaskDone = useFocusSessionStore((state) => state.markTaskDone);
  
  // Show loading state while user is loading
  if (userLoading) {
    return (
      <AppShell>
        <div className="flex flex-col h-[calc(100vh-5rem)] items-center justify-center">
          <p className="text-text-sec">Loading...</p>
        </div>
      </AppShell>
    )
  }
  
  // Redirect to login if user is not authenticated
  if (!user) {
    console.log('[Home] No user found, redirecting to login')
    router.push('/auth/login')
    return (
      <AppShell>
        <div className="flex flex-col h-[calc(100vh-5rem)] items-center justify-center">
          <p className="text-text-sec">Redirecting to login...</p>
        </div>
      </AppShell>
    )
  }

  useEffect(() => {
    // Calculate loading progress
    let progress = 0;
    if (!projectsLoading) progress += 33;
    if (!tasksLoading) progress += 33;
    if (latestUnfinished !== undefined) progress += 34;
    
    setLoadingProgress(progress);

    if (latestUnfinished) {
      setUnfinishedFocusSession(latestUnfinished);
      setIsLoading(false);
      setLoadingComplete();
    } else if (projects && tasks) {
      planSessionData();
    } else if (
      !projectsLoading &&
      !tasksLoading &&
      projects !== undefined &&
      tasks !== undefined
    ) {
      // Queries finished loading but no data or planning needed
      setIsLoading(false);
      setLoadingComplete();
    }
  }, [latestUnfinished, projects, tasks, projectsLoading, tasksLoading, setLoadingProgress, setLoadingComplete]);

  // Register the re-planning function with the context
  useEffect(() => {
    registerReplanFunction(planSessionData);
  }, [registerReplanFunction]);

  const planSessionData = async () => {
    if (!projects || !tasks) {
      setIsLoading(false);
      setLoadingComplete();
      return;
    }

    // Auto-cleanup completed tasks from pinned/manual lists
    const completedTaskIds = tasks.filter(t => t.status === 'completed').map(t => t.id);
    clearCompletedTasks(completedTaskIds);

    // Get pinned and manual tasks (only incomplete ones)
    const pinnedTasks = tasks.filter(t => 
      pinnedTaskIds.includes(t.id) && 
      t.status === 'pending' &&
      t.item_type === 'task'
    );
    const manualTasks = tasks.filter(t => 
      manualTaskIds.includes(t.id) && 
      t.status === 'pending' &&
      t.item_type === 'task' &&
      !pinnedTaskIds.includes(t.id)
    );

    // Calculate time used by pinned and manual tasks
    const pinnedTime = pinnedTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const manualTime = manualTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const remainingBudget = preferredBudgetMinutes - pinnedTime - manualTime;

    // Check if there are any pending tasks
    const pendingTasks = tasks.filter((task) => task.status === "pending");
    if (pendingTasks.length === 0 && pinnedTasks.length === 0 && manualTasks.length === 0) {
      setPlannedTasks([]);
      setIsLoading(false);
      setLoadingComplete();
      return;
    }

    try {
      let algorithmTasks: PlannedTask[] = [];

      // Only run algorithm if there's remaining budget
      if (remainingBudget > 0) {
        // Transform DbTask[] to PlannerTask[] for the planner
        // Include all tasks (even completed ones) so dependency checks can find them
        const plannerTasks: PlannerTask[] = tasks.map(task => ({
          ...task,
          estimated_minutes: task.estimated_minutes || 0,
          status: task.status || 'pending',
        }));

        const plan = planSession({
          projects,
          milestones: [],
          tasks: plannerTasks,
          budgetMinutes: remainingBudget,
          allowPartial: allowPartialTasks,
        });

        // Convert PlannedTaskResult to PlannedTask for TaskCard
        algorithmTasks = plan.tasks
          .filter(task => !pinnedTaskIds.includes(task.taskId) && !manualTaskIds.includes(task.taskId))
          .map((task) => {
            const dbTask = tasks.find((t) => t.id === task.taskId);
            const project = task.projectId ? projects?.find((p) => p.id === task.projectId) : undefined;
            return {
              taskId: task.taskId,
              title: task.title,
              projectId: task.projectId || undefined,
              projectName: project?.name || undefined,
              projectColor: project?.color || undefined,
              projectAvatarUrl: project?.project_avatar_url || undefined,
              done: false,
              estimatedMinutes: dbTask?.estimated_minutes || undefined,
              scheduledMinutes: task.scheduledMinutes,
              partial: task.partial,
              priority: dbTask?.priority,
              deadline: dbTask?.due_date || undefined,
              description: dbTask?.description || undefined,
              isPinned: false,
              isManual: false,
              isPartOfChain: task.isPartOfChain,
              chainPosition: task.chainPosition,
              dependsOnTaskId: task.dependsOnTaskId,
              isLocked: task.isLocked,
              recurrence_parent_id: dbTask?.recurrence_parent_id ?? null,
            };
          });
      }

      // Convert pinned tasks to PlannedTask format
      const pinnedPlannedTasks: PlannedTask[] = pinnedTasks.map((task) => {
        const project = task.project_id ? projects?.find((p) => p.id === task.project_id) : undefined;
        return {
          taskId: task.id,
          title: task.title,
          projectId: task.project_id || undefined,
          projectName: project?.name || undefined,
          projectColor: project?.color || undefined,
          projectAvatarUrl: project?.project_avatar_url || undefined,
          done: false,
          estimatedMinutes: task.estimated_minutes || undefined,
          scheduledMinutes: task.estimated_minutes || 0,
          partial: false,
          priority: task.priority,
          deadline: task.due_date || undefined,
          description: task.description || undefined,
          isPinned: true,
          isManual: false,
          recurrence_parent_id: task.recurrence_parent_id ?? null,
        };
      });

      // Convert manual tasks to PlannedTask format
      const manualPlannedTasks: PlannedTask[] = manualTasks.map((task) => {
        const project = task.project_id ? projects?.find((p) => p.id === task.project_id) : undefined;
        return {
          taskId: task.id,
          title: task.title,
          projectId: task.project_id || undefined,
          projectName: project?.name || undefined,
          projectColor: project?.color || undefined,
          projectAvatarUrl: project?.project_avatar_url || undefined,
          done: false,
          estimatedMinutes: task.estimated_minutes || undefined,
          scheduledMinutes: task.estimated_minutes || 0,
          partial: false,
          priority: task.priority,
          deadline: task.due_date || undefined,
          description: task.description || undefined,
          isPinned: false,
          isManual: true,
          recurrence_parent_id: task.recurrence_parent_id ?? null,
        };
      });

      // Merge: pinned first, then manual, then algorithm
      const tasksWithDone = [...pinnedPlannedTasks, ...manualPlannedTasks, ...algorithmTasks];

      // Debug: Log chain metadata
      console.log('[Planner] Tasks with chain metadata:', tasksWithDone.map(t => ({
        title: t.title,
        isPartOfChain: t.isPartOfChain,
        chainPosition: t.chainPosition,
        isLocked: t.isLocked,
        dependsOnTaskId: t.dependsOnTaskId
      })));

      // Store session locally only (no database save)
      const localSessionId = `local-${Date.now()}`;
      setFocusSession(
        localSessionId,
        tasksWithDone.map((t) => ({ 
          position: 0,
          taskId: t.taskId,
          projectId: t.projectId || null,
          projectName: t.projectName,
          projectColor: t.projectColor,
          projectAvatarUrl: t.projectAvatarUrl,
          isSolo: !t.projectId,
          tier1: false,
          milestoneTitle: null,
          title: t.title,
          priority: t.priority || false,
          scheduledMinutes: t.scheduledMinutes || 0,
          partial: t.partial || false,
          carryOverMinutes: 0,
          done: false,
          estimatedMinutes: t.estimatedMinutes,
          deadline: t.deadline,
          isPinned: t.isPinned,
          isManual: t.isManual,
          isPartOfChain: t.isPartOfChain,
          chainPosition: t.chainPosition,
          dependsOnTaskId: t.dependsOnTaskId,
          isLocked: t.isLocked,
          recurrence_parent_id: t.recurrence_parent_id ?? null,
        })) as any,
        preferredBudgetMinutes,
      );
      setPlannedTasks(tasksWithDone);
      setIsLoading(false);
      setLoadingComplete();
    } catch (error) {
      console.error("Failed to plan session:", error);
      setIsLoading(false);
      setLoadingComplete();
    }
  };

  const handleContinueSession = async () => {
    if (!unfinishedFocusSession) return;

    try {
      const sessionTasks = (
        await Promise.all(
          unfinishedFocusSession.tasks_list.map((taskId) =>
            tasks?.find((t) => t.id === taskId),
          ),
        )
      ).filter(Boolean) as DbTask[];

      // Convert DbTask to PlannedTask format for TaskCard
      const sessionStoreTasks = sessionTasks.map((task) => {
        const project = task.project_id ? projects?.find((p) => p.id === task.project_id) : undefined;
        return {
          position: 0,
          taskId: task.id,
          projectId: task.project_id,
          projectName: task.project_id ? projects?.find((p) => p.id === task.project_id)?.name : undefined,
          projectColor: task.project_id ? projects?.find((p) => p.id === task.project_id)?.color || undefined : undefined,
          projectAvatarUrl: project?.project_avatar_url || undefined,
          isSolo: task.project_id === null,
          tier1: false,
          milestoneTitle: null,
          title: task.title,
          priority: task.priority,
          scheduledMinutes: task.estimated_minutes || 0,
          partial: false,
          carryOverMinutes: 0,
          done: false,
          estimatedMinutes: task.estimated_minutes || undefined,
          deadline: task.due_date || undefined,
        };
      });

      setFocusSession(
        unfinishedFocusSession.id,
        sessionStoreTasks,
        unfinishedFocusSession.budget_minutes,
      );
      const plannedSessionTasks = sessionTasks.map((task) => {
        const project = task.project_id ? projects?.find((p) => p.id === task.project_id) : undefined;
        return {
          taskId: task.id,
          title: task.title,
          projectId: task.project_id || undefined,
          projectName: project?.name,
          projectColor: project?.color || undefined,
          projectAvatarUrl: project?.project_avatar_url || undefined,
          done: false,
          estimatedMinutes: task.estimated_minutes || undefined,
          priority: task.priority,
          deadline: task.due_date || undefined,
        };
      });
      setPlannedTasks(plannedSessionTasks);
      setUnfinishedFocusSession(null);
      router.push("/session/focus");
    } catch (error) {
      console.error("Failed to continue session:", error);
    }
  };

// ... (rest of the code remains the same)
  const handleStartFresh = async () => {
    if (!unfinishedFocusSession) return;

    try {
      // Only try to delete from database if it's a valid UUID
      if (isValidUuid(unfinishedFocusSession.id)) {
        await deleteFocusSession.mutateAsync(unfinishedFocusSession.id);
      } else {
        console.log('Session ID is not a valid UUID, skipping database deletion:', unfinishedFocusSession.id);
      }
      setUnfinishedFocusSession(null);
      await planSessionData();
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const handleStartWork = () => {
    // Clear any existing session before starting new one
    const { clearFocusSession } = useFocusSessionStore.getState();
    clearFocusSession();
    
    // Start timer when user clicks "Start work"
    const { startTimer } = useFocusSessionStore.getState();
    startTimer();
    router.push("/session/focus");
  };

  const handleTaskClick = (task: PlannedTask) => {
    if (task.projectId) {
      // Navigate to project page with task ID for highlighting
      router.push(`/projects/${task.projectId}?taskId=${task.taskId}`);
    }
  };

  // Swipe/Long-press handlers
  const handleTouchStart = (e: React.TouchEvent, task: PlannedTask) => {
    const touch = e.touches[0];
    setStartX(touch.clientX);
    setStartY(touch.clientY);
    setSwipeDistance(0);
    
    // Start long-press timer
    const timer = setTimeout(() => {
      setLongPressTask(task);
      setSelectedTask(task);
      setShowActionMenu(true);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    
    // Only consider horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setSwipeDistance(Math.abs(deltaX));
    }
  };

  const handleTouchEnd = (task: PlannedTask) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    // If swipe distance is significant, show action menu
    if (swipeDistance > 50) {
      setSelectedTask(task);
      setShowActionMenu(true);
    }

    setSwipeDistance(0);
  };

  const handleMouseDown = (e: React.MouseEvent, task: PlannedTask) => {
    // Desktop long-press simulation
    const timer = setTimeout(() => {
      setSelectedTask(task);
      setShowActionMenu(true);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleMouseLeave = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Dialog handlers
  const handleDeferClick = () => {
    setShowDeferDialog(true);
  };

  const handleTaskDeferred = () => {
    setShowToast(true);
    setToastMessage('Task deadline updated');
    setToastType('success');
    planSessionData();
  };

  const handleTaskAdded = () => {
    setShowToast(true);
    setToastMessage('Task added to planner');
    setToastType('success');
    planSessionData();
  };

  const handleBudgetExceeded = () => {
    setShowToast(true);
    setToastMessage('Cannot add task - would exceed time budget');
    setToastType('warning');
  };

  if (unfinishedFocusSession) {
    return (
      <AppShell>
        <UnfinishedSessionModal
          session={unfinishedFocusSession}
          onContinue={handleContinueSession}
          onStartFresh={handleStartFresh}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-5rem)] pb-5 overflow-visible">
        {/* Fixed Header Section */}
        <div className="flex-shrink-0">
          {/* 2% top padding */}
          <div className="h-[2vh]"></div>

          {/* Header */}
          <div className="px-6 pt-4 mb-6 flex items-center justify-between">
            <button
              onClick={() => router.push("/profile")}
              className="flex items-center gap-3"
            >
              <AvatarImage
                src={userProfile?.profile_image_url}
                fallbackType="profile"
                fallbackSeed={`${userProfile?.first_name || ''}${userProfile?.last_name || ''}`}
                size={48}
                className="border-4 border-white"
              />
              <span className="text-white text-base font-medium">
                Your studio &gt;
              </span>
            </button>
            <button
              onClick={() => router.push("/tasks/all")}
              className="bg-[#2A2A2A] text-white rounded-full px-4 py-2 text-sm font-medium hover:text-[#d7d7d7] transition-colors"
            >
              All tasks
            </button>
          </div>

          {/* Target Projects */}
          <div className="mb-6 overflow-visible">
            <div className="flex items-center justify-between mb-2 px-6">
              <h2 className="text-white text-xl font-bold">Target projects</h2>
              <button
                onClick={() => router.push("/projects/select")}
                className="bg-[#FFD233] text-black rounded-full px-5 py-1.5 text-sm font-semibold hover:bg-[#FFD233]/90 transition-colors flex items-center gap-2"
              >
                <ArrowsRightLeftIcon className="w-4 h-4" />
                Swap
              </button>
            </div>
            {!projects || projects.length === 0 ? (
              <div className="flex items-center justify-center h-20 px-6">
                <p className="text-text-sec text-center">No projects</p>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 pt-6 scrollbar-hide px-6">
                {sortedProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="flex-shrink-0 transition-all relative hover:scale-110 hover:z-20 hover:shadow-xl hover:shadow-black/50 flex flex-col items-center gap-0.5"
                  >
                    <AvatarImage
                      src={project.project_avatar_url}
                      fallbackType="project"
                      fallbackLabel={project.name}
                      fallbackColor={project.color || undefined}
                      size={80}
                      className="border-2 border-black border-4 border-white"
                    />
                    {project.completion.onHoldCount > 0 && (
                      <span className="text-[9px] text-text-sec leading-none">
                        {project.completion.onHoldCount} on hold
                      </span>
                    )}
                    {/* 100% completion ribbon */}
                    {project.completion.isCompleted && (
                      <div className="absolute -top-1 -right-1 w-20 h-20 overflow-hidden pointer-events-none z-10">
                        <div className="absolute top-4 -right-7 w-[120%] bg-yellow-400 text-black text-center py-1.5 transform rotate-45 font-bold text-xs shadow-lg">
                          100%
                          <div className="absolute bottom-0 left-0 w-0 h-0 border-b-[6px] border-l-[6px] border-transparent border-b-yellow-700 -translate-x-full"></div>
                          <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[6px] border-r-[6px] border-transparent border-b-yellow-700 translate-x-full"></div>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tasks Header with Time Button and Add Button */}
          <div className="flex items-center justify-between px-6 mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-white text-lg font-semibold">
                {isLoading ? "..." : plannedTasks.length} Tasks
              </h3>
              <button
                onClick={() => setShowAddTaskDialog(true)}
                className="w-8 h-8 bg-accent-yellow rounded-full flex items-center justify-center hover:bg-yellow-400 transition-colors"
                title="Add task to planner"
              >
                <Plus className="w-5 h-5 text-black" />
              </button>
            </div>
            <button
              onClick={() => setShowTimeDialog(true)}
              className="bg-[#2A2A2A] rounded-full px-4 py-2 flex items-center gap-2 hover:bg-[#2A2A2A]/80 transition-colors"
            >
              <svg
                className="w-4 h-4 text-[#949494]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-white text-sm font-medium">
                {preferredBudgetMinutes}min
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Task List - takes remaining space */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-text-sec text-center">Loading tasks...</p>
            </div>
          ) : plannedTasks.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-text-sec text-center">No tasks planned. Adjust your settings or add tasks to get started.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {plannedTasks.map((task) => (
                <div
                  key={task.taskId}
                  onTouchStart={(e) => handleTouchStart(e, task)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={() => handleTouchEnd(task)}
                  onMouseDown={(e) => handleMouseDown(e, task)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                >
                  <TaskCard
                    task={task}
                    onClick={() => handleTaskClick(task)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fixed Bottom Section */}
        <div className="flex-shrink-0">
          {/* Start Work Button */}
          <div className="px-6 pt-4 pb-4">
            <button
              onClick={handleStartWork}
              disabled={plannedTasks.length === 0 || isLoading}
              className="w-full bg-accent-yellow text-black font-bold text-lg py-4 rounded-none hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-4 border-white"
            >
              Start work
            </button>
          </div>
        </div>
      </div>

      {showTimeDialog && (
        <ChangeSessionTimeDialog 
          onClose={() => setShowTimeDialog(false)}
          onTimeChanged={() => {
            setIsLoading(true);
            planSessionData();
          }}
        />
      )}

      {showActionMenu && selectedTask && (
        <TaskActionMenu
          isOpen={showActionMenu}
          onClose={() => {
            setShowActionMenu(false);
            setSelectedTask(null);
          }}
          taskId={selectedTask.taskId}
          taskTitle={selectedTask.title}
          onDeferClick={handleDeferClick}
          isPinnedTask={selectedTask.isPinned}
          isManualTask={selectedTask.isManual}
          onReplan={planSessionData}
        />
      )}

      {showDeferDialog && selectedTask && (
        <DeferTaskDialog
          isOpen={showDeferDialog}
          onClose={() => {
            setShowDeferDialog(false);
            setSelectedTask(null);
          }}
          taskId={selectedTask.taskId}
          taskTitle={selectedTask.title}
          currentDeadline={selectedTask.deadline}
          onDeferred={handleTaskDeferred}
        />
      )}

      {showAddTaskDialog && tasks && projects && (
        <AddTaskToPlannerDialog
          isOpen={showAddTaskDialog}
          onClose={() => setShowAddTaskDialog(false)}
          tasks={tasks}
          projects={projects}
          budgetMinutes={preferredBudgetMinutes}
          currentPinnedTaskIds={pinnedTaskIds}
          currentManualTaskIds={manualTaskIds}
          onTaskAdded={handleTaskAdded}
          onBudgetExceeded={handleBudgetExceeded}
        />
      )}

      <SimpleToast
        isVisible={showToast}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setShowToast(false)}
      />
    </AppShell>
  );
}
