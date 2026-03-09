import { ReactNode } from 'react'
import { TabBar } from './TabBar'

interface AppShellProps {
  children: ReactNode
  showTabBar?: boolean
}

export function AppShell({ children, showTabBar = true }: AppShellProps) {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-bg-primary relative">
      <div className={showTabBar ? 'pb-20' : ''}>
        {children}
      </div>
      {showTabBar && <TabBar />}
    </div>
  )
}
