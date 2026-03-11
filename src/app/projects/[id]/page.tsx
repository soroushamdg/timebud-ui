'use client'

import { useState, useCallback, use, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, ChevronDown, Lock, Check, Plus, ArrowUpDown, Trash2, MoreVertical, Edit, CalendarIcon, ChevronLeft } from 'lucide-react'
import { ChevronDoubleUpIcon } from '@heroicons/react/24/outline'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { useProject } from '@/hooks/useProjects'
import { getDiceBearUrl } from '@/lib/avatar'
import { formatLocal, formatLocalSmart } from '@/lib/dates'
import { DbTask, TaskStatus } from '@/types/database'
import { TaskCardSkeleton } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

// Mobile device detection
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
         (window.innerWidth <= 768 && 'ontouchstart' in window)
}

type SortMode = 'manual' | 'deadline'

export default function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showSortOptions, setShowSortOptions] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('manual')
  const [draggedItem, setDraggedItem] = useState<DbTask | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [showDropIndicator, setShowDropIndicator] = useState(false)
  const [dropIndicatorPosition, setDropIndicatorPosition] = useState<number>(0)
  
  // Swipe gesture states (mobile only)
  const [swipedTask, setSwipedTask] = useState<DbTask | null>(null)
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const [swipeDistance, setSwipeDistance] = useState(0)
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)
  
  // Desktop hover states
  const [hoveredTask, setHoveredTask] = useState<string | null>(null)
  const [showTaskMenu, setShowTaskMenu] = useState<string | null>(null)
  
  // Inline creation states
  const [creatingTask, setCreatingTask] = useState(false)
  const [creatingMilestone, setCreatingMilestone] = useState(false)
  const [newItemTitle, setNewItemTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Edit states
  const [editingProject, setEditingProject] = useState(false)
  const [editingItem, setEditingItem] = useState<DbTask | null>(null)
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    estimated_minutes: '',
    due_date: '',
    priority: false,
    depends_on_task: '',
    item_type: 'task' as 'task' | 'milestone'
  })
  const [editFormError, setEditFormError] = useState('')
  
  // Project edit state
  const [projectFormData, setProjectFormData] = useState({
    name: '',
    description: '',
    deadline: '',
    color: ''
  })
  
  // Toast state
  const [showEditToast, setShowEditToast] = useState(false)
  
  // Click tracking for confused user detection
  const [clickTracker, setClickTracker] = useState<Map<string, { count: number; lastClick: number }>>(new Map())
  
  // Platform detection
  const [isMobile, setIsMobile] = useState(false)
  
  // Task highlighting
  const searchParams = useSearchParams()
  const highlightedTaskId = searchParams?.get('taskId')
  const [shouldScrollToTask, setShouldScrollToTask] = useState(false)
  const taskRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const glowStylesAddedRef = useRef(false)
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowTaskMenu(null)
    if (showTaskMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showTaskMenu])
  
  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (showEditToast) {
      const timer = setTimeout(() => {
        setShowEditToast(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [showEditToast])
  
  // Clean up old click tracking data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setClickTracker(prev => {
        const now = Date.now()
        const cleaned = new Map()
        prev.forEach((data, itemId) => {
          // Keep only clicks from last 10 seconds
          if (now - data.lastClick < 10000) {
            cleaned.set(itemId, data)
          }
        })
        return cleaned
      })
    }, 5000) // Clean every 5 seconds
    return () => clearInterval(interval)
  }, [])
  
  // Focus input when creation mode starts
  useEffect(() => {
    if ((creatingTask || creatingMilestone) && inputRef.current) {
      inputRef.current.focus()
    }
  }, [creatingTask, creatingMilestone])
  
  // Scroll to highlighted task when component mounts or taskId changes
  useEffect(() => {
    if (highlightedTaskId && !shouldScrollToTask) {
      // Small delay to ensure DOM is rendered
      const timer = setTimeout(() => {
        setShouldScrollToTask(true)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [highlightedTaskId, shouldScrollToTask])
  
  // Inject glow keyframes once
  const ensureGlowStyles = () => {
    if (glowStylesAddedRef.current) return
    const style = document.createElement('style')
    style.textContent = `@keyframes taskGlowPulse {
      0% { box-shadow: 0 0 0 0 rgba(245, 197, 24, 0); opacity: 1; }
      16% { box-shadow: 0 0 12px 4px rgba(245, 197, 24, 0.55); opacity: 0.5; }
      33% { box-shadow: 0 0 18px 6px rgba(245, 197, 24, 0.9); opacity: 1; }
      50% { box-shadow: 0 0 12px 4px rgba(245, 197, 24, 0.55); opacity: 0.5; }
      66% { box-shadow: 0 0 18px 6px rgba(245, 197, 24, 0.9); opacity: 1; }
      83% { box-shadow: 0 0 12px 4px rgba(245, 197, 24, 0.55); opacity: 0.5; }
      100% { box-shadow: 0 0 0 0 rgba(245, 197, 24, 0); opacity: 1; }
    }`
    document.head.appendChild(style)
    glowStylesAddedRef.current = true
  }
  
  // Perform scroll and highlighting
  useEffect(() => {
    // Clean up any existing animation timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = null
    }
    
    if (shouldScrollToTask && highlightedTaskId && taskRefs.current[highlightedTaskId]) {
      ensureGlowStyles()
      const element = taskRefs.current[highlightedTaskId]
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        
        element.style.animation = 'taskGlowPulse 2s ease-in-out forwards'
        
        // Cleanup after animation completes
        animationTimeoutRef.current = setTimeout(() => {
          element.style.animation = ''
          element.style.boxShadow = ''
          element.style.opacity = ''
          element.style.transition = ''
          animationTimeoutRef.current = null
        }, 2000)
        
        setShouldScrollToTask(false)
      }
    }
    
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
        animationTimeoutRef.current = null
      }
    }
  }, [shouldScrollToTask, highlightedTaskId])
  
  // Handle click outside to finish creation
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        if (creatingTask || creatingMilestone) {
          handleFinishCreation()
        }
      }
    }
    
    if (creatingTask || creatingMilestone) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [creatingTask, creatingMilestone, newItemTitle])
  
  const resolvedParams = use(params)
  const projectId = resolvedParams.id
  
  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: allItems = [], isLoading: itemsLoading } = useTasks({ projectId, type: 'all' })
  const updateTask = useUpdateTask()

  // Load sort mode from localStorage on mount
  useEffect(() => {
    const savedSortMode = localStorage.getItem(`project-${projectId}-sort-mode`)
    if (savedSortMode === 'manual' || savedSortMode === 'deadline') {
      setSortMode(savedSortMode)
    }
    // Detect mobile device
    setIsMobile(isMobileDevice())
  }, [projectId])
  
  // Initialize project form data when project loads
  useEffect(() => {
    if (project && !editingProject) {
      setProjectFormData({
        name: project.name,
        description: project.description || '',
        deadline: formatDateForInput(project.deadline),
        color: project.color || ''
      })
    }
  }, [project, editingProject])

  // Save sort mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(`project-${projectId}-sort-mode`, sortMode)
  }, [projectId, sortMode])
  
  // Sort items based on selected mode
  const sortedItems = useCallback(() => {
    if (sortMode === 'deadline') {
      // Sort by deadline: items with deadlines first (by due_date), then items without deadlines (by order)
      const withDeadlines = allItems.filter(item => item.due_date).sort((a, b) => 
        new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
      )
      const withoutDeadlines = allItems.filter(item => !item.due_date).sort((a, b) => a.order - b.order)
      return [...withDeadlines, ...withoutDeadlines]
    } else {
      // Sort by manual (order field)
      return [...allItems].sort((a, b) => a.order - b.order)
    }
  }, [allItems, sortMode])()

  const tasks = sortedItems.filter(item => item.item_type === 'task')
  const milestones = sortedItems.filter(item => item.item_type === 'milestone')
  
  // Create task status map for lock logic
  const taskStatusMap = tasks.reduce((acc, task) => {
    if (task.status !== null) {
      acc[task.id] = task.status as TaskStatus
    }
    return acc
  }, {} as Record<string, TaskStatus>)
  
  // Check if task is locked (only for completion)
  const isLocked = useCallback((task: DbTask) => {
    return task.depends_on_task !== null && taskStatusMap[task.depends_on_task] !== 'completed'
  }, [taskStatusMap])

  // Check if task can be interacted with (for editing, deleting, prioritizing)
  const canInteract = useCallback((task: DbTask) => {
    return task.item_type === 'task' // Only tasks can be interacted with, not milestones
  }, [])
  
  // Calculate progress - only count tasks, not milestones
  const completedTaskCount = tasks.filter(t => t.status === 'completed').length
  const totalTaskCount = tasks.length
  const progressPercentage = totalTaskCount > 0 ? Math.round((completedTaskCount / totalTaskCount) * 100) : 0
  
  // Sequential task numbering - only count tasks
  const getTaskNumber = useCallback((task: DbTask) => {
    return tasks.findIndex(t => t.id === task.id) + 1
  }, [tasks])
  
  // Swipe gesture handlers (mobile only)
  const handleTouchStart = useCallback((e: React.TouchEvent, task: DbTask) => {
    if (!isMobile || !canInteract(task) || task.status === 'completed') return
    
    const touch = e.touches[0]
    setStartX(touch.clientX)
    setStartY(touch.clientY)
    setSwipedTask(task)
    setSwipeDistance(0)
    setSwipeDirection(null)
  }, [canInteract])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipedTask) return
    
    const touch = e.touches[0]
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY
    
    // Only handle horizontal swipes
    if (Math.abs(deltaY) > Math.abs(deltaX)) return
    
    e.preventDefault()
    
    const direction = deltaX > 0 ? 'right' : 'left'
    setSwipeDirection(direction)
    setSwipeDistance(Math.abs(deltaX))
  }, [swipedTask, startX, startY])

  const handleTouchEnd = useCallback(async () => {
    if (!swipedTask || !swipeDirection) {
      setSwipedTask(null)
      setSwipeDirection(null)
      setSwipeDistance(0)
      return
    }

    const threshold = 100 // Full swipe threshold
    const fullSwipeThreshold = 200 // Instant action threshold

    if (swipeDistance >= fullSwipeThreshold) {
      // Full swipe - instant action
      try {
        if (swipeDirection === 'right') {
          // Complete task - check if locked
          if (!isLocked(swipedTask)) {
            await updateTask.mutateAsync({
              id: swipedTask.id,
              status: 'completed'
            })
          }
        } else if (swipeDirection === 'left') {
          // Delete task
          const supabase = createClient()
          await supabase.from('tasks').delete().eq('id', swipedTask.id)
          queryClient.invalidateQueries({ queryKey: ['tasks'] })
        }
      } catch (error) {
        console.error('Failed to perform swipe action:', error)
      }
    }

    // Reset swipe state
    setSwipedTask(null)
    setSwipeDirection(null)
    setSwipeDistance(0)
  }, [swipedTask, swipeDirection, swipeDistance, updateTask, queryClient])

  const handleCompleteTask = useCallback(async (task: DbTask) => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        status: 'completed'
      })
      setSwipedTask(null)
      setSwipeDirection(null)
      setSwipeDistance(0)
    } catch (error) {
      console.error('Failed to complete task:', error)
    }
  }, [updateTask])

  const handleTogglePriority = useCallback(async (task: DbTask) => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        priority: !task.priority
      })
      setSwipedTask(null)
      setSwipeDirection(null)
      setSwipeDistance(0)
    } catch (error) {
      console.error('Failed to toggle priority:', error)
    }
  }, [updateTask])

  // Desktop handlers
  const handleCheckboxChange = useCallback(async (task: DbTask, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (isLocked(task) || task.item_type === 'milestone') return
    
    try {
      await updateTask.mutateAsync({
        id: task.id,
        status: task.status === 'completed' ? 'pending' : 'completed'
      })
    } catch (error) {
      console.error('Failed to toggle task status:', error)
    }
  }, [isLocked, updateTask])

  const handleTaskMenuToggle = useCallback((taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setShowTaskMenu(showTaskMenu === taskId ? null : taskId)
  }, [showTaskMenu])

  const handleDeleteTask = useCallback(async (task: DbTask) => {
    try {
      const supabase = createClient()
      await supabase.from('tasks').delete().eq('id', task.id)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setSwipedTask(null)
      setSwipeDirection(null)
      setSwipeDistance(0)
      setShowTaskMenu(null)
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }, [queryClient])
  
  // Inline creation handlers
  const handleStartCreation = useCallback((type: 'task' | 'milestone') => {
    if (type === 'task') {
      setCreatingTask(true)
      setCreatingMilestone(false)
    } else {
      setCreatingMilestone(true)
      setCreatingTask(false)
    }
    setNewItemTitle('')
  }, [])
  
  const handleFinishCreation = useCallback(async () => {
    if (!newItemTitle.trim()) {
      setCreatingTask(false)
      setCreatingMilestone(false)
      setNewItemTitle('')
      return
    }
    
    try {
      const supabase = createClient()
      const itemType = creatingTask ? 'task' : 'milestone'
      
      // Get the highest order value for new item
      const maxOrder = Math.max(...sortedItems.map(item => item.order), 0)
      
      const { error } = await supabase
        .from('tasks')
        .insert({
          user_id: project?.user_id,
          project_id: projectId,
          item_type: itemType,
          title: newItemTitle.trim(),
          order: maxOrder + 1,
          priority: false,
          status: itemType === 'task' ? 'pending' : null,
          estimated_minutes: itemType === 'task' ? null : null,
        })
      
      if (error) throw error
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    } catch (error) {
      console.error('Failed to create item:', error)
    } finally {
      setCreatingTask(false)
      setCreatingMilestone(false)
      setNewItemTitle('')
    }
  }, [newItemTitle, creatingTask, creatingMilestone, sortedItems, project, projectId, queryClient])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleFinishCreation()
    } else if (e.key === 'Escape') {
      setCreatingTask(false)
      setCreatingMilestone(false)
      setNewItemTitle('')
    }
  }, [handleFinishCreation])
  
  // Helper function to format date for input
  const formatDateForInput = (dateString: string | null): string => {
    if (!dateString) return ''
    return dateString.split('T')[0] // Extract YYYY-MM-DD part from ISO string
  }

  // Edit handlers
  const handleStartEditItem = useCallback((item: DbTask) => {
    setEditingItem(item)
    setEditFormData({
      title: item.title,
      description: item.description || '',
      estimated_minutes: item.estimated_minutes?.toString() || '',
      due_date: formatDateForInput(item.due_date),
      priority: item.priority,
      depends_on_task: item.depends_on_task || '',
      item_type: item.item_type
    })
  }, [])
  
  const handleSaveEditItem = useCallback(async () => {
    if (!editingItem || !editFormData.title.trim()) return
    
    // Clear previous errors
    setEditFormError('')
    
    // Deadline validation: task/milestone deadline cannot be after project deadline
    if (project && editFormData.due_date && project.deadline) {
      const itemDeadline = new Date(editFormData.due_date)
      const projectDeadline = new Date(project.deadline)
      
      if (itemDeadline > projectDeadline) {
        setEditFormError(`${editFormData.item_type === 'milestone' ? 'Milestone' : 'Task'} deadline cannot be after project deadline (${new Date(project.deadline).toLocaleDateString()})`)
        return
      }
    }
    
    try {
      const supabase = createClient()
      const updateData: any = {
        title: editFormData.title.trim(),
        description: editFormData.description.trim() || null,
        priority: editFormData.priority,
        item_type: editFormData.item_type
      }
      
      // Add task-specific fields
      if (editFormData.item_type === 'task') {
        updateData.status = editingItem.status || 'pending'
        updateData.estimated_minutes = editFormData.estimated_minutes ? parseInt(editFormData.estimated_minutes) : null
        updateData.depends_on_task = editFormData.depends_on_task || null
      } else {
        // Milestone-specific
        updateData.status = null
        updateData.estimated_minutes = null
        updateData.depends_on_task = null
      }
      
      // Add due date if provided
      if (editFormData.due_date) {
        updateData.due_date = editFormData.due_date
      }
      
      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', editingItem.id)
      
      if (error) throw error
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setEditingItem(null)
    } catch (error) {
      console.error('Failed to update item:', error)
    }
  }, [editingItem, editFormData, project, queryClient])
  
  const handleCancelEditItem = useCallback(() => {
    setEditingItem(null)
    setEditFormError('')
    setEditFormData({
      title: '',
      description: '',
      estimated_minutes: '',
      due_date: '',
      priority: false,
      depends_on_task: '',
      item_type: 'task'
    })
  }, [])
  
  // Project edit handlers
  const handleStartEditProject = useCallback(() => {
    if (project) {
      setProjectFormData({
        name: project.name,
        description: project.description || '',
        deadline: formatDateForInput(project.deadline),
        color: project.color || ''
      })
      setEditingProject(true)
    }
  }, [project])
  
  const handleSaveEditProject = useCallback(async () => {
    if (!project || !projectFormData.name.trim()) return
    
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('projects')
        .update({
          name: projectFormData.name.trim(),
          description: projectFormData.description.trim() || null,
          deadline: projectFormData.deadline || null,
          color: projectFormData.color || null
        })
        .eq('id', project.id)
      
      if (error) throw error
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setEditingProject(false)
    } catch (error) {
      console.error('Failed to update project:', error)
    }
  }, [project, projectFormData, queryClient])
  
  const handleCancelEditProject = useCallback(() => {
    setEditingProject(false)
  }, [])
  
  // Click handlers for editing
  const handleSingleClick = useCallback((item: DbTask) => {
    const now = Date.now()
    const itemId = item.id
    
    // Track clicks to detect confused user
    setClickTracker(prev => {
      const current = prev.get(itemId) || { count: 0, lastClick: 0 }
      const timeSinceLastClick = now - current.lastClick
      
      // If clicks are spaced out (not rapid double-click), increment counter
      if (timeSinceLastClick > 500) {
        const newCount = current.count + 1
        const updated = new Map(prev)
        updated.set(itemId, { count: newCount, lastClick: now })
        
        // Show toast if user seems confused (3+ spaced clicks)
        if (newCount >= 3) {
          setShowEditToast(true)
          // Reset counter after showing toast
          updated.set(itemId, { count: 0, lastClick: now })
        }
        
        return updated
      }
      
      return prev
    })
  }, [])
  
  const handleDoubleClick = useCallback((item: DbTask) => {
    // Reset click tracker for this item when user successfully double-clicks
    setClickTracker(prev => {
      const updated = new Map(prev)
      updated.delete(item.id)
      return updated
    })
    
    // Open edit modal for double click
    handleStartEditItem(item)
  }, [handleStartEditItem])
  
  const handleMilestoneClick = useCallback((item: DbTask) => {
    // Direct edit for milestone labels
    handleStartEditItem(item)
  }, [handleStartEditItem])
  
  const handleAddTask = () => {
    router.push(`/tasks/new?projectId=${projectId}`)
  }

  // Drag and drop handlers for manual sort mode only
  const handleDragStart = (e: React.DragEvent, item: DbTask) => {
    if (sortMode !== 'manual') {
      e.preventDefault()
      return
    }
    setDraggedItem(item)
    setShowDropIndicator(true)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (sortMode !== 'manual' || !draggedItem) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
    
    // Calculate drop indicator position
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midpoint = rect.top + rect.height / 2
    const isAbove = e.clientY < midpoint
    setDropIndicatorPosition(isAbove ? rect.top : rect.bottom)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    if (sortMode !== 'manual' || !draggedItem) return
    e.preventDefault()
    
    const dragIndex = sortedItems.findIndex(item => item.id === draggedItem.id)
    if (dragIndex === dropIndex) {
      setDraggedItem(null)
      setDragOverIndex(null)
      setShowDropIndicator(false)
      return
    }

    // Calculate new order value - can drop between, before, or after any item including milestones
    let newOrder: number
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const isAbove = e.clientY < rect.top + rect.height / 2

    if (isAbove && dropIndex === 0) {
      // Dropping before first item
      newOrder = sortedItems[0].order - 1
    } else if (!isAbove && dropIndex === sortedItems.length - 1) {
      // Dropping after last item
      newOrder = sortedItems[sortedItems.length - 1].order + 1
    } else if (isAbove) {
      // Dropping before an item
      const prevOrder = dropIndex > 0 ? sortedItems[dropIndex - 1].order : 0
      const nextOrder = sortedItems[dropIndex].order
      newOrder = (prevOrder + nextOrder) / 2
    } else {
      // Dropping after an item
      const currentOrder = sortedItems[dropIndex].order
      const nextOrder = dropIndex < sortedItems.length - 1 ? sortedItems[dropIndex + 1].order : currentOrder + 2
      newOrder = (currentOrder + nextOrder) / 2
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('tasks')
        .update({ order: newOrder })
        .eq('id', draggedItem.id)

      if (error) throw error

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    } catch (error) {
      console.error('Failed to update item order:', error)
    }

    setDraggedItem(null)
    setDragOverIndex(null)
    setShowDropIndicator(false)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverIndex(null)
    setShowDropIndicator(false)
  }

  // Render individual item (task or milestone)
  const renderItem = (item: DbTask, index: number, isDraggable: boolean) => {
    const isCurrentlySwipedTask = swipedTask?.id === item.id
    const swipeTransform = isCurrentlySwipedTask && isMobile ? 
      `translateX(${swipeDirection === 'right' ? swipeDistance : -swipeDistance}px)` : 
      'translateX(0px)'
    const isHovered = hoveredTask === item.id
    const showMenu = showTaskMenu === item.id

    if (item.item_type === 'milestone') {
      return (
        <div 
          key={item.id}
          className="relative"
          onDragOver={isDraggable ? (e) => handleDragOver(e, index) : undefined}
          onDragLeave={isDraggable ? handleDragLeave : undefined}
          onDrop={isDraggable ? (e) => handleDrop(e, index) : undefined}
        >
          <div className="py-3 flex items-center gap-2 mx-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 border border-accent-yellow rotate-45 flex-shrink-0" />
              <span 
                className="text-accent-yellow text-sm font-semibold cursor-pointer hover:text-white transition-colors"
                onClick={() => handleMilestoneClick(item)}
              >
                {item.title}
              </span>
            </div>
            <div className="flex-1 h-px bg-border-card" />
            {item.due_date && (
              <span className="text-text-sec text-xs flex-shrink-0">
                {formatLocal(item.due_date)}
              </span>
            )}
          </div>
        </div>
      )
    } else {
      // Task rendering
      const taskNumber = getTaskNumber(item)
      const locked = isLocked(item)
      const completed = item.status === 'completed'
      const canEdit = canInteract(item) && !completed
      
      return (
        <div key={item.id} className="relative">
          {/* Swipe action backgrounds (mobile only) */}
          {isMobile && isCurrentlySwipedTask && swipeDistance > 50 && (
            <>
              {swipeDirection === 'right' && (
                <div className="absolute inset-0 bg-accent-green rounded-2xl flex items-center justify-start px-4">
                  <div className="flex items-center gap-2">
                    <Check size={20} className="text-white" />
                    <span className="text-white font-semibold">
                      {swipeDistance > 150 ? 'Release to Complete' : 'Complete'}
                    </span>
                  </div>
                  {swipeDistance < 150 && (
                    <button
                      onClick={() => handleTogglePriority(item)}
                      className="ml-4 bg-accent-yellow text-black px-3 py-1 rounded-lg text-sm font-semibold"
                    >
                      {item.priority ? 'Normal' : 'Priority'}
                    </button>
                  )}
                </div>
              )}
              {swipeDirection === 'left' && (
                <div className="absolute inset-0 bg-red-500 rounded-2xl flex items-center justify-end px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">
                      {swipeDistance > 150 ? 'Release to Delete' : 'Delete'}
                    </span>
                    <Trash2 size={20} className="text-white" />
                  </div>
                </div>
              )}
            </>
          )}

          <div
            ref={(el) => { taskRefs.current[item.id] = el }}
            draggable={isDraggable && sortMode === 'manual' && !completed}
            onDragStart={isDraggable && sortMode === 'manual' ? (e) => handleDragStart(e, item) : undefined}
            onDragOver={isDraggable ? (e) => handleDragOver(e, index) : undefined}
            onDragLeave={isDraggable ? handleDragLeave : undefined}
            onDrop={isDraggable ? (e) => handleDrop(e, index) : undefined}
            onDragEnd={isDraggable ? handleDragEnd : undefined}
            onTouchStart={isMobile ? (e) => handleTouchStart(e, item) : undefined}
            onTouchMove={isMobile ? handleTouchMove : undefined}
            onTouchEnd={isMobile ? handleTouchEnd : undefined}
            onMouseEnter={() => !isMobile && setHoveredTask(item.id)}
            onMouseLeave={() => !isMobile && setHoveredTask(null)}
            onClick={() => {
              if (!isMobile && canEdit) {
                handleSingleClick(item)
              }
            }}
            onDoubleClick={() => {
              if (!isMobile && canEdit) {
                handleDoubleClick(item)
              }
            }}
            style={{ transform: swipeTransform }}
            className={`
              mb-3 rounded-none px-4 py-3 flex items-center gap-3 border transition-all relative z-10
              ${completed 
                ? 'bg-bg-card-done border-accent-green/30' 
                : locked 
                  ? 'bg-bg-card-locked' 
                  : 'bg-bg-card border-border-card'
              }
              ${canEdit && !isMobile ? 'cursor-pointer' : ''}
              ${isDraggable && sortMode === 'manual' && !completed ? 'cursor-move' : ''}
              ${dragOverIndex === index ? 'ring-2 ring-accent-yellow' : ''}
            `}
          >
            {/* Desktop checkbox or Mobile numbered badge */}
            {!isMobile ? (
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => handleCheckboxChange(item, e)}
                disabled={locked || item.item_type !== 'task'}
                className="w-5 h-5 rounded flex-shrink-0 accent-accent-yellow cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />
            ) : (
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                  ${completed 
                    ? 'bg-accent-green text-white' 
                    : locked 
                      ? 'bg-bg-card-locked text-text-sec' 
                      : 'bg-bg-card text-white'
                  }
                `}
              >
                {completed ? <Check size={16} /> : taskNumber}
              </div>
            )}
            
            {/* Task title */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {item.priority && (
                  <ChevronDoubleUpIcon className="w-4 h-4 text-accent-yellow flex-shrink-0" />
                )}
                <h3 className={`text-base font-semibold truncate ${
                  locked ? 'text-text-sec' : 'text-white'
                }`}>
                  {item.title}
                </h3>
              </div>
              {item.estimated_minutes && (
                <p className="text-text-sec text-sm mt-1">
                  Estimated: {item.estimated_minutes} min
                </p>
              )}
            </div>
            
            {/* Deadline in trailing position */}
            {item.due_date && (
              <div className="flex-shrink-0 text-text-sec text-sm font-medium ml-3">
                {formatLocalSmart(item.due_date)}
              </div>
            )}
            
            {/* Desktop hover actions */}
            {!isMobile && !locked && !completed && isHovered && (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleTogglePriority(item)}
                  className="p-1.5 rounded-lg bg-accent-yellow/20 text-accent-yellow hover:bg-accent-yellow/30 transition-colors"
                  title={item.priority ? 'Remove priority' : 'Add priority'}
                >
                  <ChevronDoubleUpIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleTaskMenuToggle(item.id, e)}
                  className="p-1.5 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors relative"
                  title="More options"
                >
                  <MoreVertical size={16} />
                  {/* Dropdown menu */}
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-bg-card border border-border-card rounded-lg shadow-lg z-50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteTask(item)
                        }}
                        className="w-full px-3 py-2 text-left text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  )}
                </button>
              </div>
            )}
            
            {/* Lock icon */}
            {locked && (
              <Lock size={16} className="text-text-sec flex-shrink-0" />
            )}
          </div>
        </div>
      )
    }
  }
  
  if (projectLoading || itemsLoading || !project) {
    return (
      <div className="min-h-screen bg-bg-primary">
        {/* Hero skeleton */}
        <div className="relative h-48 bg-gray-800 animate-pulse" />
        
        {/* Task skeletons */}
        <div className="p-4 space-y-3">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Edit Toast */}
      {showEditToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-bg-card border border-border-card rounded-lg shadow-lg transition-all duration-300">
          <p className="text-text-sec text-sm">Double-click to edit task or milestone</p>
        </div>
      )}
      
      {/* Header */}
      <div className="relative">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-xl bg-bg-card border border-border-card flex items-center justify-center text-white hover:bg-opacity-80 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        
        {/* Sort button */}
        <button
          onClick={() => setShowSortOptions(true)}
          className="absolute top-4 right-4 z-10 px-3 py-1 bg-bg-card text-text-sec rounded-full text-sm flex items-center gap-1"
        >
          <ArrowUpDown size={14} />
          Sort
        </button>
        
        {/* Edit button */}
        <button
          onClick={handleStartEditProject}
          className="absolute top-4 right-24 z-10 px-3 py-1 bg-bg-card text-text-sec rounded-full text-sm flex items-center gap-1"
        >
          <Edit size={14} />
          Edit
        </button>
        
        {/* Hero */}
        <div className="relative h-48">
          <img
            src={getDiceBearUrl(project.id, project.color)}
            alt={project.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          
          {/* Hero content */}
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-3xl font-bold text-white mb-2">{project.name}</h1>
            <div className="flex justify-between items-end">
              {totalTaskCount > 0 && (
                <div className="text-4xl font-bold text-white">{progressPercentage}%</div>
              )}
              <div className="text-right">
                <div className="text-text-sec text-xs uppercase">DUE DATE</div>
                <div className="text-white text-sm">
                  {project.deadline ? formatLocalSmart(project.deadline) : 'No deadline'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Sort Dialog */}
      {showSortOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-primary rounded-2xl w-full max-w-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Sort Items</h2>
                <button
                  onClick={() => setShowSortOptions(false)}
                  className="text-text-sec hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSortMode('manual')
                    setShowSortOptions(false)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    sortMode === 'manual' 
                      ? 'bg-accent-yellow text-black font-semibold' 
                      : 'bg-bg-card text-white hover:bg-bg-card-hover border border-border-card'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ArrowUpDown size={18} className={sortMode === 'manual' ? 'text-black' : 'text-text-sec'} />
                    <div>
                      <div className="font-medium">Manual Order</div>
                      <div className="text-xs opacity-75">Drag to reorder items</div>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    setSortMode('deadline')
                    setShowSortOptions(false)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    sortMode === 'deadline' 
                      ? 'bg-accent-yellow text-black font-semibold' 
                      : 'bg-bg-card text-white hover:bg-bg-card-hover border border-border-card'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CalendarIcon size={18} className={sortMode === 'deadline' ? 'text-black' : 'text-text-sec'} />
                    <div>
                      <div className="font-medium">By Deadline</div>
                      <div className="text-xs opacity-75">Items with deadlines first</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Drop indicator */}
      {showDropIndicator && (
        <div 
          className="fixed left-4 right-4 h-1 bg-accent-yellow rounded-full flex items-center justify-between pointer-events-none z-50"
          style={{ top: `${dropIndicatorPosition}px` }}
        >
          <div className="w-2 h-2 bg-accent-yellow rounded-full" />
          <div className="w-2 h-2 bg-accent-yellow rounded-full" />
        </div>
      )}

      {/* Content */}
      <div className="pb-20">
        {sortedItems.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <div className="w-8 h-8 border border-accent-yellow rotate-45 mb-3" />
            <h3 className="text-white text-lg font-semibold mt-3">No tasks yet</h3>
            <p className="text-text-sec text-sm mt-1">Tap + to add your first task or milestone</p>
            
            {/* Add buttons in empty state */}
            <div className="mt-8 w-full space-y-3">
              <button
                onClick={() => handleStartCreation('task')}
                className="w-full px-4 py-3 flex items-center justify-center gap-3 text-text-sec hover:text-white transition-colors"
              >
                <Plus size={20} className="flex-shrink-0" />
                <span className="text-base">Add new task</span>
              </button>
              <button
                onClick={() => handleStartCreation('milestone')}
                className="w-full px-4 py-3 flex items-center justify-center gap-3 text-text-sec hover:text-white transition-colors"
              >
                <Plus size={20} className="flex-shrink-0" />
                <span className="text-base">Add new milestone</span>
              </button>
            </div>
            
            {/* Inline creation input in empty state */}
            {(creatingTask || creatingMilestone) && (
              <div className="mt-4 w-full">
                <div className="rounded-2xl px-4 py-3 flex items-center gap-3 border border-border-card bg-bg-card">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-bg-card text-white">
                    {creatingTask ? 'T' : 'M'}
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Enter ${creatingTask ? 'task' : 'milestone'} name...`}
                    className="flex-1 bg-transparent text-white placeholder-text-sec outline-none text-base font-semibold"
                  />
                  <div className="text-text-sec text-sm">
                    {creatingTask ? 'Task' : 'Milestone'}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Items List */
          <div className="px-4">
            {/* Show "No deadline" label when in deadline sort mode and there are items without deadlines */}
            {sortMode === 'deadline' && sortedItems.some(item => item.due_date) && sortedItems.some(item => !item.due_date) && (
              <div className="mb-4">
                {/* Render items with deadlines first */}
                {sortedItems.filter(item => item.due_date).map((item, index) => (
                  <div key={`deadline-${item.id}`}>
                    {renderItem(item, index, true)}
                  </div>
                ))}
                
                {/* No deadline label */}
                <div className="py-3 px-6 flex items-center gap-4">
                  <div className="flex-1 h-px border-t border-dashed border-border-card" />
                  <span className="text-text-sec text-sm font-medium leading-none">No deadline</span>
                  <div className="flex-1 h-px border-t border-dashed border-border-card" />
                </div>
                
                {/* Render items without deadlines */}
                {sortedItems.filter(item => !item.due_date).map((item, index) => (
                  <div key={`no-deadline-${item.id}`}>
                    {renderItem(item, sortedItems.filter(item => item.due_date).length + index, true)}
                  </div>
                ))}
              </div>
            )}
            
            {/* Regular rendering for manual sort or when all items have same deadline status */}
            {(sortMode === 'manual' || !sortedItems.some(item => item.due_date) || !sortedItems.some(item => !item.due_date)) && (
              <>
                {sortedItems.map((item, index) => (
                  <div key={item.id}>
                    {renderItem(item, index, sortMode === 'manual')}
                  </div>
                ))}
              </>
            )}
            
            {/* Add new item buttons - always show */}
            <div className="mt-6 space-y-3">
              {/* Inline creation input */}
              {(creatingTask || creatingMilestone) && (
                <div className="mb-3 rounded-2xl px-4 py-3 flex items-center gap-3 border border-border-card bg-bg-card">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-bg-card text-white">
                    {creatingTask ? 'T' : 'M'}
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Enter ${creatingTask ? 'task' : 'milestone'} name...`}
                    className="flex-1 bg-transparent text-white placeholder-text-sec outline-none text-base font-semibold"
                  />
                  <div className="text-text-sec text-sm">
                    {creatingTask ? 'Task' : 'Milestone'}
                  </div>
                </div>
              )}
              
              {/* Add buttons */}
              {!creatingTask && !creatingMilestone && (
                <>
                  <button
                    onClick={() => handleStartCreation('task')}
                    className="w-full px-4 py-3 flex items-center gap-3 text-text-sec hover:text-white transition-colors"
                  >
                    <Plus size={20} className="flex-shrink-0" />
                    <span className="text-base">Add new task</span>
                  </button>
                  <button
                    onClick={() => handleStartCreation('milestone')}
                    className="w-full px-4 py-3 flex items-center gap-3 text-text-sec hover:text-white transition-colors"
                  >
                    <Plus size={20} className="flex-shrink-0" />
                    <span className="text-base">Add new milestone</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Floating Action Button - only show when there are items */}
      {sortedItems.length > 0 && (
        <button
          onClick={handleAddTask}
          className="fixed bottom-24 right-4 bg-accent-yellow text-black rounded-full w-12 h-12 text-2xl font-bold flex items-center justify-center shadow-lg"
        >
          <Plus size={24} />
        </button>
      )}
      
      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-primary rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Edit {editingItem.item_type}</h2>
                <button
                  onClick={handleCancelEditItem}
                  className="text-text-sec hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Type Toggle */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditFormData(prev => ({ ...prev, item_type: 'task' }))}
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                        editFormData.item_type === 'task'
                          ? 'bg-accent-yellow text-black font-semibold'
                          : 'bg-bg-card text-text-sec hover:text-white'
                      }`}
                    >
                      Task
                    </button>
                    <button
                      onClick={() => setEditFormData(prev => ({ ...prev, item_type: 'milestone' }))}
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                        editFormData.item_type === 'milestone'
                          ? 'bg-accent-yellow text-black font-semibold'
                          : 'bg-bg-card text-text-sec hover:text-white'
                      }`}
                    >
                      Milestone
                    </button>
                  </div>
                </div>
                
                {/* Title */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">Title</label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white placeholder-text-sec outline-none focus:border-accent-yellow transition-colors"
                    placeholder="Enter title..."
                  />
                </div>
                
                {/* Description */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">Description</label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white placeholder-text-sec outline-none focus:border-accent-yellow transition-colors resize-none"
                    placeholder="Enter description..."
                    rows={3}
                  />
                </div>
                
                {/* Task-specific fields */}
                {editFormData.item_type === 'task' && (
                  <>
                    <div>
                      <label className="text-text-sec text-sm mb-2 block">Estimated Minutes</label>
                      <input
                        type="number"
                        value={editFormData.estimated_minutes}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, estimated_minutes: e.target.value }))}
                        className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white placeholder-text-sec outline-none focus:border-accent-yellow transition-colors"
                        placeholder="Enter estimated minutes..."
                        min="1"
                      />
                    </div>
                    
                    <div>
                      <label className="text-text-sec text-sm mb-2 block">Depends on task (optional)</label>
                      <select
                        value={editFormData.depends_on_task}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, depends_on_task: e.target.value }))}
                        className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white outline-none focus:border-accent-yellow transition-colors"
                      >
                        <option value="">No dependency</option>
                        {tasks
                          .filter(task => task.id !== editingItem?.id) // Don't allow self-dependency
                          .map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.title}
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                )}
                
                {/* Due Date */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">Due Date</label>
                  <input
                    type="date"
                    value={editFormData.due_date}
                    onChange={(e) => {
                      setEditFormData(prev => ({ ...prev, due_date: e.target.value }))
                      if (editFormError) setEditFormError('')
                    }}
                    className={`w-full px-4 py-2 bg-bg-card border rounded-lg text-white placeholder-text-sec outline-none transition-colors ${
                      editFormError ? 'border-accent-pink' : 'border-border-card focus:border-accent-yellow'
                    }`}
                  />
                  {editFormError && (
                    <p className="text-accent-pink text-sm mt-2">{editFormError}</p>
                  )}
                </div>
                
                {/* Priority */}
                <div className="flex items-center justify-between">
                  <label className="text-text-sec text-sm">Priority</label>
                  <button
                    onClick={() => setEditFormData(prev => ({ ...prev, priority: !prev.priority }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      editFormData.priority ? 'bg-accent-yellow' : 'bg-bg-card'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      editFormData.priority ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancelEditItem}
                  className="flex-1 px-4 py-2 bg-bg-card text-text-sec rounded-lg hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditItem}
                  disabled={!editFormData.title.trim()}
                  className="flex-1 px-4 py-2 bg-accent-yellow text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-primary rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Edit Project</h2>
                <button
                  onClick={handleCancelEditProject}
                  className="text-text-sec hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Project Name */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">Project Name</label>
                  <input
                    type="text"
                    value={projectFormData.name}
                    onChange={(e) => setProjectFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white placeholder-text-sec outline-none focus:border-accent-yellow transition-colors"
                    placeholder="Enter project name..."
                  />
                </div>
                
                {/* Description */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">Description</label>
                  <textarea
                    value={projectFormData.description}
                    onChange={(e) => setProjectFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white placeholder-text-sec outline-none focus:border-accent-yellow transition-colors resize-none"
                    placeholder="Enter description..."
                    rows={3}
                  />
                </div>
                
                {/* Deadline */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">Deadline</label>
                  <input
                    type="date"
                    value={projectFormData.deadline}
                    onChange={(e) => setProjectFormData(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full px-4 py-2 bg-bg-card border border-border-card rounded-lg text-white placeholder-text-sec outline-none focus:border-accent-yellow transition-colors"
                  />
                </div>
                
                {/* Color */}
                <div>
                  <label className="text-text-sec text-sm mb-2 block">Project Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {['#F5C518', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setProjectFormData(prev => ({ ...prev, color }))}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          projectFormData.color === color
                            ? 'border-white scale-110'
                            : 'border-transparent hover:border-white/50'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <button
                      onClick={() => setProjectFormData(prev => ({ ...prev, color: '' }))}
                      className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                        !projectFormData.color
                          ? 'bg-accent-yellow text-black font-semibold'
                          : 'bg-bg-card text-text-sec hover:text-white'
                      }`}
                    >
                      Default
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancelEditProject}
                  className="flex-1 px-4 py-2 bg-bg-card text-text-sec rounded-lg hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditProject}
                  disabled={!projectFormData.name.trim()}
                  className="flex-1 px-4 py-2 bg-accent-yellow text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  )
}
