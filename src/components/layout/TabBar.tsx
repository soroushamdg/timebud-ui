'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { HomeIcon, ChatBubbleLeftRightIcon, DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline'

export function TabBar() {
  const pathname = usePathname()

  const tabs = [
    { 
      icon: HomeIcon, 
      label: 'Home', 
      href: '/' 
    },
    { 
      icon: ChatBubbleLeftRightIcon, 
      label: 'Chat', 
      href: '/chat' 
    },
    { 
      icon: DocumentTextIcon, 
      label: 'Logs', 
      href: '/logs' 
    },
    { 
      icon: PlusIcon, 
      label: 'Add', 
      href: '/add',
      isSpecial: true 
    },
  ]

  return (
    <div className="fixed bottom-5 left-0 right-0 bg-transparent h-20 z-50">
      <div className="flex justify-around items-center h-full max-w-md mx-auto px-4">
        {tabs.map(({ icon: Icon, label, href, isSpecial }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="relative flex items-center justify-center"
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isSpecial 
                  ? 'bg-[#FFD233]' 
                  : 'bg-[#2A2A2A]'
              }`}>
                <Icon 
                  className={`w-6 h-6 transition-colors ${
                    isSpecial 
                      ? 'text-[#666666]'
                      : isActive 
                        ? 'text-[#FFD233]' 
                        : 'text-[#666666]'
                  }`} 
                />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
