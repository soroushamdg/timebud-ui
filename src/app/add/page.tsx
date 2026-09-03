"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  FolderIcon,
  DocumentTextIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export default function AddPage() {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(true);

  const handleProjectClick = () => {
    router.push("/projects/new");
  };

  const handleTaskClick = () => {
    router.push("/tasks/new");
  };

  const handleClose = () => {
    router.push("/");
  };

  if (!showMenu) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-scrim/50 z-[100] flex items-center justify-center">
      <div className="bg-tab-bg rounded-none w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-card">
          <h2 className="text-text-primary text-lg font-semibold">Add New</h2>
          <button
            onClick={handleClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="space-y-3">
            {/* Project Option */}
            <button
              onClick={handleProjectClick}
              className="w-full bg-secondary-surface border border-border-card rounded-none p-4 flex items-center gap-4 hover:bg-bg-card-hover transition-colors"
            >
              <div className="w-12 h-12 bg-accent-yellow rounded-none flex items-center justify-center">
                <FolderIcon className="w-6 h-6 text-on-light-accent" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-text-primary font-semibold">New Mission</h3>
                <p className="text-text-tertiary text-sm">
                  Create a new mission to organize jobs
                </p>
              </div>
            </button>

            {/* Task Option */}
            <button
              onClick={handleTaskClick}
              className="w-full bg-secondary-surface border border-border-card rounded-none p-4 flex items-center gap-4 hover:bg-bg-card-hover transition-colors"
            >
              <div className="w-12 h-12 bg-accent-yellow rounded-none flex items-center justify-center">
                <DocumentTextIcon className="w-6 h-6 text-on-light-accent" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-text-primary font-semibold">New Job</h3>
                <p className="text-text-tertiary text-sm">
                  Add a new job to your workspace
                </p>
              </div>
            </button>
          </div>

          {/* Quick Tip */}
          <div className="mt-6 p-3 bg-secondary-surface rounded-none border border-border-card">
            <p className="text-text-tertiary text-sm text-center">
              💡 You can also access these options from the home screen
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
