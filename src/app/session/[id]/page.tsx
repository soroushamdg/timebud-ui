"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  getSessionTasksSessionsSessionIdTasksGet,
  completeTaskTasksTaskIdCompletePatch,
  skipTaskTasksTaskIdSkipPatch,
  type SessionTaskResponse,
  type TaskResponse,
} from "@/client";
import { TaskCard } from "@/components/TaskCard";

export default function SessionPage() {
  const router = useRouter();
  const params = useParams();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const sessionId = params.id as string;

  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [showTransition, setShowTransition] = useState(false);

  const { data: sessionTasks, isLoading } = useQuery({
    queryKey: ["session-tasks", sessionId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await getSessionTasksSessionsSessionIdTasksGet({
        path: { session_id: sessionId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.error) {
        throw new Error("Failed to load session tasks");
      }

      return response.data || [];
    },
    enabled: !!sessionId,
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await completeTaskTasksTaskIdCompletePatch({
        path: { task_id: taskId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.error) {
        throw new Error("Failed to complete task");
      }

      return response.data;
    },
    onSuccess: () => {
      setShowTransition(true);
      setCompletedCount((prev) => prev + 1);
      
      setTimeout(() => {
        setShowTransition(false);
        if (currentTaskIndex < (sessionTasks?.length || 0) - 1) {
          setCurrentTaskIndex((prev) => prev + 1);
        } else {
          router.push(`/session/${sessionId}/done`);
        }
      }, 500);
    },
  });

  const skipTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await skipTaskTasksTaskIdSkipPatch({
        path: { task_id: taskId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.error) {
        throw new Error("Failed to skip task");
      }

      return response.data;
    },
    onSuccess: () => {
      if (currentTaskIndex < (sessionTasks?.length || 0) - 1) {
        setCurrentTaskIndex((prev) => prev + 1);
      } else {
        router.push(`/session/${sessionId}/done`);
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading session...</div>
      </div>
    );
  }

  if (!sessionTasks || sessionTasks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-xl text-gray-600">No tasks in this session</p>
          <button
            onClick={() => router.push("/home")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const currentTask = sessionTasks[currentTaskIndex] as any;
  const totalTasks = sessionTasks.length;
  const progressPercent = (completedCount / totalTasks) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div 
        className="h-1 bg-green-500 transition-all duration-300"
        style={{ width: `${progressPercent}%` }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-right text-sm text-gray-500 font-medium">
            {completedCount} / {totalTasks} tasks
          </div>

          <div
            className={`transition-all duration-500 ${
              showTransition ? "opacity-0 scale-95" : "opacity-100 scale-100"
            }`}
          >
            <TaskCard task={currentTask as TaskResponse} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => skipTaskMutation.mutate(currentTask.task_id || currentTask.id)}
              disabled={skipTaskMutation.isPending}
              className="h-14 bg-gray-200 text-gray-700 text-lg font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Skip
            </button>

            <button
              className="h-14 bg-blue-100 text-blue-700 text-lg font-semibold rounded-lg hover:bg-blue-200 active:bg-blue-300 transition-colors"
            >
              How?
            </button>

            <button
              onClick={() => completeTaskMutation.mutate(currentTask.task_id || currentTask.id)}
              disabled={completeTaskMutation.isPending}
              className="h-14 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
