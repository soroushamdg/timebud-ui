'use client'

import { useState } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useFocusSessionStore } from '@/stores/sessionStore'
import { useUpdateFocusSession } from '@/hooks/useSessions'
import { useProjects } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { DbMilestone, DbProject, DbTask } from '@/types/database'
import { planSession, PlannerMilestone, PlannerTask } from '@/lib/planner'
import { X, HelpCircle } from 'lucide-react'
import { useReplan } from '@/contexts/ReplanContext'

interface ChangeSessionTimeDialogProps {
  isOpen: boolean
  onClose: () => void
}

const TIME_OPTIONS = [15, 25, 30, 45, 60, 90]

function formatTimeLabel(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  } else if (minutes === 60) {
    return '1 hour'
  } else {
    return `1h ${minutes - 60}min`
  }
}

export function ChangeSessionTimeDialog({ isOpen, onClose }: ChangeSessionTimeDialogProps) {
  const { preferredBudgetMinutes, setBudget, allowPartialTasks } = useUIStore()
  const { focusSessionId: sessionId, setFocusSession: setSession } = useFocusSessionStore()
  const updateSession = useUpdateFocusSession()
  const { triggerReplan } = useReplan()
  
  const { data: projects = [] } = useProjects()
  const { data: tasks = [] } = useTasks()
  
  // Custom hook to get all milestones for the user's projects
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', 'all'],
    queryFn: async (): Promise<DbMilestone[]> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || projects.length === 0) return []
      
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .in('project_id', projects.map((p: DbProject) => p.id))
        .order('order', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: projects.length > 0,
  })
  
  const [isReplanning, setIsReplanning] = useState(false)

  const handleTimeSelect = async (minutes: number) => {
    if (!sessionId || isReplanning) return

    setIsReplanning(true)
    
    try {
      // Update UI store - this will trigger global re-planning
      setBudget(minutes)
      
      // Update session in database
      await updateSession.mutateAsync({
        id: sessionId,
        budget_minutes: minutes,
        tasks_list: [], // Will be updated by the global re-planning
      })
      
      // Trigger global re-planning explicitly
      await triggerReplan()
      
      onClose()
    } catch (error) {
      console.error('Failed to update session time:', error)
    } finally {
      setIsReplanning(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      
      {/* Panel */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-black rounded-t-3xl pb-8 z-50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-text-sec" />
            <h2 className="text-white font-bold text-lg">Work duration</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-accent-pink hover:opacity-80 transition-opacity"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Divider */}
        <div className="border-b border-border-card mx-6" />
        
        {/* Options */}
        <div className="px-6">
          {TIME_OPTIONS.map((minutes) => {
            const isSelected = preferredBudgetMinutes === minutes
            const label = formatTimeLabel(minutes)
            
            return (
              <button
                key={minutes}
                onClick={() => handleTimeSelect(minutes)}
                disabled={isReplanning}
                className="w-full py-4 border-b border-border-card flex justify-between items-center hover:bg-bg-card/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-white text-base">{label}</span>
                
                {/* Selection indicator */}
                <div className="w-5 h-5 rounded-full flex items-center justify-center">
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-accent-yellow" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-border-card" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
        
        {/* Loading overlay */}
        {isReplanning && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-3xl">
            <div className="text-white text-sm">Replanning session...</div>
          </div>
        )}
      </div>
    </>
  )
}
