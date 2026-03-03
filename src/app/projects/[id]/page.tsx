"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import {
  getProjectProjectsProjectIdGet,
  listProjectMilestonesProjectsProjectIdMilestonesGet,
  createMilestoneProjectsProjectIdMilestonesPost,
  listMilestoneTasksMilestonesMilestoneIdTasksGet,
  createTaskMilestonesMilestoneIdTasksPost,
  ProjectResponse,
  MilestoneResponse,
  TaskResponse,
  MilestoneCreate,
  TaskCreate,
} from "@/client";
import { apiClient } from "@/lib/api-client";
import { MilestoneList } from "@/components/MilestoneList";

export default function ProjectDetailPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [tasks, setTasks] = useState<Record<string, TaskResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);

  const fetchProjectData = async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const projectResponse = await getProjectProjectsProjectIdGet({
        client: apiClient,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        path: {
          project_id: projectId,
        },
      });

      if (projectResponse.data) {
        setProject(projectResponse.data);
      }

      const milestonesResponse = await listProjectMilestonesProjectsProjectIdMilestonesGet({
        client: apiClient,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        path: {
          project_id: projectId,
        },
      });

      if (milestonesResponse.data) {
        const milestonesData = Array.isArray(milestonesResponse.data)
          ? milestonesResponse.data
          : [];
        setMilestones(milestonesData);

        const tasksData: Record<string, TaskResponse[]> = {};
        for (const milestone of milestonesData) {
          const tasksResponse = await listMilestoneTasksMilestonesMilestoneIdTasksGet({
            client: apiClient,
            headers: {
              Authorization: `Bearer ${token}`,
            },
            path: {
              milestone_id: milestone.id,
            },
          });

          if (tasksResponse.data) {
            tasksData[milestone.id] = Array.isArray(tasksResponse.data)
              ? tasksResponse.data
              : [];
          }
        }
        setTasks(tasksData);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching project data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch project data");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId, getToken]);

  const handleAddMilestone = async () => {
    const title = newMilestoneTitle.trim();
    if (!title) return;

    setIsAddingMilestone(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const milestoneData: MilestoneCreate = {
        title,
        project_id: projectId,
      };

      const response = await createMilestoneProjectsProjectIdMilestonesPost({
        client: apiClient,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        path: {
          project_id: projectId,
        },
        body: milestoneData,
      });

      if (response.data) {
        setNewMilestoneTitle("");
        await fetchProjectData();
      }
    } catch (err) {
      console.error("Error adding milestone:", err);
      alert("Failed to add milestone. Please try again.");
    } finally {
      setIsAddingMilestone(false);
    }
  };

  const handleAddTask = async (milestoneId: string, title: string) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const taskData: TaskCreate = {
        title,
        project_id: projectId,
      };

      const response = await createTaskMilestonesMilestoneIdTasksPost({
        client: apiClient,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        path: {
          milestone_id: milestoneId,
        },
        body: taskData,
      });

      if (response.data) {
        await fetchProjectData();
      }
    } catch (err) {
      console.error("Error adding task:", err);
      alert("Failed to add task. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-gray-600">Loading project...</div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-red-600 mb-4">{error || "Project not found"}</p>
          <button
            onClick={() => router.push("/home")}
            className="min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <button
          onClick={() => router.push("/home")}
          className="mb-6 text-gray-600 hover:text-gray-900 flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Home
        </button>

        <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {project.name}
          </h1>
          {project.description && (
            <p className="text-gray-600 mb-6 whitespace-pre-wrap">
              {project.description}
            </p>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            {project.priority && (
              <span
                className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                  project.priority === "high"
                    ? "bg-red-100 text-red-800 border-red-200"
                    : project.priority === "medium"
                    ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                    : "bg-green-100 text-green-800 border-green-200"
                }`}
              >
                {project.priority.charAt(0).toUpperCase() + project.priority.slice(1)} Priority
              </span>
            )}
            {project.deadline && (
              <span className="text-sm text-gray-600">
                Due: {new Date(project.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Milestones</h2>

          <div className="mb-6 bg-white rounded-lg border-2 border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Add New Milestone
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddMilestone();
                  }
                }}
                placeholder="Milestone title..."
                className="flex-1 min-h-[44px] px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddMilestone}
                disabled={!newMilestoneTitle.trim() || isAddingMilestone}
                className="min-h-[44px] px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isAddingMilestone ? "Adding..." : "Add Milestone"}
              </button>
            </div>
          </div>

          <MilestoneList
            milestones={milestones}
            tasks={tasks}
            onAddTask={handleAddTask}
          />
        </div>
      </div>
    </div>
  );
}
