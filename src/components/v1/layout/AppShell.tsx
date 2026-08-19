import { ReactNode } from 'react'
import { TabBar } from './TabBar'
import { InstallPwaPrompt } from '@/components/pwa/InstallPwaPrompt'

interface AppShellProps {
  children: ReactNode
  showTabBar?: boolean
}

export function AppShell({ children, showTabBar = true }: AppShellProps) {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-bg-primary relative overflow-visible">
      <div className={showTabBar ? 'pb-0' : ''}>
        {children}
      </div>
      <InstallPwaPrompt />
      {showTabBar && <TabBar />}
    </div>
  )
}
