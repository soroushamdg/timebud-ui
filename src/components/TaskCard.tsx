import { TaskResponse } from "@/client";

interface TaskCardProps {
  task: TaskResponse;
  projectName?: string;
}

export function TaskCard({ task, projectName }: TaskCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
      {projectName && (
        <div className="text-sm text-gray-500 font-medium">
          {projectName}
        </div>
      )}
      
      <h2 className="text-3xl font-bold text-gray-900 leading-tight">
        {task.title}
      </h2>
      
      {task.description && (
        <p className="text-lg text-gray-600">
          {task.description}
        </p>
      )}
      
      {task.estimated_minutes && (
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-lg font-medium">
            {task.estimated_minutes} min
          </span>
        </div>
      )}
    </div>
  );
}
