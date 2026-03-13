'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAllProjects, useUpdateProject, useDeleteProject } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { useFocusSessionStore } from '@/stores/sessionStore'
import { useUpdateFocusSession, useDeleteFocusSession } from '@/hooks/useSessions'
import { planSession } from '@/lib/planner'
import { createClient } from '@/lib/supabase/client'
import { isValidUuid } from '@/lib/utils'
import { ProjectCardSkeleton } from '@/components/ui/Skeleton'
import { AutoSizeText } from '@/components/ui/AutoSizeText'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { Check, MoreVertical } from 'lucide-react'
import { DbProject, ProjectStatus } from '@/types/database'

interface PendingChanges {
  [projectId: string]: ProjectStatus
}

interface ContextMenuState {
  projectId: string | null
  x: number
  y: number
}

interface AvatarHeights {
  [projectId: string]: number
}

export default function SelectProjectsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { focusSessionId, setFocusSession, clearFocusSession } = useFocusSessionStore()
  const updateFocusSession = useUpdateFocusSession()
  const deleteFocusSession = useDeleteFocusSession()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  
  const { data: projects = [], isLoading } = useAllProjects()
  const { data: tasks = [] } = useTasks()
  const { data: milestones = [] } = useTasks({ type: 'milestone' })
  
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({})
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    projectId: null,
    x: 0,
    y: 0,
  })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [avatarHeights, setAvatarHeights] = useState<AvatarHeights>({})
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu({ projectId: null, x: 0, y: 0 })
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Measure avatar heights
  const measureAvatarHeight = useCallback((projectId: string, imgElement: HTMLImageElement) => {
    const height = imgElement.clientHeight
    if (height > 0) {
      setAvatarHeights(prev => ({
        ...prev,
        [projectId]: height
      }))
    }
  }, [])

  const handleProjectTap = useCallback((projectId: string, currentStatus: ProjectStatus) => {
    // Toggle project status between active and paused
    if (currentStatus === 'archived') return
    
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    setPendingChanges(prev => ({
      ...prev,
      [projectId]: newStatus,
    }))
  }, [])

  const handleLongPressStart = useCallback((e: React.TouchEvent | React.MouseEvent, projectId: string) => {
    e.preventDefault()
    
    longPressTimer.current = setTimeout(() => {
      const touch = 'touches' in e ? e.touches[0] : e
      setContextMenu({
        projectId,
        x: touch.clientX,
        y: touch.clientY,
      })
    }, 500)
  }, [])

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleArchive = useCallback((projectId: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [projectId]: 'archived',
    }))
    setContextMenu({ projectId: null, x: 0, y: 0 })
  }, [])

  const handleActivate = useCallback((projectId: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [projectId]: 'active',
    }))
    setContextMenu({ projectId: null, x: 0, y: 0 })
  }, [])

  const handleDelete = useCallback((projectId: string) => {
    setDeleteConfirm(projectId)
    setContextMenu({ projectId: null, x: 0, y: 0 })
  }, [])

  const confirmDelete = useCallback(async () => {
    if (deleteConfirm) {
      try {
        await deleteProject.mutateAsync(deleteConfirm)
        setDeleteConfirm(null)
      } catch (error) {
        console.error('Failed to delete project:', error)
      }
    }
  }, [deleteConfirm, deleteProject])

  const handleCancel = useCallback(() => {
    router.back()
  }, [router])

  const getProjectStatus = useCallback((project: DbProject): ProjectStatus => {
    return pendingChanges[project.id] || project.status
  }, [pendingChanges])

  const handleDone = useCallback(async () => {
    try {
      console.log('handleDone called with pendingChanges:', pendingChanges)
      
      // Check authentication first
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('Authentication error:', authError)
        throw new Error('You must be logged in to update projects')
      }
      console.log('User authenticated:', user.id)
      
      // Apply all pending changes first
      if (Object.keys(pendingChanges).length > 0) {
        console.log('Applying', Object.keys(pendingChanges).length, 'pending changes')
        const updatePromises = Object.entries(pendingChanges).map(([projectId, status]) => {
          console.log('Updating project:', projectId, 'to status:', status)
          return updateProject.mutateAsync({ id: projectId, status })
        })
        
        try {
          await Promise.all(updatePromises)
          console.log('All project updates completed successfully')
        } catch (updateError) {
          console.error('Failed to update projects:', updateError)
          throw new Error(`Failed to update projects: ${updateError}`)
        }
      } else {
        console.log('No pending changes to apply')
      }
      
      // Delete current session from database if it exists (after project updates)
      if (focusSessionId) {
        console.log('Deleting session:', focusSessionId)
        // Only try to delete from database if it's a valid UUID (not a local session)
        if (isValidUuid(focusSessionId)) {
          try {
            await deleteFocusSession.mutateAsync(focusSessionId)
            console.log('Session deleted successfully')
          } catch (deleteError) {
            console.error('Failed to delete session:', deleteError)
            // Don't throw here - session deletion shouldn't block the flow
          }
        } else {
          console.log('Session ID is not a valid UUID, skipping database deletion:', focusSessionId)
        }
      }
      
      // Invalidate all relevant queries to trigger replanning on home page
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      
      // Clear session state to force replanning when returning to home
      console.log('Clearing session state')
      clearFocusSession()
      
      console.log('Navigation to home page')
      try {
        router.push('/')
      } catch (navError) {
        console.error('Navigation error:', navError)
        throw navError
      }
    } catch (error) {
      console.error('Failed to update projects:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'No message',
        stack: error instanceof Error ? error.stack : 'No stack',
        stringified: JSON.stringify(error, null, 2),
        errorType: typeof error,
        isArray: Array.isArray(error),
        keys: error ? Object.keys(error) : 'null error'
      })
      
      // Show user-friendly error message
      alert('Failed to update projects. Please check your connection and try again.')
    }
  }, [pendingChanges, focusSessionId, updateProject, deleteFocusSession, queryClient, clearFocusSession, router])

  const isActive = useCallback((project: DbProject) => {
    return getProjectStatus(project) === 'active'
  }, [getProjectStatus])

  const isArchived = useCallback((project: DbProject) => {
    return getProjectStatus(project) === 'archived'
  }, [getProjectStatus])

  // Group projects by status
  const activeProjects = projects.filter(project => getProjectStatus(project) === 'active')
  const pausedProjects = projects.filter(project => getProjectStatus(project) === 'paused')
  const archivedProjects = projects.filter(project => getProjectStatus(project) === 'archived')
  
  const activeAndPausedProjects = [...activeProjects, ...pausedProjects]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <div className="flex justify-between items-center p-4">
          <button className="text-accent-yellow font-bold">Cancel</button>
          <button className="text-accent-yellow font-bold">Done</button>
        </div>
        
        {/* Heading */}
        <h1 className="text-white text-xl font-bold px-4 mb-4">
          Pick the project groups you want to work on:
        </h1>
        
        {/* Loading skeleton */}
        <div className="grid grid-cols-2 gap-4 px-4 pb-8">
          {[1, 2, 3, 4].map(i => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-4">
        <button 
          onClick={handleCancel}
          className="text-accent-yellow font-bold"
        >
          Cancel
        </button>
        <button 
          onClick={handleDone}
          className="text-accent-yellow font-bold"
          disabled={Object.keys(pendingChanges).length === 0}
        >
          Done
        </button>
      </div>
      
      {/* Heading */}
      <h1 className="text-white text-xl font-bold px-4 mb-2">
        Pick the project groups you want to work on:
      </h1>
      <p className="text-text-sec text-sm px-4 mb-4">
        Tap to toggle active/paused • Long press for more options
      </p>
      
      <div className="overflow-y-auto pb-8">
        {/* Active and Paused Projects */}
        {activeAndPausedProjects.length > 0 && (
          <div className="px-4 mb-6">
            <h2 className="text-white text-lg font-semibold mb-4">Active & Paused Projects</h2>
            <div className="grid grid-cols-2 gap-4">
              {activeAndPausedProjects.map(project => (
                <div
                  key={project.id}
                  className={`rounded-none overflow-hidden relative cursor-pointer ${
                    isActive(project) ? 'border-2 border-accent-yellow' : ''
                  }`}
                  onClick={() => handleProjectTap(project.id, getProjectStatus(project))}
                  onTouchStart={(e) => handleLongPressStart(e, project.id)}
                  onMouseDown={(e) => handleLongPressStart(e, project.id)}
                  onTouchEnd={handleLongPressEnd}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                >
                  {/* Project Image */}
                  <div className="w-full aspect-square">
                    <AvatarImage
                      src={project.project_avatar_url}
                      fallbackType="project"
                      fallbackLabel={project.name}
                      fallbackColor={project.color || undefined}
                      size={200}
                      className="w-full h-full object-cover rounded-none"
                    />
                  </div>
                  
                  {/* Status badge */}
                  <div className={`absolute top-2 left-2 px-2 py-1 rounded-none text-xs font-medium ${
                    getProjectStatus(project) === 'active' 
                      ? 'bg-accent-green text-white' 
                      : 'bg-text-sec text-white'
                  }`}>
                    {getProjectStatus(project) === 'active' ? 'Active' : 'Paused'}
                  </div>
                  
                  {/* Active state badge */}
                  {isActive(project) && (
                    <div className="absolute bottom-1 right-1 bg-accent-yellow rounded-none w-5 h-5 flex items-center justify-center">
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
                  
                  {/* Project name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                    <AutoSizeText 
                      text={project.name}
                      avatarHeight={avatarHeights[project.id]}
                      maxFontSize={18}
                      minFontSize={8}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Separator line */}
        {archivedProjects.length > 0 && activeAndPausedProjects.length > 0 && (
          <div className="px-4 mb-6">
            <div className="border-t border-border-card"></div>
          </div>
        )}
        
        {/* Archived Projects */}
        {archivedProjects.length > 0 && (
          <div className="px-4">
            <h2 className="text-text-sec text-lg font-semibold mb-4">Archived Projects</h2>
            <div className="grid grid-cols-2 gap-4">
              {archivedProjects.map(project => (
                <div
                  key={project.id}
                  className="rounded-none overflow-hidden relative cursor-pointer filter grayscale(100%) opacity-60"
                  onClick={() => handleProjectTap(project.id, getProjectStatus(project))}
                  onTouchStart={(e) => handleLongPressStart(e, project.id)}
                  onMouseDown={(e) => handleLongPressStart(e, project.id)}
                  onTouchEnd={handleLongPressEnd}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                >
                  {/* Project Image */}
                  <div className="w-full aspect-square">
                    <AvatarImage
                      src={project.project_avatar_url}
                      fallbackType="project"
                      fallbackLabel={project.name}
                      fallbackColor={project.color || undefined}
                      size={200}
                      className="w-full h-full object-cover rounded-none"
                    />
                  </div>
                  
                  {/* Project name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                    <AutoSizeText 
                      text={project.name}
                      avatarHeight={avatarHeights[project.id]}
                      maxFontSize={18}
                      minFontSize={8}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Context Menu */}
      {contextMenu.projectId && (() => {
        const project = projects.find(p => p.id === contextMenu.projectId)
        const isArchivedProject = project && getProjectStatus(project) === 'archived'
        
        return (
          <div
            ref={contextMenuRef}
            className="fixed bg-bg-card border border-border-card rounded-none py-2 z-[100]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            {isArchivedProject ? (
              <>
                <button
                  onClick={() => handleActivate(contextMenu.projectId!)}
                  className="block w-full text-left px-4 py-2 text-accent-green hover:bg-bg-card-locked"
                >
                  Activate
                </button>
                <button
                  onClick={() => handleDelete(contextMenu.projectId!)}
                  className="block w-full text-left px-4 py-2 text-accent-pink hover:bg-bg-card-locked"
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleArchive(contextMenu.projectId!)}
                  className="block w-full text-left px-4 py-2 text-white hover:bg-bg-card-locked"
                >
                  Archive
                </button>
                <button
                  onClick={() => handleDelete(contextMenu.projectId!)}
                  className="block w-full text-left px-4 py-2 text-accent-pink hover:bg-bg-card-locked"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )
      })()}
      
      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center">
          <div className="bg-bg-card rounded-none p-6 max-w-sm mx-4">
            <h3 className="text-white font-bold text-lg mb-4">Delete Project</h3>
            <p className="text-text-sec mb-6">
              Are you sure you want to delete this project? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border border-border-card rounded-none text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 bg-accent-pink rounded-none text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
