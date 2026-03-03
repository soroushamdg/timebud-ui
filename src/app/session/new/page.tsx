"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { createSessionSessionsPost } from "@/client";

export default function NewSessionPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [budgetMinutes, setBudgetMinutes] = useState<string>("60");

  const createSessionMutation = useMutation({
    mutationFn: async (minutes: number) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await createSessionSessionsPost({
        body: {},
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.error) {
        throw new Error("Failed to create session");
      }

      return response.data;
    },
    onSuccess: (session) => {
      if (session?.id) {
        router.push(`/session/${session.id}`);
      }
    },
  });

  const handleStart = () => {
    const minutes = parseInt(budgetMinutes, 10);
    if (minutes > 0) {
      createSessionMutation.mutate(minutes);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-md space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            How long can you work right now?
          </h1>
        </div>

        <div className="space-y-8">
          <div className="relative">
            <input
              type="number"
              value={budgetMinutes}
              onChange={(e) => setBudgetMinutes(e.target.value)}
              className="w-full text-center text-7xl font-bold text-gray-900 border-0 border-b-4 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-0 pb-4"
              min="1"
              max="480"
              autoFocus
            />
            <p className="text-center text-xl text-gray-500 mt-4">minutes</p>
          </div>

          <button
            onClick={handleStart}
            disabled={createSessionMutation.isPending || !budgetMinutes || parseInt(budgetMinutes) <= 0}
            className="w-full h-14 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {createSessionMutation.isPending ? "Starting..." : "Start"}
          </button>
        </div>

        {createSessionMutation.isError && (
          <div className="text-center text-red-600 text-sm">
            Failed to start session. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}
