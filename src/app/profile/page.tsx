'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useCurrentUser } from '@/hooks/useAuth'
import { useSessions } from '@/hooks/useSessions'
import { getDiceBearUrl } from '@/lib/avatar'
import { ChangeSessionTimeDialog } from '@/components/dialogs/ChangeSessionTimeDialog'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'

export default function ProfilePage() {
  const router = useRouter()
  const { data: user } = useCurrentUser()
  const { data: sessions = [] } = useSessions()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Query for completed tasks
  const { data: completedTasks = [] } = useQuery({
    queryKey: ['tasks', 'completed'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
      if (error) throw error
      return data
    },
  })

  // Calculate stats
  const totalSessions = sessions.length
  const totalMinutes = sessions
    .filter(session => session.end_time)
    .reduce((sum, session) => sum + session.budget_minutes, 0)
  const tasksDone = completedTasks.length

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <AppShell showTabBar={false}>
      <div className="min-h-screen bg-bg-primary">
        {/* Header with back button */}
        <div className="flex items-center p-4">
          <button 
            onClick={handleBack}
            className="text-white hover:opacity-80 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>

        {/* Profile section */}
        <div className="flex flex-col items-center px-6">
          {/* Avatar */}
          {user && (
            <img
              src={getDiceBearUrl(user.id, '#F5C518')}
              alt="Profile avatar"
              className="w-20 h-20 rounded-full mb-4"
            />
          )}

          {/* Name and email */}
          <div className="text-center mb-8">
            <h1 className="text-xl font-bold text-white mb-1">
              {user?.user_metadata?.first_name && user?.user_metadata?.last_name 
                ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
                : user?.email?.split('@')[0] || 'User'
              }
            </h1>
            <p className="text-text-sec text-sm">{user?.email}</p>
          </div>

          {/* Stats row */}
          <div className="flex gap-3 w-full mb-8">
            <div className="flex-1 bg-bg-card rounded-2xl p-3 text-center">
              <div className="text-white font-bold text-lg">{totalSessions}</div>
              <div className="text-text-sec text-xs">Sessions</div>
            </div>
            <div className="flex-1 bg-bg-card rounded-2xl p-3 text-center">
              <div className="text-white font-bold text-lg">{totalMinutes}</div>
              <div className="text-text-sec text-xs">Minutes</div>
            </div>
            <div className="flex-1 bg-bg-card rounded-2xl p-3 text-center">
              <div className="text-white font-bold text-lg">{tasksDone}</div>
              <div className="text-text-sec text-xs">Tasks done</div>
            </div>
          </div>

          {/* Settings section */}
          <div className="w-full">
            <h2 className="text-lg font-bold text-white mb-4 px-4">Settings</h2>
            
            {/* Settings list */}
            <div className="px-4">
              <button
                onClick={() => setIsDialogOpen(true)}
                className="w-full bg-bg-card rounded-2xl px-4 py-4 mb-2 flex justify-between items-center hover:bg-bg-card/80 transition-colors"
              >
                <span className="text-white">Default duration</span>
                <ChevronRight className="w-5 h-5 text-text-sec" />
              </button>
              
              <button
                className="w-full bg-bg-card rounded-2xl px-4 py-4 mb-2 flex justify-between items-center hover:bg-bg-card/80 transition-colors"
                disabled
              >
                <span className="text-white">Notifications</span>
                <ChevronRight className="w-5 h-5 text-text-sec" />
              </button>
              
              <button
                className="w-full bg-bg-card rounded-2xl px-4 py-4 mb-2 flex justify-between items-center hover:bg-bg-card/80 transition-colors"
                disabled
              >
                <span className="text-white">About</span>
                <ChevronRight className="w-5 h-5 text-text-sec" />
              </button>
            </div>
          </div>

          {/* Sign out button */}
          <div className="w-full px-4 mt-8">
            <button
              onClick={handleSignOut}
              className="w-full bg-bg-card border border-accent-pink text-accent-pink font-bold rounded-2xl h-12 hover:bg-accent-pink/10 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Change Session Time Dialog */}
      <ChangeSessionTimeDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </AppShell>
  )
}
