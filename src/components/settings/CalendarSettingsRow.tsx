'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { useGoogleCalendarConnection } from '@/hooks/useGoogleCalendarConnection'

export function CalendarSettingsRow() {
  const router = useRouter()
  const { isConnected, isLoading } = useGoogleCalendarConnection()

  return (
    <button
      onClick={() => router.push('/profile/calendar')}
      className="w-full bg-bg-card rounded-none px-4 py-4 mb-2 flex justify-between items-center hover:bg-bg-card/80 transition-colors"
    >
      <span className="text-text-primary">Calendar</span>
      <div className="flex items-center gap-2">
        {isLoading ? (
          <div className="h-4 w-20 bg-border-card rounded animate-pulse"></div>
        ) : (
          <span className={isConnected ? 'text-accent-yellow font-semibold' : 'text-text-sec'}>
            {isConnected ? 'Connected' : 'Not connected'}
          </span>
        )}
        <ChevronRight className="w-5 h-5 text-text-sec" />
      </div>
    </button>
  )
}
