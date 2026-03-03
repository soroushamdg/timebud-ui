"use client";

import { ProjectResponse } from "@/client";
import { formatDistanceToNow } from "date-fns";

interface ProjectCardProps {
  project: ProjectResponse;
  onClick?: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const getPriorityColor = (priority: string | null | undefined) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const isUrgent = (deadline: string | null | undefined) => {
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const hoursUntilDeadline = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilDeadline <= 48 && hoursUntilDeadline > 0;
  };

  const formatDeadline = (deadline: string | null | undefined) => {
    if (!deadline) return "No deadline";
    try {
      return formatDistanceToNow(new Date(deadline), { addSuffix: true });
    } catch {
      return "Invalid date";
    }
  };

  const urgent = isUrgent(project.deadline);

  return (
    <button
      onClick={onClick}
      className={`w-full min-h-[88px] p-6 rounded-lg border-2 transition-all hover:shadow-md text-left ${
        urgent ? "border-red-500 bg-red-50" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-gray-900 leading-tight">
          {project.name}
        </h3>
        
        <div className="flex items-center gap-3 flex-wrap">
          {project.priority && (
            <span
              className={`px-3 py-1.5 rounded-full text-sm font-medium border ${getPriorityColor(
                project.priority
              )}`}
            >
              {project.priority.charAt(0).toUpperCase() + project.priority.slice(1)}
            </span>
          )}
          
          <span className={`text-sm ${urgent ? "text-red-700 font-semibold" : "text-gray-600"}`}>
            {formatDeadline(project.deadline)}
          </span>
        </div>
      </div>
    </button>
  );
}
