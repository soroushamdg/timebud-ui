"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskCardSkeleton } from "@/components/tasks/TaskCardSkeleton";
import { UnfinishedSessionModal } from "@/components/sessions/UnfinishedSessionModal";
import { ChangeSessionTimeDialog } from "@/components/sessions/ChangeSessionTimeDialog";
import { useLatestUnfinished } from "@/hooks/useLatestUnfinished";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { useCreateSession, useDeleteSession } from "@/hooks/useSessions";
import { planSession } from "@/lib/planner";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { getDiceBearUrl } from "@/lib/utils";
import { DbSession, DbTask } from "@/types/database";

interface PlannedTask {
  taskId: string;
  title: string;
  projectId?: string;
  projectName?: string;
  projectColor?: string;
  done?: boolean;
  percentage?: number;
}

export default function Home() {
  const router = useRouter();
  const [unfinishedSession, setUnfinishedSession] = useState<DbSession | null>(
    null,
  );
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([]);
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  const { data: latestUnfinished } = useLatestUnfinished();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: tasks, isLoading: tasksLoading } = useTasks({
    status: "pending",
  });
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const { preferredBudgetMinutes } = useUIStore();
  const setSession = useSessionStore((state) => state.setSession);
  const markTaskDone = useSessionStore((state) => state.markTaskDone);

  useEffect(() => {
    if (latestUnfinished) {
      setUnfinishedSession(latestUnfinished);
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

  // Handle click outside plus menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        plusMenuRef.current &&
        !plusMenuRef.current.contains(event.target as Node)
      ) {
        setShowPlusMenu(false);
      }
    };

    if (showPlusMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPlusMenu]);

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
      });

      if (plan.tasks.length === 0) {
        setPlannedTasks([]);
        setIsLoading(false);
        return;
      }

      const session = await createSession.mutateAsync({
        budget_minutes: preferredBudgetMinutes,
        tasks_list: plan.tasks.map((t) => t.taskId),
        end_time: null,
      });

      // Convert PlannedTaskResult to PlannedTask for TaskCard
      const tasksWithDone = plan.tasks.map((task) => ({
        taskId: task.taskId,
        title: task.title,
        projectId: task.projectId || undefined,
        projectName: projects?.find((p) => p.id === task.projectId)?.name,
        projectColor:
          projects?.find((p) => p.id === task.projectId)?.color || undefined,
        done: false,
        estimatedMinutes: task.scheduledMinutes,
      }));
      setSession(
        session.id,
        plan.tasks.map((t) => ({ ...t, done: false })) as any,
        session.budget_minutes,
      );
      setPlannedTasks(tasksWithDone);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to plan session:", error);
      setIsLoading(false);
    }
  };

  const handleContinueSession = async () => {
    if (!unfinishedSession) return;

    try {
      const sessionTasks = (
        await Promise.all(
          unfinishedSession.tasks_list.map((taskId) =>
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
      }));

      // Also convert to session store format
      const sessionStoreTasks = sessionTasks.map((task) => ({
        position: 0,
        taskId: task.id,
        projectId: task.project_id,
        isSolo: task.project_id === null,
        tier1: false,
        milestoneTitle: null,
        title: task.title,
        priority: task.priority,
        scheduledMinutes: task.estimated_minutes,
        partial: false,
        carryOverMinutes: 0,
        done: false,
      }));

      setSession(
        unfinishedSession.id,
        sessionStoreTasks,
        unfinishedSession.budget_minutes,
      );
      setPlannedTasks(plannedSessionTasks);
      setUnfinishedSession(null);
      router.push("/session/focus");
    } catch (error) {
      console.error("Failed to continue session:", error);
    }
  };

  const handleStartFresh = async () => {
    if (!unfinishedSession) return;

    try {
      await deleteSession.mutateAsync(unfinishedSession.id);
      setUnfinishedSession(null);
      await planSessionData();
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const handleStartWork = () => {
    router.push("/session/focus");
  };

  if (unfinishedSession) {
    return (
      <AppShell>
        <UnfinishedSessionModal
          session={unfinishedSession}
          onContinue={handleContinueSession}
          onStartFresh={handleStartFresh}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col min-h-screen pb-20">
        {/* Header with User Profile and Plus Button */}
        <div className="px-6 pt-4 mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push("/profile")}
            className="flex items-center gap-3"
          >
            <img
              src={getDiceBearUrl("user-id", "#F5C518")}
              alt="User avatar"
              className="w-12 h-12 rounded-lg"
            />
            <span className="text-white text-base font-medium">
              Your studio &gt;
            </span>
          </button>

          <div className="relative" ref={plusMenuRef}>
            <button
              onClick={() => setShowPlusMenu(!showPlusMenu)}
              className="w-10 h-10 rounded-full bg-accent-yellow flex items-center justify-center hover:bg-yellow-400 transition-colors"
            >
              <svg
                className="w-5 h-5 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showPlusMenu && (
              <div className="absolute top-12 right-0 bg-bg-card border border-border-card rounded-2xl py-2 min-w-[140px] shadow-lg z-50">
                <button
                  onClick={() => {
                    setShowPlusMenu(false);
                    router.push("/projects/new");
                  }}
                  className="w-full px-4 py-2 text-left text-white hover:bg-bg-card-hover transition-colors"
                >
                  New Project
                </button>
                <button
                  onClick={() => {
                    setShowPlusMenu(false);
                    router.push("/tasks/new");
                  }}
                  className="w-full px-4 py-2 text-left text-white hover:bg-bg-card-hover transition-colors"
                >
                  New Task
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Target Projects Header */}
        <div className="flex items-center justify-between px-6 mb-4">
          <h2 className="text-white text-xl font-bold">Target projects</h2>
          <button
            onClick={() => router.push("/projects/select")}
            className="bg-accent-yellow text-black rounded-full px-5 py-1.5 text-sm font-semibold hover:bg-yellow-400 transition-colors"
          >
            Swap
          </button>
        </div>

        {/* Horizontal Scrollable Project List */}
        <div className="px-6 mb-6">
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
                    className="w-20 h-20 rounded-2xl border-4 border-black"
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
            className="bg-bg-card text-white rounded-full px-5 py-2 text-sm font-medium hover:bg-opacity-80 transition-colors border border-border-card flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            {preferredBudgetMinutes}min
          </button>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto space-y-3 px-6 mb-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-text-sec text-center">Loading tasks...</p>
            </div>
          ) : plannedTasks.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-text-sec text-center">No tasks</p>
            </div>
          ) : (
            plannedTasks.map((task) => (
              <TaskCard
                key={task.taskId}
                task={task}
                onClick={() => {
                  if (task.projectId) {
                    router.push(`/projects/${task.projectId}`)
                  }
                }}
                onCheckmark={() => markTaskDone(task.taskId)}
              />
            ))
          )}
        </div>

        {/* Start Work Button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleStartWork}
            disabled={plannedTasks.length === 0 || isLoading}
            className="w-full bg-accent-yellow text-black font-bold text-lg py-4 rounded-2xl hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start work
          </button>
        </div>
      </div>

      {showTimeDialog && (
        <ChangeSessionTimeDialog onClose={() => setShowTimeDialog(false)} />
      )}
    </AppShell>
  );
}
