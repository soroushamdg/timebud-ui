'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function TabBar() {
  const pathname = usePathname()

  const NIcon = ({ isActive }: { isActive: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={isActive ? "#F5C518" : "#888888"}/>
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">N</text>
    </svg>
  )

  const IslandIcon = ({ isActive }: { isActive: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={isActive ? "#F5C518" : "#888888"}/>
      <path d="M7 14 Q12 8, 17 14" fill="#FDB863"/>
      <path d="M8 14 L16 14 L15 16 L9 16 Z" fill="#D4A574"/>
      <path d="M11 10 L13 10 L12 8 Z" fill="#228B22"/>
      <circle cx="18" cy="6" r="2" fill="#FFD700"/>
    </svg>
  )

  const tabs = [
    { icon: NIcon, label: 'Home', href: '/' },
    { icon: IslandIcon, label: 'Island', href: '/island' },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#1A1A1A] border-t border-border-card h-16 pb-safe z-50">
      <div className="flex justify-around items-center h-full max-w-md mx-auto">
        {tabs.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center flex-1 h-full"
            >
              <div>
                <Icon isActive={isActive} />
              </div>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 bg-[#F5C518] rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
