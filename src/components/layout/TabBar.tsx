'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { HomeIcon, SparklesIcon, CalendarDaysIcon, PlusIcon, XMarkIcon, FolderIcon, FlagIcon } from '@heroicons/react/24/outline'

export function TabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [showAddMenu, setShowAddMenu] = useState(false)

  const handleProjectClick = () => {
    setShowAddMenu(false)
    router.push('/projects/new')
  }

  const handleTaskClick = () => {
    setShowAddMenu(false)
    router.push('/tasks/new')
  }

  const handleMilestoneClick = () => {
    setShowAddMenu(false)
    router.push('/milestones/new')
  }

  const handleCloseMenu = () => {
    setShowAddMenu(false)
  }

  const tabs = [
    { 
      icon: HomeIcon, 
      label: 'Home', 
      href: '/' 
    },
    { 
      icon: SparklesIcon, 
      label: 'Chat', 
      href: '/chat' 
    },
    { 
      icon: CalendarDaysIcon, 
      label: 'Logs', 
      href: '/logs' 
    },
    { 
      icon: PlusIcon, 
      label: 'Add', 
      href: '#',
      isSpecial: true,
      onClick: () => setShowAddMenu(true)
    },
  ]

  return (
    <>
      <div className="fixed bottom-5 left-0 right-0 bg-transparent h-20 z-50">
        <div className="flex justify-around items-center h-full max-w-md mx-auto px-4">
          {tabs.map(({ icon: Icon, label, href, isSpecial, onClick }) => {
            const isActive = pathname === href
            return (
              <div key={href}>
                {isSpecial ? (
                  <button
                    onClick={onClick}
                    className="relative flex items-center justify-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#FFD233] flex items-center justify-center transition-all">
                      <Icon className="w-6 h-6 text-[#060606]" />
                    </div>
                  </button>
                ) : (
                  <Link
                    href={href}
                    className="relative flex items-center justify-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#2A2A2A] flex items-center justify-center transition-all">
                      <Icon 
                        className={`w-6 h-6 transition-colors ${
                          isActive ? 'text-[#FFD233]' : 'text-[#666666]'
                        }`} 
                      />
                    </div>
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Menu Modal */}
      {showAddMenu && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
          <div className="bg-[#1A1A1A] rounded-none w-full max-w-sm mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#333333]">
              <h2 className="text-white text-lg font-semibold">Add New</h2>
              <button
                onClick={handleCloseMenu}
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
                    <p className="text-[#666666] text-sm">Create a new project to organize tasks</p>
                  </div>
                </button>

                {/* Task Option */}
                <button
                  onClick={handleTaskClick}
                  className="w-full bg-[#2A2A2A] border border-[#333333] rounded-none p-4 flex items-center gap-4 hover:bg-[#333333] transition-colors"
                >
                  <div className="w-12 h-12 bg-[#FFD233] rounded-none flex items-center justify-center">
                    <CalendarDaysIcon className="w-6 h-6 text-black" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white font-semibold">New Task</h3>
                    <p className="text-[#666666] text-sm">Add a new task to your workspace</p>
                  </div>
                </button>

                {/* Milestone Option */}
                <button
                  onClick={handleMilestoneClick}
                  className="w-full bg-[#2A2A2A] border border-[#333333] rounded-none p-4 flex items-center gap-4 hover:bg-[#333333] transition-colors"
                >
                  <div className="w-12 h-12 bg-[#FFD233] rounded-none flex items-center justify-center">
                    <FlagIcon className="w-6 h-6 text-black" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white font-semibold">New Milestone</h3>
                    <p className="text-[#666666] text-sm">Create a milestone and organize tasks</p>
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
      )}
    </>
  )
}
