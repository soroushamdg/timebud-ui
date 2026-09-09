"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QuickCaptureSheet } from "@/components/capture/QuickCaptureSheet";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskCardSkeleton } from "@/components/tasks/TaskCardSkeleton";
import { UnfinishedSessionModal } from "@/components/sessions/UnfinishedSessionModal";
import { ChangeSessionTimeDialog } from "@/components/sessions/ChangeSessionTimeDialog";
import { TaskActionMenu } from "@/components/tasks/TaskActionMenu";
import { DeferTaskDialog } from "@/components/dialogs/DeferTaskDialog";
import { AddTaskToPlannerDialog } from "@/components/dialogs/AddTaskToPlannerDialog";
import { SimpleToast } from "@/components/ui/SimpleToast";
import { useLatestUnfinishedFocusSession, useActiveFocusSession } from '@/hooks/useSessions'
import { useProjects } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { useCreateFocusSession, useDeleteFocusSession } from '@/hooks/useSessions'
import { planDay, planWeek, PlannerTask, PlanDayOutput, BlockSegment, DayCalendar, DEFAULT_PLANNING_HOURS } from '@/lib/planner'
import { DayPlanList } from '@/components/planner/DayPlanList'
import { useFocusSessionStore, PlannedTask as StoreSessionTask } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'
import { useLoading } from '@/contexts/LoadingContext'
import { useReplan } from '@/contexts/ReplanContext'
import { useReplanOnUIChange } from '@/hooks/useReplanOnUIChange'
import { isValidUuid } from '@/lib/utils'
import { DbFocusSession, DbTask } from '@/types/database'
import { useFocusSessionGuard } from '@/hooks/useSessionGuard'
import { Plus, Sparkles, Calendar as CalendarIcon } from 'lucide-react'
import { HomeMenu } from '@/components/home/HomeMenu'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { useCurrentUser } from '@/hooks/useAuth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { addDays } from 'date-fns'
import { RightNowCard } from '@/components/planner/RightNowCard'
import { ThisWeekStrip } from '@/components/planner/ThisWeekStrip'

interface WeekDayChipData {
  date: Date
  taskCount: number
  usedMinutes: number
  budgetMinutes: number
}
import { useAISettings } from '@/hooks/useAISettings'
import { useFocusSessions } from '@/hooks/useSessions'
import { getTodayUsedMinutes } from '@/lib/planner/dailyUsage'
import { formatMinutesLabel } from '@/lib/dates'
import { getLevelProgress, getJobXpPreview } from '@/lib/gamification/xp'
import { computeCurrentStreak } from '@/lib/gamification/streak'
import { buildActivityDates } from '@/lib/gamification/activity'
import { useLevelUpWatcher } from '@/hooks/useLevelUpWatcher'
import { LevelUpModal } from '@/components/gamification/LevelUpModal'
import { MissionDifficulty } from '@/types/database'
import { useDayCalendar } from '@/hooks/useDayCalendar'
import { useGoogleCalendarConnection } from '@/hooks/useGoogleCalendarConnection'
import { useCalendarBlockMappings } from '@/hooks/useCalendarBlockMappings'

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
  recurrenceType?: 'daily' | 'specific_days' | 'interval' | null;
  recurrenceDays?: number[] | null;
  recurrenceInterval?: number | null;
  // Calendar-aware planning: which lane the job landed in (src/lib/planner/planDay.ts).
  lane?: 'block' | 'free';
  blockId?: string;
  blockLabel?: string;
  blockStartTime?: string;
  blockEndTime?: string;
  windowStartTime?: string;
}

export default function Home() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [unfinishedFocusSession, setUnfinishedFocusSession] = useState<DbFocusSession | null>(
    null,
  );
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([]);
  // The structured day (windows, walls, block lanes) behind `plannedTasks` — what the
  // expanded list and the Right Now summary render from.
  const [dayPlan, setDayPlan] = useState<PlanDayOutput | null>(null);
  // Windows shrink and blocks start on the clock, not on user action, so the plan is
  // refreshed once a minute even when nothing else changed.
  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMinuteTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
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
  const [showCapture, setShowCapture] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PlannedTask | null>(null);

  // Open quick capture automatically when deep-linked (push notification tap, PWA
  // home-screen shortcut) via /?capture=1, then clean the param out of the URL.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('capture') === '1') {
      setShowCapture(true);
      router.replace('/');
    }
  }, [searchParams, router]);

  // Deep-linked from the "your block just started" push notification (/?block=<id>) —
  // force an immediate refetch instead of waiting for useActiveCalendarBlock's normal
  // poll interval, so the block shows up on Home right away rather than up to a minute
  // late.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (searchParams.get('block')) {
      queryClient.invalidateQueries({ queryKey: ['day-calendar'] });
      router.replace('/');
    }
  }, [searchParams, router, queryClient]);

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
  // A session already running/paused, whether started here or on another device —
  // checked before creating a new one so "Start Run" resumes it instead of duplicating.
  const { data: activeFocusSession } = useActiveFocusSession();
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects();

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
        !task.on_hold
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

  // Gamification: level/XP from the persisted total (src/lib/gamification/xp.ts,
  // driven by the tasks_award_xp DB trigger), streak from the same walk-back the
  // notification producer already validated (src/lib/gamification/streak.ts).
  const { data: aiSettings } = useAISettings()
  const { data: focusSessions } = useFocusSessions()
  const timezone = aiSettings?.timezone || 'UTC'
  // Real minutes already spent today across every run that's ended so far (completed
  // or abandoned) — subtracted from the daily budget below so a run stopped early to
  // take a break doesn't silently "refill" back to the full budget on the next replan.
  const usedMinutesToday = useMemo(
    () => getTodayUsedMinutes(focusSessions ?? [], timezone),
    [focusSessions, timezone]
  )
  const levelProgress = useMemo(() => getLevelProgress(aiSettings?.xp_total ?? 0), [aiSettings?.xp_total])
  const currentStreak = useMemo(() => {
    if (!tasks || !focusSessions) return 0
    const timezone = aiSettings?.timezone || 'UTC'
    const activityDates = buildActivityDates(tasks, focusSessions, timezone)
    return computeCurrentStreak(activityDates, new Date(), timezone)
  }, [tasks, focusSessions, aiSettings?.timezone])

  const { newLevel, dismiss: dismissLevelUp } = useLevelUpWatcher()

  // The calendar's view of the week (src/hooks/useDayCalendar.ts): today's mapped
  // TimeBud blocks reserve time for their missions, busy time on every other calendar
  // is a wall, and days 1–6 feed the week-ahead strip. Planning hours come from settings.
  const weekCalendar = useDayCalendar(7)
  const todayCalendar = weekCalendar.today
  const calendarConnected = weekCalendar.connected
  const calendarByDate = useMemo(
    () => Object.fromEntries((weekCalendar.data?.days ?? []).map((d) => [d.date, d])) as Record<string, DayCalendar>,
    [weekCalendar.data]
  )
  const planningHours = useMemo(
    () => ({
      start: aiSettings?.planning_start_time || DEFAULT_PLANNING_HOURS.start,
      end: aiSettings?.planning_end_time || DEFAULT_PLANNING_HOURS.end,
      minGapMinutes: aiSettings?.min_gap_minutes ?? DEFAULT_PLANNING_HOURS.minGapMinutes,
    }),
    [aiSettings?.planning_start_time, aiSettings?.planning_end_time, aiSettings?.min_gap_minutes]
  )
  const spilloverProjectIds = useMemo(
    () => (projects ?? []).filter((p) => p.calendar_spillover).map((p) => p.id),
    [projects]
  )

  // A stale cache means the cron stopped reaching Google — say so, and try one catch-up
  // sync per visit (the server throttles repeats).
  const { isStale: calendarStale, syncNow, isSyncing: calendarSyncing, lastSyncedAt: calendarLastSyncedAt } = useGoogleCalendarConnection()
  const autoSyncedRef = useRef(false)
  useEffect(() => {
    if (!calendarConnected || !calendarStale || calendarSyncing || autoSyncedRef.current) return
    autoSyncedRef.current = true
    syncNow().catch(() => {})
  }, [calendarConnected, calendarStale, calendarSyncing, syncNow])

  // The block that's running right now, if any — drives the Right Now header.
  const activeBlockSegment = dayPlan?.segments.find(
    (s): s is BlockSegment => s.kind === 'block' && s.state === 'active'
  )
  const activeBlock = activeBlockSegment
    ? { missionLabel: activeBlockSegment.missionLabel, endTime: activeBlockSegment.endTime }
    : undefined
  const reservedLabel = dayPlan
    ? Array.from(new Set(dayPlan.segments.filter((s): s is BlockSegment => s.kind === 'block').map((s) => s.missionLabel))).join(' & ') || undefined
    : undefined

  // Report-tile data: an unconfirmed block (surfaced as a one-line nudge) and the
  // count of distinct missions with at least one confirmed calendar link (a "This
  // Week" stat) — both derived from the same mappings fetch, no extra hook needed.
  const { data: calendarMappings = [] } = useCalendarBlockMappings()
  const unconfirmedBlock = calendarMappings.find((m) => !m.confirmed)
  const calendarLinkedMissionCount = new Set(
    calendarMappings.filter((m) => m.confirmed).flatMap((m) => m.project_ids || [])
  ).size

  const [showAllJobs, setShowAllJobs] = useState(false)
  const startButtonRef = useRef<HTMLDivElement>(null)

  // Smart scroll: when the jobs list expands (or its contents change while
  // expanded), make sure the Start Run button is actually reachable instead
  // of silently sitting below the fold. `block: 'nearest'` is a no-op if
  // it's already visible, so this never scrolls unnecessarily.
  useEffect(() => {
    if (!showAllJobs) return
    const id = requestAnimationFrame(() => {
      startButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(id)
  }, [showAllJobs, plannedTasks.length])

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
  // What's actually left of the daily budget after subtracting time already spent in
  // earlier runs today — the number every replan (and the UI below) should treat as
  // "today's budget" instead of the static, never-shrinking preference.
  const dailyRemainingMinutes = Math.max(0, preferredBudgetMinutes - usedMinutesToday)

  // Project today's plan forward across the next 6 days (days 1-6; today itself is
  // `plannedTasks`, computed below) so the week-ahead strip can show what's coming
  // without waiting for the user to page through days one at a time.
  const weekAhead = useMemo(() => {
    if (!tasks || !projects) return null;

    const now = new Date();
    const todayUsedMinutes = plannedTasks.reduce(
      (sum, t) => sum + (t.scheduledMinutes ?? t.estimatedMinutes ?? 0),
      0
    );

    const day0TaskIds = new Set(plannedTasks.map((t) => t.taskId));
    const pool: PlannerTask[] = tasks
      .filter((t) => t.status === 'pending' && t.item_type === 'task' && !day0TaskIds.has(t.id))
      .map((t) => ({
        ...t,
        estimated_minutes: t.estimated_minutes || 0,
        status: t.status || 'pending',
      }));

    const week = planWeek({
      projects,
      tasks: pool,
      dailyBudgetMinutes: preferredBudgetMinutes,
      startDate: addDays(now, 1),
      days: 6,
      allowPartial: allowPartialTasks,
      // Calendar mode only once connected — otherwise the legacy flat plan, unchanged.
      calendarByDate: calendarConnected ? calendarByDate : undefined,
      timezone,
      planningHours,
      calendarConnected,
      spilloverProjectIds,
    });

    const chips: WeekDayChipData[] = [
      {
        date: now,
        taskCount: plannedTasks.length,
        usedMinutes: todayUsedMinutes,
        budgetMinutes: preferredBudgetMinutes,
      },
      ...week.days.map((d, i) => ({
        date: addDays(now, i + 1),
        taskCount: d.tasks.length,
        usedMinutes: d.totalUsedMinutes,
        budgetMinutes: d.budgetMinutes,
      })),
    ];

    return { chips, unscheduledCount: week.unscheduledTasks.length, todayUsedMinutes };
  }, [tasks, projects, plannedTasks, preferredBudgetMinutes, allowPartialTasks, calendarConnected, calendarByDate, timezone, planningHours, spilloverProjectIds]);

  // Show loading state while user is loading
  if (userLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-5rem)] items-center justify-center">
        <p className="text-text-sec">Loading...</p>
      </div>
    )
  }

  // Redirect to login if user is not authenticated
  if (!user) {
    router.push('/auth/login')
    return (
      <div className="flex flex-col h-[calc(100vh-5rem)] items-center justify-center">
        <p className="text-text-sec">Redirecting to login...</p>
      </div>
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
  }, [latestUnfinished, projects, tasks, projectsLoading, tasksLoading, setLoadingProgress, setLoadingComplete, usedMinutesToday, todayCalendar, calendarConnected, planningHours, spilloverProjectIds, minuteTick]);

  // Register the re-planning function with the context
  useEffect(() => {
    registerReplanFunction(planSessionData);
  }, [registerReplanFunction]);

  // Deep-linked from the run screen (/session/focus) after stopping or abandoning a
  // run, via /?runEnded=1 — closes the loop on the dynamic-budget feature by
  // confirming, right when the user lands back home, how much of today's budget is
  // actually left now that the run's real elapsed time has been subtracted. Waits for
  // both the plan and focusSessions to finish loading so the number isn't stale.
  useEffect(() => {
    if (searchParams.get('runEnded') !== '1') return;
    if (isLoading || !focusSessions) return;

    setShowToast(true);
    setToastMessage(
      dailyRemainingMinutes > 0
        ? `Run saved — ${formatMinutesLabel(dailyRemainingMinutes)} left in today's budget`
        : "Today's budget is used up"
    );
    setToastType('info');
    router.replace('/');
  }, [searchParams, isLoading, focusSessions, dailyRemainingMinutes, router]);

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
    // Pinned/manual tasks (an explicit user override) come off the top of what's left of
    // today's budget; planDay then splits the remainder between TimeBud block lanes and
    // the free windows between busy events.
    const remainingBudget = dailyRemainingMinutes - pinnedTime - manualTime;

    // Check if there are any pending tasks
    const pendingTasks = tasks.filter((task) => task.status === "pending");
    if (pendingTasks.length === 0 && pinnedTasks.length === 0 && manualTasks.length === 0) {
      setPlannedTasks([]);
      setDayPlan(null);
      setIsLoading(false);
      setLoadingComplete();
      return;
    }

    try {
      let algorithmTasks: PlannedTask[] = [];

      // Transform DbTask[] to PlannerTask[] for the planner
      // Include all tasks (even completed ones) so dependency checks can find them
      const plannerTasks: PlannerTask[] = tasks.map(task => ({
        ...task,
        estimated_minutes: task.estimated_minutes || 0,
        status: task.status || 'pending',
      }));

      // Always runs, even with no free budget left: a TimeBud block later today still
      // reserves its own minutes for its mission, and planDay reports both lanes.
      const plan = planDay({
        projects,
        tasks: plannerTasks,
        budgetMinutes: Math.max(0, remainingBudget),
        blocks: todayCalendar?.blocks ?? [],
        busy: todayCalendar?.busy ?? [],
        calendarConnected,
        planningHours,
        now: new Date(),
        timezone,
        allowPartial: allowPartialTasks,
        spilloverProjectIds,
      });
      setDayPlan(plan);

      // Convert PlannedDayTask to PlannedTask for TaskCard
      algorithmTasks = plan.orderedTasks
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
            recurrenceType: dbTask?.recurrence_type,
            recurrenceDays: dbTask?.recurrence_days,
            recurrenceInterval: dbTask?.recurrence_interval,
            isPartOfChain: task.isPartOfChain,
            chainPosition: task.chainPosition,
            dependsOnTaskId: task.dependsOnTaskId,
            isLocked: task.isLocked,
            lane: task.lane,
            blockId: task.blockId,
            blockLabel: task.blockLabel,
            blockStartTime: task.blockStartTime,
            blockEndTime: task.blockEndTime,
            windowStartTime: task.windowStartTime,
          };
        });

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
          recurrenceType: task.recurrence_type,
          recurrenceDays: task.recurrence_days,
          recurrenceInterval: task.recurrence_interval,
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
          recurrenceType: task.recurrence_type,
          recurrenceDays: task.recurrence_days,
          recurrenceInterval: task.recurrence_interval,
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
          recurrenceType: t.recurrenceType,
          recurrenceDays: t.recurrenceDays,
          recurrenceInterval: t.recurrenceInterval,
          isPartOfChain: t.isPartOfChain,
          chainPosition: t.chainPosition,
          dependsOnTaskId: t.dependsOnTaskId,
          isLocked: t.isLocked,
          lane: t.lane,
          blockId: t.blockId,
          blockLabel: t.blockLabel,
          blockStartTime: t.blockStartTime,
          blockEndTime: t.blockEndTime,
          windowStartTime: t.windowStartTime,
        })) as any,
        Math.max(0, remainingBudget),
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
          recurrenceType: task.recurrence_type,
          recurrenceDays: task.recurrence_days,
          recurrenceInterval: task.recurrence_interval,
        };
      });

      // applyServerSnapshot, not setFocusSession — this is resuming a real server-tracked
      // run (has its own status/pause bookkeeping), not seeding the local-only planning
      // draft setFocusSession is for. setFocusSession leaves status/timerRunning
      // untouched, which left hasActiveFocusSession false right after "Continue" and
      // bounced the user straight back out of /session/focus.
      useFocusSessionStore.getState().applyServerSnapshot({
        id: unfinishedFocusSession.id,
        status: unfinishedFocusSession.status,
        start_time: unfinishedFocusSession.start_time,
        paused_at: unfinishedFocusSession.paused_at,
        total_paused_seconds: unfinishedFocusSession.total_paused_seconds,
        budget_minutes: unfinishedFocusSession.budget_minutes,
        planned_tasks: sessionStoreTasks,
      });
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
          recurrenceType: task.recurrence_type,
          recurrenceDays: task.recurrence_days,
          recurrenceInterval: task.recurrence_interval,
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

  const handleStartWork = async () => {
    const { clearFocusSession, applyServerSnapshot, budgetMinutes: plannedRunBudgetMinutes } = useFocusSessionStore.getState();

    // A run is already active — started here earlier, or on another device — so join
    // that one instead of creating a duplicate.
    if (activeFocusSession) {
      // Clear first: applyServerSnapshot silently no-ops when the store already holds a
      // *different* focusSessionId (stale local state — e.g. a run that never cleanly
      // stopped, still sitting in persisted localStorage), which left the store pointing
      // at the wrong session and bounced the guard right back out of /session/focus.
      clearFocusSession();
      applyServerSnapshot({
        id: activeFocusSession.id,
        status: activeFocusSession.status,
        start_time: activeFocusSession.start_time,
        paused_at: activeFocusSession.paused_at,
        total_paused_seconds: activeFocusSession.total_paused_seconds,
        budget_minutes: activeFocusSession.budget_minutes,
        planned_tasks: activeFocusSession.planned_tasks as unknown as StoreSessionTask[],
      });
      router.push("/session/focus");
      return;
    }

    clearFocusSession();

    try {
      const created = await createFocusSession.mutateAsync({
        // Captured before clearFocusSession() reset the store above — planSessionData's
        // setFocusSession call already set this to the actual remaining budget for
        // today, not the static daily preference, so a run started mid-day is tagged
        // with what was really left, not the full original total.
        budget_minutes: plannedRunBudgetMinutes,
        end_time: null,
        tasks_list: plannedTasks.map((t) => t.taskId),
        status: 'running',
        paused_at: null,
        total_paused_seconds: 0,
        planned_tasks: plannedTasks as unknown as Record<string, unknown>[],
      });
      // Seed the store from the row we just created (not a fresh `new Date()`) so the
      // elapsed timer starts from the exact timestamp every other device will also see.
      applyServerSnapshot({
        id: created.id,
        status: created.status,
        start_time: created.start_time,
        paused_at: created.paused_at,
        total_paused_seconds: created.total_paused_seconds,
        budget_minutes: created.budget_minutes,
        planned_tasks: created.planned_tasks as unknown as StoreSessionTask[],
      });
      router.push("/session/focus");
    } catch (error) {
      console.error("Failed to start run:", error);
    }
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

  // Shared row renderer (touch/swipe handlers + TaskCard) used both for the Right Now
  // card's single top-job preview and the full expanded list — one job's markup, not
  // duplicated between the collapsed and expanded states.
  const renderJobRow = (task: PlannedTask) => {
    const taskProject = task.projectId ? projects?.find((p) => p.id === task.projectId) : undefined;
    const xpReward = getJobXpPreview((taskProject?.difficulty as MissionDifficulty) || 'medium');
    return (
      <div
        key={task.taskId}
        onTouchStart={(e) => handleTouchStart(e, task)}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => handleTouchEnd(task)}
        onMouseDown={(e) => handleMouseDown(e, task)}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <TaskCard task={task} xpReward={xpReward} onClick={() => handleTaskClick(task)} />
      </div>
    );
  };

  if (unfinishedFocusSession) {
    return (
      <UnfinishedSessionModal
        session={unfinishedFocusSession}
        onContinue={handleContinueSession}
        onStartFresh={handleStartFresh}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col h-[calc(100dvh-5rem)] pb-5 overflow-visible">
        {/* Fixed Header Section */}
        <div className="flex-shrink-0">
          {/* 2% top padding */}
          <div className="h-[2vh]"></div>

          {/* Header */}
          <div className="px-6 pt-4 mb-6 flex items-center justify-between">
            <button
              onClick={() => router.push("/profile")}
              className="flex items-center gap-3 min-w-0"
            >
              <div className="relative flex-shrink-0">
                <AvatarImage
                  src={userProfile?.profile_image_url}
                  fallbackType="profile"
                  fallbackSeed={`${userProfile?.first_name || ''}${userProfile?.last_name || ''}`}
                  size={52}
                  className="border-4 border-avatar-ring"
                />
                <div className="absolute -right-1.5 -bottom-1.5 w-7 h-7 rounded-full bg-accent-yellow border-[3px] border-badge-ring flex items-center justify-center shadow-[0_0_10px_rgba(245,197,24,0.5)]">
                  <span className="text-on-light-accent text-[11px] font-black leading-none">{levelProgress.level}</span>
                </div>
              </div>
              <div className="text-left min-w-0">
                <span className="text-text-primary text-base font-bold block">
                  {userProfile?.first_name ? `Hey, ${userProfile.first_name}` : 'Your studio'}
                </span>
                <span className="text-text-sec text-xs flex items-center gap-1 mt-0.5">
                  {currentStreak > 0 && <>&#128293; {currentStreak}-day grind &middot; </>}
                  Level {levelProgress.level} &middot; {levelProgress.levelTitle}
                </span>
                <div className="h-1.5 w-28 rounded-full bg-secondary-surface overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (levelProgress.xpIntoLevel / Math.max(1, levelProgress.xpForNextLevel)) * 100)}%`,
                      background: 'linear-gradient(90deg, var(--color-accent-yellow), var(--color-accent-yellow-light))',
                    }}
                  />
                </div>
              </div>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/chat")}
                className="w-11 h-11 bg-secondary-surface rounded-full flex items-center justify-center hover:bg-bg-card-hover/80 transition-colors"
                title="Chat with Bud"
              >
                <Sparkles className="w-5 h-5 text-accent-yellow" />
              </button>
              <HomeMenu />
            </div>
          </div>

          {/* Missions (slimmed — full detail lives on the Missions list, not duplicated here) */}
          <div className="mb-6 overflow-visible">
            <div className="flex items-center justify-between mb-2 px-6">
              <h2 className="text-text-primary text-xl font-bold">Your Missions</h2>
              {projects && projects.length > 0 && (
                <button
                  onClick={() => router.push('/projects/select')}
                  className="text-text-sec text-xs hover:text-text-primary transition-colors"
                >
                  {projects.length} mission{projects.length === 1 ? '' : 's'} &middot; view all
                </button>
              )}
            </div>
            {!projects || projects.length === 0 ? (
              <div className="flex items-center justify-center h-20 px-6">
                <p className="text-text-sec text-center">No missions yet</p>
              </div>
            ) : (
              <div className="flex gap-3.5 overflow-x-auto pb-2 pt-4 scrollbar-hide px-6">
                {sortedProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="flex-shrink-0 transition-all relative hover:scale-110 hover:z-20 hover:shadow-xl hover:shadow-black/50 flex flex-col items-center gap-0.5"
                  >
                    <div className="shadow-[0_0_16px_rgba(245,197,24,0.2)]">
                      <AvatarImage
                        src={project.project_avatar_url}
                        fallbackType="project"
                        fallbackLabel={project.name}
                        fallbackColor={project.color || undefined}
                        size={60}
                        className="border-2 border-avatar-ring"
                      />
                    </div>
                    <div className="w-[60px] h-1 rounded-full bg-border-card overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${project.completion.percentage}%`,
                          background: project.completion.isCompleted ? 'var(--color-accent-green)' : 'var(--color-accent-yellow)',
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* New-block nudge — only when a calendar block is waiting to be mapped to a mission */}
          {unconfirmedBlock && (
            <button
              onClick={() => router.push('/profile/calendar')}
              className="mx-6 mb-4 px-3.5 py-2.5 rounded-2xl bg-accent-yellow/[0.08] border border-accent-yellow/30 flex items-center gap-2.5 text-left"
            >
              <CalendarIcon className="w-4 h-4 text-accent-yellow flex-shrink-0" />
              <span className="flex-1 text-text-primary text-xs">
                New block &ldquo;{unconfirmedBlock.event_title}&rdquo; detected &mdash; set up which mission it&apos;s for
              </span>
              <span className="text-accent-yellow text-xs font-bold flex-shrink-0">Set up &rarr;</span>
            </button>
          )}

          {/* Stale-calendar nudge — the sync cron hasn't reached Google in a while, so
              today's blocks and busy time may be missing. Tap syncs now; if that fails,
              fall through to the Calendar settings screen. */}
          {calendarConnected && calendarStale && (
            <button
              onClick={() => syncNow().catch(() => router.push('/profile/calendar'))}
              disabled={calendarSyncing}
              className="mx-6 mb-4 px-3.5 py-2.5 rounded-2xl bg-accent-pink/[0.08] border border-accent-pink/40 flex items-center gap-2.5 text-left disabled:opacity-70"
            >
              <CalendarIcon className="w-4 h-4 text-accent-pink flex-shrink-0" />
              <span className="flex-1 text-text-primary text-xs">
                {calendarSyncing
                  ? 'Syncing your calendar…'
                  : `Calendar not synced ${
                      calendarLastSyncedAt
                        ? `since ${new Date(calendarLastSyncedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                        : 'yet'
                    } — today's blocks may be missing`}
              </span>
              <span className="text-accent-pink text-xs font-bold flex-shrink-0">{calendarSyncing ? '…' : 'Sync →'}</span>
            </button>
          )}

          {/* Right Now: status + top job preview, full list tucked behind "Show all" */}
          {weekAhead && (
            <RightNowCard
              usedMinutes={activeBlockSegment ? activeBlockSegment.totalUsedMinutes : weekAhead.todayUsedMinutes}
              budgetMinutes={activeBlockSegment ? activeBlockSegment.budgetMinutes : dailyRemainingMinutes}
              alreadyUsedMinutes={activeBlockSegment ? undefined : usedMinutesToday}
              activeBlock={activeBlock}
              daySummary={
                dayPlan && calendarConnected
                  ? {
                      freePlannedMinutes:
                        dayPlan.freeUsedMinutes +
                        plannedTasks.filter((t) => t.isPinned || t.isManual).reduce((sum, t) => sum + (t.scheduledMinutes || 0), 0),
                      reservedMinutes: dayPlan.reservedMinutes,
                      windowMinutes: dayPlan.windowMinutes,
                      reservedLabel,
                    }
                  : undefined
              }
              topJobCard={plannedTasks.length > 0 ? renderJobRow(plannedTasks[0]) : null}
              jobCount={plannedTasks.length}
              isExpanded={showAllJobs}
              onToggleExpanded={() => setShowAllJobs((v) => !v)}
            />
          )}

          {/* This Week report tile — hidden while the full job list is expanded, to keep focus on it */}
          {weekAhead && !showAllJobs && (
            <ThisWeekStrip
              streakDays={currentStreak}
              daysPlanned={weekAhead.chips.filter((c) => c.taskCount > 0).length}
              daysTotal={weekAhead.chips.length}
              calendarLinkedCount={calendarLinkedMissionCount}
            />
          )}

          {/* Jobs Header with Time Button and Add Button — only while expanded */}
          {showAllJobs && (
            <div className="flex items-center justify-between px-6 mb-4 mt-2">
              <div className="flex items-center gap-3">
                <h3 className="text-text-primary text-lg font-semibold">
                  {isLoading ? "..." : plannedTasks.length} Jobs
                </h3>
                <button
                  onClick={() => setShowAddTaskDialog(true)}
                  className="w-8 h-8 bg-accent-yellow rounded-full flex items-center justify-center hover:bg-accent-yellow-hover transition-colors"
                  title="Add job to planner"
                >
                  <Plus className="w-5 h-5 text-on-light-accent" />
                </button>
              </div>
              <button
                onClick={() => setShowTimeDialog(true)}
                className="bg-secondary-surface rounded-full px-4 py-2 flex items-center gap-2 hover:bg-bg-card-hover/80 transition-colors"
              >
                <svg
                  className="w-4 h-4 text-text-sec"
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
                <span className="text-text-primary text-sm font-medium">
                  {usedMinutesToday > 0
                    ? `${formatMinutesLabel(dailyRemainingMinutes)} left`
                    : `${preferredBudgetMinutes}min`}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Task List — only while expanded; takes remaining space */}
        {showAllJobs && (
          <div className="flex-1 min-h-0 overflow-y-auto px-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-text-sec text-center">Loading jobs...</p>
              </div>
            ) : plannedTasks.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-text-sec text-center">No jobs planned. Adjust your settings or add jobs to get started.</p>
              </div>
            ) : (
              <div className="pb-4">
                {/* Pinned/manual picks sit above the calendar's structure — they're the
                    user's explicit choice, not something the planner placed. */}
                {plannedTasks.some((t) => t.isPinned || t.isManual) && (
                  <div className="space-y-3">
                    {plannedTasks.filter((t) => t.isPinned || t.isManual).map((task) => renderJobRow(task))}
                  </div>
                )}
                {dayPlan ? (
                  <DayPlanList
                    segments={dayPlan.segments}
                    showTimes={calendarConnected}
                    budgetReached={dayPlan.freeUsedMinutes >= dayPlan.freeBudgetMinutes}
                    renderJob={(taskId, portion) => {
                      const task = plannedTasks.find((t) => t.taskId === taskId);
                      if (!task) return null;
                      // A job split across windows shows just this window's share.
                      const shown =
                        portion && (portion.continued || portion.continues)
                          ? { ...task, scheduledMinutes: portion.minutes, partial: true }
                          : task;
                      return renderJobRow(shown);
                    }}
                  />
                ) : (
                  <div className="space-y-3">
                    {plannedTasks.filter((t) => !t.isPinned && !t.isManual).map((task) => renderJobRow(task))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Fixed Bottom Section */}
        {/* md:mb-24 clears the TabBar: on desktop, .app-box's `contain: layout`
            makes the (position: fixed) TabBar position relative to the app
            box's own edges instead of the real viewport, so it renders
            inside this box's bottom ~100px rather than floating below it
            the way it does on mobile -- without this margin it sits right
            on top of the button. */}
        <div ref={startButtonRef} className="flex-shrink-0 md:mb-24">
          {/* Start Work Button */}
          <div className="px-6 pt-4 pb-4">
            <button
              onClick={handleStartWork}
              disabled={plannedTasks.length === 0 || isLoading}
              className="w-full bg-accent-yellow text-on-light-accent font-bold text-lg py-4 rounded-none hover:bg-accent-yellow-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-4 border-cta-outline"
            >
              Start Run
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
          usedMinutesToday={usedMinutesToday}
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

      {showCapture && (
        <QuickCaptureSheet
          onClose={() => setShowCapture(false)}
          onSuccess={(message) => {
            setToastMessage(message);
            setToastType('success');
            setShowToast(true);
          }}
        />
      )}

      <SimpleToast
        isVisible={showToast}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setShowToast(false)}
      />

      {newLevel && <LevelUpModal levelProgress={newLevel} onDismiss={dismissLevelUp} />}
    </>
  );
}
