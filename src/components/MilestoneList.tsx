"use client";

import { useState } from "react";
import { MilestoneResponse, TaskResponse } from "@/client";

interface MilestoneListProps {
  milestones: MilestoneResponse[];
  tasks: Record<string, TaskResponse[]>;
  onAddTask?: (milestoneId: string, title: string) => void;
}

export function MilestoneList({ milestones, tasks, onAddTask }: MilestoneListProps) {
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [newTaskTitles, setNewTaskTitles] = useState<Record<string, string>>({});

  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(milestoneId)) {
        next.delete(milestoneId);
      } else {
        next.add(milestoneId);
      }
      return next;
    });
  };

  const handleAddTask = (milestoneId: string) => {
    const title = newTaskTitles[milestoneId]?.trim();
    if (title && onAddTask) {
      onAddTask(milestoneId, title);
      setNewTaskTitles((prev) => ({ ...prev, [milestoneId]: "" }));
    }
  };

  if (milestones.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No milestones yet. Add your first milestone to get started.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {milestones.map((milestone) => {
        const milestoneTasks = tasks[milestone.id] || [];
        const isExpanded = expandedMilestones.has(milestone.id);
        const completedCount = milestoneTasks.filter((t) => t.status === "done").length;

        return (
          <div
            key={milestone.id}
            className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white"
          >
            <button
              onClick={() => toggleMilestone(milestone.id)}
              className="w-full min-h-[66px] px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {milestone.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {milestoneTasks.length} {milestoneTasks.length === 1 ? "task" : "tasks"}
                  {milestoneTasks.length > 0 && ` · ${completedCount} completed`}
                </p>
              </div>
              <svg
                className={`w-6 h-6 text-gray-400 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
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
            </button>

            {isExpanded && (
              <div className="border-t-2 border-gray-100 px-6 py-4 bg-gray-50">
                {milestoneTasks.length > 0 ? (
                  <ul className="space-y-2 mb-4">
                    {milestoneTasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-start gap-3 p-3 bg-white rounded border border-gray-200"
                      >
                        <div
                          className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 ${
                            task.status === "done"
                              ? "bg-green-500 border-green-500"
                              : "border-gray-300"
                          }`}
                        >
                          {task.status === "done" && (
                            <svg
                              className="w-full h-full text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p
                            className={`text-sm ${
                              task.status === "done"
                                ? "text-gray-500 line-through"
                                : "text-gray-900"
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.estimated_minutes && (
                            <p className="text-xs text-gray-500 mt-1">
                              ~{task.estimated_minutes} min
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 mb-4">No tasks yet.</p>
                )}

                {onAddTask && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTaskTitles[milestone.id] || ""}
                      onChange={(e) =>
                        setNewTaskTitles((prev) => ({
                          ...prev,
                          [milestone.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddTask(milestone.id);
                        }
                      }}
                      placeholder="Add a task..."
                      className="flex-1 min-h-[44px] px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => handleAddTask(milestone.id)}
                      disabled={!newTaskTitles[milestone.id]?.trim()}
                      className="min-h-[44px] px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
