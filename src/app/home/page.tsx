"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { listProjectsProjectsGet, ProjectResponse } from "@/client";
import { apiClient } from "@/lib/api-client";
import { ProjectCard } from "@/components/ProjectCard";

export default function HomePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("No authentication token available");
        }

        const response = await listProjectsProjectsGet({
          client: apiClient,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data) {
          setProjects(Array.isArray(response.data) ? response.data : []);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error fetching projects:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch projects");
        setLoading(false);
      }
    };

    fetchProjects();
  }, [getToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-gray-600">Loading your projects...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-red-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-12">TimeBud</h1>

        <div className="space-y-8">
          <button
            onClick={() => router.push("/session/new")}
            className="w-full min-h-[88px] px-8 py-6 bg-blue-600 text-white rounded-lg font-semibold text-xl hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
          >
            Start Session
          </button>

          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                Active Projects
              </h2>
              <button
                onClick={() => router.push("/projects/new")}
                className="min-h-[44px] px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Add Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-500 text-lg mb-6">
                  No active projects yet
                </p>
                <button
                  onClick={() => router.push("/projects/new")}
                  className="min-h-[44px] px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Create Your First Project
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => router.push(`/projects/${project.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
