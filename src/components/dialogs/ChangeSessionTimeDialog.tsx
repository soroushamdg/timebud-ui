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
import { X, HelpCircle, Settings } from 'lucide-react'
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
  const { preferredBudgetMinutes, customBudgetMinutes, setBudget, setCustomBudgetMinutes, allowPartialTasks } = useUIStore()
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
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customInput, setCustomInput] = useState(customBudgetMinutes?.toString() || '')

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

  const handleCustomSave = async () => {
    const minutes = parseInt(customInput)
    if (isNaN(minutes) || minutes < 5 || minutes > 300) {
      return
    }
    setCustomBudgetMinutes(minutes)
    setShowCustomInput(false)
    await handleTimeSelect(minutes)
  }

  const isCustomSelected = customBudgetMinutes !== null && preferredBudgetMinutes === customBudgetMinutes

  if (!isOpen) return null

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/70 z-[100]" onClick={onClose} />
      
      {/* Panel */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-black rounded-t-3xl pb-8 z-[100]">
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
            const isSelected = preferredBudgetMinutes === minutes && !isCustomSelected
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
          
          {/* Custom option */}
          <button
            onClick={() => setShowCustomInput(true)}
            disabled={isReplanning}
            className="w-full py-4 border-b border-border-card flex justify-between items-center hover:bg-bg-card/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-text-sec" />
              <span className="text-white text-base">
                {customBudgetMinutes !== null ? `Custom: ${formatTimeLabel(customBudgetMinutes)}` : 'Custom'}
              </span>
            </div>
            
            {/* Selection indicator */}
            <div className="w-5 h-5 rounded-full flex items-center justify-center">
              {isCustomSelected ? (
                <div className="w-5 h-5 rounded-full bg-accent-yellow" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-border-card" />
              )}
            </div>
          </button>
        </div>
        
        {/* Loading overlay */}
        {isReplanning && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-3xl">
            <div className="text-white text-sm">Replanning session...</div>
          </div>
        )}
      </div>

      {/* Custom input dialog */}
      {showCustomInput && (
        <>
          <div className="fixed inset-0 bg-black/80 z-[110]" onClick={() => setShowCustomInput(false)} />
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-black rounded-t-3xl pb-8 z-[110]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4">
              <h3 className="text-white font-bold text-lg">Set custom duration</h3>
              <button 
                onClick={() => setShowCustomInput(false)}
                className="text-accent-pink hover:opacity-80 transition-opacity"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Divider */}
            <div className="border-b border-border-card mx-6" />
            
            {/* Input */}
            <div className="px-6 py-6">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Enter minutes"
                  min="5"
                  max="300"
                  className="flex-1 bg-bg-card-hover border border-border-card text-white px-4 py-3 rounded-lg focus:outline-none focus:border-accent-yellow text-lg"
                  autoFocus
                />
                <span className="text-text-sec text-base">min</span>
              </div>
              <p className="text-text-sec text-sm">Range: 5-300 minutes</p>
            </div>
            
            {/* Buttons */}
            <div className="px-6 flex gap-3">
              <button
                onClick={() => setShowCustomInput(false)}
                className="flex-1 bg-bg-card-hover border border-border-card text-white py-3 px-4 rounded-lg hover:bg-bg-card transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomSave}
                disabled={!customInput || parseInt(customInput) < 5 || parseInt(customInput) > 300}
                className="flex-1 bg-accent-yellow text-black font-bold py-3 px-4 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
