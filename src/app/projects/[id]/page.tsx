'use client'

import { useState, useCallback, use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronDown, Lock, Check, Plus, ArrowUpDown, Trash2, MoreVertical } from 'lucide-react'
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
  
  // Platform detection
  const [isMobile, setIsMobile] = useState(false)
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowTaskMenu(null)
    if (showTaskMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showTaskMenu])
  
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
  
  // Check if task is locked
  const isLocked = useCallback((task: DbTask) => {
    return task.depends_on_task !== null && taskStatusMap[task.depends_on_task] !== 'completed'
  }, [taskStatusMap])
  
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
    if (!isMobile || isLocked(task) || task.status === 'completed' || task.item_type === 'milestone') return
    
    const touch = e.touches[0]
    setStartX(touch.clientX)
    setStartY(touch.clientY)
    setSwipedTask(task)
    setSwipeDistance(0)
    setSwipeDirection(null)
  }, [isLocked])

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
          // Complete task
          await updateTask.mutateAsync({
            id: swipedTask.id,
            status: 'completed'
          })
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
              <span className="text-accent-yellow text-sm font-semibold">{item.title}</span>
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
            draggable={isDraggable && sortMode === 'manual' && !locked && !completed}
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
              if (!isMobile && !locked && !completed) {
                router.push(`/tasks/${item.id}`)
              }
            }}
            style={{ transform: swipeTransform }}
            className={`
              mb-3 rounded-2xl px-4 py-3 flex items-center gap-3 border transition-all relative z-10
              ${completed 
                ? 'bg-bg-card-done border-accent-green/30' 
                : locked 
                  ? 'bg-bg-card-locked' 
                  : 'bg-bg-card border-border-card'
              }
              ${!locked && !completed && !isMobile ? 'cursor-pointer' : ''}
              ${isDraggable && sortMode === 'manual' && !locked && !completed ? 'cursor-move' : ''}
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
              {item.due_date && (
                <p className="text-text-sec text-sm mt-1">
                  {formatLocalSmart(item.due_date)}
                </p>
              )}
              {item.estimated_minutes && (
                <p className="text-text-sec text-sm mt-1">
                  Estimated: {item.estimated_minutes} min
                </p>
              )}
            </div>
            
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
      {/* Header */}
      <div className="relative">
        {/* X button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 p-2 text-accent-pink"
        >
          <X size={24} />
        </button>
        
        {/* Sort button */}
        <button
          onClick={() => setShowSortOptions(!showSortOptions)}
          className="absolute top-4 right-4 z-10 px-3 py-1 bg-bg-card text-text-sec rounded-full text-sm flex items-center gap-1"
        >
          <ArrowUpDown size={14} />
          Sort
          <ChevronDown size={16} className={`transition-transform ${showSortOptions ? 'rotate-180' : ''}`} />
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
      
      {/* Sort options dropdown */}
      {showSortOptions && (
        <div className="px-4 py-3 bg-bg-card border-b border-border-card">
          <div className="space-y-2">
            <button
              onClick={() => {
                setSortMode('manual')
                setShowSortOptions(false)
              }}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                sortMode === 'manual' 
                  ? 'bg-accent-yellow text-black font-semibold' 
                  : 'text-white hover:bg-bg-primary'
              }`}
            >
              Manual Order
              {sortMode === 'manual' && <span className="text-xs block mt-1">Drag to reorder items</span>}
            </button>
            <button
              onClick={() => {
                setSortMode('deadline')
                setShowSortOptions(false)
              }}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                sortMode === 'deadline' 
                  ? 'bg-accent-yellow text-black font-semibold' 
                  : 'text-white hover:bg-bg-primary'
              }`}
            >
              By Deadline
              {sortMode === 'deadline' && <span className="text-xs block mt-1">Items with deadlines first</span>}
            </button>
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
            <button
              onClick={handleAddTask}
              className="bg-accent-yellow text-black font-bold rounded-full w-12 h-12 flex items-center justify-center text-2xl mt-4"
            >
              <Plus size={24} />
            </button>
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
                <div className="py-3 px-2 flex items-center gap-2">
                  <div className="flex-1 h-px bg-border-card" />
                  <span className="text-text-sec text-sm font-medium">No deadline</span>
                  <div className="flex-1 h-px bg-border-card" />
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
              sortedItems.map((item, index) => (
                <div key={item.id}>
                  {renderItem(item, index, sortMode === 'manual')}
                </div>
              ))
            )}
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
      
    </div>
  )
}
