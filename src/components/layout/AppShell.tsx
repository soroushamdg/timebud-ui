import { ReactNode } from 'react'
import { TabBar } from './TabBar'
import { InstallPwaPrompt } from '@/components/pwa/InstallPwaPrompt'
import { AmbientBackground } from './AmbientBackground'

interface AppShellProps {
  children: ReactNode
  showTabBar?: boolean
}

export function AppShell({ children, showTabBar = true }: AppShellProps) {
  return (
    <div className="relative md:flex md:min-h-screen md:items-center md:justify-center md:p-10">
      <AmbientBackground />
      <div className="app-box relative z-10 w-full max-w-md mx-auto min-h-screen bg-bg-primary overflow-visible md:min-h-0 md:h-[calc(100vh-5rem)] md:overflow-hidden md:overflow-y-auto md:rounded-4xl md:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.65)] md:ring-1 md:ring-white/10">
        <div className={showTabBar ? 'pb-0' : ''}>
          {children}
        </div>
        <InstallPwaPrompt />
        {showTabBar && <TabBar />}
      </div>
    </div>
  )
}
