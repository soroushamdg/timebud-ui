'use client'

import { AppShell } from '@/components/layout/AppShell'

interface MainLayoutClientProps {
  children: React.ReactNode
}

export function MainLayoutClient({ children }: MainLayoutClientProps) {
  return <AppShell>{children}</AppShell>
}
