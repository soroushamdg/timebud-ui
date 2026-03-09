"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskCardSkeleton } from "@/components/tasks/TaskCardSkeleton";
import { UnfinishedSessionModal } from "@/components/sessions/UnfinishedSessionModal";
import { ChangeSessionTimeDialog } from "@/components/sessions/ChangeSessionTimeDialog";
import { useLatestUnfinishedFocusSession } from '@/hooks/useSessions'
import { useProjects } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { useCreateFocusSession, useDeleteFocusSession } from '@/hooks/useSessions'
import { planSession } from '@/lib/planner'
import { useFocusSessionStore } from '@/stores/sessionStore'
import { useUIStore } from '@/stores/uiStore'
import { getDiceBearUrl, isValidUuid } from '@/lib/utils'
import { DbFocusSession, DbTask } from '@/types/database'
import { useFocusSessionGuard } from '@/hooks/useSessionGuard'

interface PlannedTask {
  taskId: string;
  title: string;
  projectId?: string;
  projectName?: string;
  projectColor?: string;
  done?: boolean;
  percentage?: number;
  estimatedMinutes?: number;
  scheduledMinutes?: number;
  partial?: boolean;
}

export default function Home() {
  const router = useRouter();
  const [unfinishedFocusSession, setUnfinishedFocusSession] = useState<DbFocusSession | null>(
    null,
  );
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([]);
  const [showTimeDialog, setShowTimeDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true);

  // Focus session guard - auto-redirect to running focus session
  useFocusSessionGuard();

  const { data: latestUnfinished } = useLatestUnfinishedFocusSession();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: tasks, isLoading: tasksLoading } = useTasks({
    status: "pending",
  });
  const createFocusSession = useCreateFocusSession();
  const deleteFocusSession = useDeleteFocusSession();
  const { preferredBudgetMinutes, allowPartialTasks } = useUIStore();
  const setFocusSession = useFocusSessionStore((state) => state.setFocusSession);
  const markTaskDone = useFocusSessionStore((state) => state.markTaskDone);

  useEffect(() => {
    if (latestUnfinished) {
      setUnfinishedFocusSession(latestUnfinished);
      setIsLoading(false);
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
    }
  }, [latestUnfinished, projects, tasks, projectsLoading, tasksLoading]);

  const planSessionData = async () => {
    if (!projects || !tasks) {
      setIsLoading(false);
      return;
    }

    // Check if there are any pending tasks
    const pendingTasks = tasks.filter((task) => task.status === "pending");
    if (pendingTasks.length === 0) {
      setPlannedTasks([]);
      setIsLoading(false);
      return;
    }

    try {
      const plan = planSession({
        projects,
        milestones: [],
        tasks,
        budgetMinutes: preferredBudgetMinutes,
        allowPartial: allowPartialTasks,
      });

      if (plan.tasks.length === 0) {
        setPlannedTasks([]);
        setIsLoading(false);
        return;
      }

      // Convert PlannedTaskResult to PlannedTask for TaskCard
      const tasksWithDone = plan.tasks.map((task) => {
        const dbTask = tasks.find((t) => t.id === task.taskId);
        return {
          taskId: task.taskId,
          title: task.title,
          projectId: task.projectId || undefined,
          projectName: task.projectId ? projects?.find((p) => p.id === task.projectId)?.name : undefined,
          projectColor: task.projectId ? projects?.find((p) => p.id === task.projectId)?.color || undefined : undefined,
          done: false,
          estimatedMinutes: dbTask?.estimated_minutes,
          scheduledMinutes: task.scheduledMinutes,
          partial: task.partial,
        };
      });

      // Store session locally only (no database save)
      const localSessionId = `local-${Date.now()}`;
      setFocusSession(
        localSessionId,
        plan.tasks.map((t) => ({ 
          ...t, 
          done: false,
          projectName: t.projectId ? projects?.find((p) => p.id === t.projectId)?.name : undefined,
          projectColor: t.projectId ? projects?.find((p) => p.id === t.projectId)?.color : undefined,
          estimatedMinutes: tasks.find(task => task.id === t.taskId)?.estimated_minutes,
        })) as any,
        plan.budgetMinutes,
      );
      setPlannedTasks(tasksWithDone);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to plan session:", error);
      setIsLoading(false);
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
      const plannedSessionTasks = sessionTasks.map((task) => ({
        taskId: task.id,
        title: task.title,
        projectId: task.project_id || undefined,
        projectName: projects?.find((p) => p.id === task.project_id)?.name,
        projectColor:
          projects?.find((p) => p.id === task.project_id)?.color || undefined,
        done: false,
        estimatedMinutes: task.estimated_minutes,
      }));

      // Also convert to session store format
      const sessionStoreTasks = sessionTasks.map((task) => ({
        position: 0,
        taskId: task.id,
        projectId: task.project_id,
        projectName: task.project_id ? projects?.find((p) => p.id === task.project_id)?.name : undefined,
        projectColor: task.project_id ? projects?.find((p) => p.id === task.project_id)?.color || undefined : undefined,
        isSolo: task.project_id === null,
        tier1: false,
        milestoneTitle: null,
        title: task.title,
        priority: task.priority,
        scheduledMinutes: task.estimated_minutes,
        partial: false,
        carryOverMinutes: 0,
        done: false,
        estimatedMinutes: task.estimated_minutes,
      }));

      setFocusSession(
        unfinishedFocusSession.id,
        sessionStoreTasks,
        unfinishedFocusSession.budget_minutes,
      );
      setPlannedTasks(plannedSessionTasks);
      setUnfinishedFocusSession(null);
      router.push("/session/focus");
    } catch (error) {
      console.error("Failed to continue session:", error);
    }
  };

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
      <div className="flex flex-col min-h-screen">
        {/* 2% top padding */}
        <div className="h-[2vh]"></div>

        {/* Header */}
        <div className="px-6 pt-4 mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push("/profile")}
            className="flex items-center gap-3"
          >
            <img
              src={getDiceBearUrl("user-id", "#F5C518")}
              alt="User avatar"
              className="w-12 h-12 rounded-none border-4 border-[#ffffff]"
            />
            <span className="text-white text-base font-medium">
              Your studio &gt;
            </span>
          </button>
        </div>

        {/* Target Projects */}
        <div className="px-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-xl font-bold">Target projects</h2>
            <button
              onClick={() => router.push("/projects/select")}
              className="bg-[#FFD233] text-black rounded-full px-5 py-1.5 text-sm font-semibold hover:bg-[#FFD233]/90 transition-colors"
            >
              Swap
            </button>
          </div>
          {!projects || projects.length === 0 ? (
            <div className="flex items-center justify-center h-20">
              <p className="text-text-sec text-center">No projects</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="flex-shrink-0 hover:scale-105 transition-transform"
                >
                  <img
                    src={getDiceBearUrl(project.id, project.color || undefined)}
                    alt={project.name}
                    className="w-20 h-20 rounded-none border-1 border-[#ffffff]"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tasks Header with Time Button */}
        <div className="flex items-center justify-between px-6 mb-4">
          <h3 className="text-white text-lg font-semibold">
            {isLoading ? "..." : plannedTasks.length} Tasks
          </h3>
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

        {/* Scrollable Task List */}
        <div className="flex-1 overflow-y-auto px-6">
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
                <TaskCard
                  key={task.taskId}
                  task={task}
                  onClick={() => {
                    if (task.projectId) {
                      router.push(`/projects/${task.projectId}`)
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Space - this will grow/shrink based on content */}
        <div className="flex-1"></div>

        {/* Fixed Bottom Section */}
        <div className="flex flex-col">
          {/* Start Work Button */}
          <div className="px-6 pb-4">
            <button
              onClick={handleStartWork}
              disabled={plannedTasks.length === 0 || isLoading}
              className="w-full bg-accent-yellow text-black font-bold text-lg py-4 rounded-none hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-[#ffffff]"
            >
              Start work
            </button>
          </div>

          {/* Bottom padding for tab bar space */}
          <div className="h-24"></div>
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
    </AppShell>
  );
}
