"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { getSessionTasksSessionsSessionIdTasksGet } from "@/client";

export default function SessionDonePage() {
  const router = useRouter();
  const params = useParams();
  const { getToken } = useAuth();
  const sessionId = params.id as string;

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-xl text-gray-600">Loading summary...</div>
      </div>
    );
  }

  const completedTasks = sessionTasks?.filter((task: any) => 
    task.status === "done" || task.time_spent_minutes !== undefined
  ) || [];
  
  const totalTimeSpent = sessionTasks?.reduce((sum: number, task: any) => 
    sum + (task.time_spent_minutes || 0), 0
  ) || 0;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-12">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900">
            Session Complete
          </h1>

          <div className="space-y-4 pt-4">
            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg text-gray-600">Tasks Completed</span>
                <span className="text-3xl font-bold text-gray-900">
                  {completedTasks.length}
                </span>
              </div>

              {totalTimeSpent > 0 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-lg text-gray-600">Time Spent</span>
                  <span className="text-2xl font-semibold text-gray-900">
                    {totalTimeSpent} min
                  </span>
                </div>
              )}
            </div>

            {completedTasks.length > 0 && (
              <div className="text-left space-y-2 pt-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Completed Tasks
                </h2>
                <ul className="space-y-2">
                  {completedTasks.map((task: any, index: number) => (
                    <li key={task.id || index} className="flex items-start gap-2 text-gray-700">
                      <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{task.title || "Task"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => router.push("/home")}
          className="w-full h-14 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          Return Home
        </button>
      </div>
    </div>
  );
}
