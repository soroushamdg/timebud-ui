"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
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
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
      <div className="bg-[#1A1A1A] rounded-none w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333333]">
          <h2 className="text-white text-lg font-semibold">Add New</h2>
          <button
            onClick={handleClose}
            className="text-[#666666] hover:text-white transition-colors"
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
              className="w-full bg-[#2A2A2A] border border-[#333333] rounded-none p-4 flex items-center gap-4 hover:bg-[#333333] transition-colors"
            >
              <div className="w-12 h-12 bg-[#FFD233] rounded-none flex items-center justify-center">
                <FolderIcon className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-white font-semibold">New Project</h3>
                <p className="text-[#666666] text-sm">
                  Create a new project to organize tasks
                </p>
              </div>
            </button>

            {/* Task Option */}
            <button
              onClick={handleTaskClick}
              className="w-full bg-[#2A2A2A] border border-[#333333] rounded-none p-4 flex items-center gap-4 hover:bg-[#333333] transition-colors"
            >
              <div className="w-12 h-12 bg-[#FFD233] rounded-none flex items-center justify-center">
                <DocumentTextIcon className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-white font-semibold">New Task</h3>
                <p className="text-[#666666] text-sm">
                  Add a new task to your workspace
                </p>
              </div>
            </button>
          </div>

          {/* Quick Tip */}
          <div className="mt-6 p-3 bg-[#2A2A2A] rounded-none border border-[#333333]">
            <p className="text-[#666666] text-sm text-center">
              💡 You can also access these options from the home screen
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
