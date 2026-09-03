'use client'

import { useState, useEffect, useCallback, ElementType } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, X, Plus, Search, RefreshCw, FileText, Calendar, Link2 } from 'lucide-react'
import { ChevronDoubleUpIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { AppShell } from '@/components/layout/AppShell'
import { useProjectsForTasks } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { calculateNextDueDate, parseDateLocal } from '@/lib/dates'
import { DbProject } from '@/types/database'
import { RecurrenceEditor, RecurrenceValue, defaultRecurrenceValue, recurrenceValueToFields } from '@/components/tasks/RecurrenceEditor'

const PRIORITY_OPTIONS = [
  { value: false, label: 'Normal', color: 'text-text-sec' },
  { value: true, label: 'High Priority', color: 'text-accent-pink' }
]

function SectionHeader({ icon: Icon, label }: { icon: ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-3">
      <div className="w-7 h-7 rounded-full bg-accent-yellow/15 flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-accent-yellow" />
      </div>
      <h2 className="text-text-primary text-sm font-bold uppercase tracking-wide">{label}</h2>
    </div>
  )
}

export default function NewTaskPage(props: { searchParams: Promise<{ projectId?: string }> }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useState<{ projectId?: string }>({})
  
  // Extract searchParams
  useEffect(() => {
    props.searchParams.then(params => {
      setSearchParams(params)
    })
  }, [props.searchParams])
  
  const [itemType, setItemType] = useState<'task' | 'milestone'>('task')
  const itemLabel = itemType === 'milestone' ? 'Objective' : 'Job'
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    estimated_minutes: 25,
    due_date: '',
    priority: false,
    project_id: '',
  })

  // Multi-dep state
  const [pendingDeps, setPendingDeps] = useState<string[]>([])
  const [showDepPicker, setShowDepPicker] = useState(false)
  const [depSearch, setDepSearch] = useState('')
  // Recurrence state
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(defaultRecurrenceValue())

  const [titleError, setTitleError] = useState('')
  const [projectError, setProjectError] = useState('')
  const [deadlineError, setDeadlineError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const { data: projects = [] } = useProjectsForTasks()
  const { data: projectTasks = [] } = useTasks({ 
    projectId: formData.project_id || undefined, 
    status: 'pending',
    type: 'task'
  })
  
  // Helper function to format date for input
  const formatDateForInput = (dateString: string | null): string => {
    if (!dateString) return ''
    return dateString.split('T')[0] // Extract YYYY-MM-DD part from ISO string
  }
  
  // Pre-select project if projectId is in URL
  useEffect(() => {
    if (searchParams.projectId && projects.length > 0) {
      const projectExists = projects.find(p => p.id === searchParams.projectId)
      if (projectExists) {
        setFormData(prev => ({ ...prev, project_id: searchParams.projectId! }))
      }
    }
  }, [searchParams.projectId, projects])
  
  const createTask = useMutation({
    mutationFn: async (data: typeof formData & { itemType: 'task' | 'milestone' }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      // Ensure user record exists in users table
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email || '',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          created_at: new Date().toISOString()
        }, {
          onConflict: 'id',
          ignoreDuplicates: true
        })
      
      if (userError) {
        console.error('Failed to create/update user record:', userError)
        throw new Error('Failed to create user record')
      }
      
      // Calculate order
      let calculatedOrder = 1.0
      if (data.project_id) {
        // Project item - get max order for this project
        const { data: maxOrderResult } = await supabase
          .from('tasks')
          .select('order')
          .eq('project_id', data.project_id)
          .order('order', { ascending: false })
          .limit(1)
        
        if (maxOrderResult && maxOrderResult.length > 0) {
          calculatedOrder = maxOrderResult[0].order + 1.0
        }
      } else {
        // Solo task - get max order for user's solo tasks
        const { data: maxOrderResult } = await supabase
          .from('tasks')
          .select('order')
          .is('project_id', null)
          .eq('user_id', user.id)
          .order('order', { ascending: false })
          .limit(1)
        
        if (maxOrderResult && maxOrderResult.length > 0) {
          calculatedOrder = maxOrderResult[0].order + 1.0
        }
      }

      // Prepare item data based on type
      const itemData: Record<string, unknown> = {
        title: data.title.trim(),
        project_id: data.project_id || null,
        user_id: user.id,
        item_type: data.itemType,
        order: calculatedOrder,
        created_at: new Date().toISOString()
      }
      
      if (data.itemType === 'milestone') {
        // Milestone-specific fields
        Object.assign(itemData, {
          description: null,
          estimated_minutes: null,
          status: null,
          due_date: data.due_date || null,
          priority: false,
        })
      } else {
        // Task-specific fields
        let initialDueDate = data.due_date || null;

        // For recurring tasks without a due_date, set it to today
        if (recurrence.isRecurring && !initialDueDate) {
          initialDueDate = new Date().toISOString().split('T')[0];
        }

        Object.assign(itemData, {
          description: data.description?.trim() || null,
          estimated_minutes: Number(data.estimated_minutes) || 25,
          status: 'pending' as const,
          due_date: initialDueDate,
          priority: Boolean(data.priority),
          ...recurrenceValueToFields(recurrence),
        })
      }
      
      // Validation
      if (!itemData.title) {
        throw new Error(`${data.itemType === 'milestone' ? 'Objective' : 'Job'} title is required`)
      }
      
      if (data.itemType === 'task' && (itemData as any).estimated_minutes && ((itemData as any).estimated_minutes < 1 || (itemData as any).estimated_minutes > 480)) {
        throw new Error('Estimated time must be between 1 and 480 minutes')
      }
      
      console.log(`Creating ${data.itemType} with data:`, itemData)
      
      const { data: result, error } = await supabase
        .from('tasks')
        .insert(itemData)
        .select()
        .single()
      
      if (error) {
        console.error(`Supabase ${data.itemType} creation error:`, error)
        throw error
      }
      return result
    },
    onSuccess: async (item) => {
      // Insert dependencies if any
      if (item.item_type === 'task' && pendingDeps.length > 0) {
        const supabase = createClient()
        await supabase
          .from('task_dependencies')
          .insert(pendingDeps.map(depId => ({ task_id: item.id, depends_on_id: depId })))
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      if (searchParams.projectId) {
        router.push(`/projects/${searchParams.projectId}`)
      } else {
        router.back()
      }
    },
    onError: (error: any) => {
      console.error(`Failed to create ${itemType} - Full error object:`, error)
      console.error('Error details:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        error_description: error?.error_description
      })

      let message = `Failed to create ${itemLabel.toLowerCase()}. Please try again.`
      if (error?.message) {
        message = error.message
      } else if (error?.details) {
        message = error.details
      } else if (error?.hint) {
        message = error.hint
      } else if (error?.error_description) {
        message = error.error_description
      }
      
      setErrorMessage(message)
    }
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clear previous errors
    setTitleError('')
    setProjectError('')
    setDeadlineError('')
    setErrorMessage('')
    
    // Validation
    if (!formData.title.trim()) {
      setTitleError(`${itemLabel} title is required`)
      return
    }

    if (itemType === 'milestone' && !formData.project_id) {
      setProjectError('Please select a mission for this objective')
      return
    }

    // Deadline validation: job/objective deadline cannot be after mission deadline
    if (formData.project_id && formData.due_date) {
      const selectedProject = projects.find(p => p.id === formData.project_id)
      if (selectedProject && selectedProject.deadline) {
        const taskDeadline = parseDateLocal(formData.due_date)
        const projectDeadline = parseDateLocal(selectedProject.deadline)

        if (taskDeadline > projectDeadline) {
          setDeadlineError(`${itemLabel} deadline cannot be after mission deadline (${parseDateLocal(selectedProject.deadline).toLocaleDateString()})`)
          return
        }
      }
    }
    
    createTask.mutate({ ...formData, itemType })
  }
  
  const handleInputChange = (field: keyof typeof formData, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (field === 'title' && titleError) {
      setTitleError('')
    }
    if (field === 'due_date' && deadlineError) {
      setDeadlineError('')
    }
    if (field === 'project_id' && (projectError || deadlineError)) {
      setProjectError('')
      setDeadlineError('')
      setPendingDeps([]) // clear deps when project changes
    }
  }

  // Circular dependency check for new task
  const wouldCreateCycle = useCallback((candidateDepId: string): boolean => {
    // For a new task (no id yet), it cannot be in anyone's chain yet — only check if
    // candidateDepId transitively depends on itself (shouldn't happen, but be safe).
    // Since the new task has no ID, cycles cannot involve it yet; just allow all.
    return false
  }, [])
  
  return (
    <AppShell showTabBar={false}>
    <div className="flex flex-col h-[calc(100vh-5rem)] pb-5">
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <button 
          onClick={() => router.back()} 
          className="w-10 h-10 rounded-xl bg-bg-card border border-border-card flex items-center justify-center text-text-primary hover:bg-opacity-80 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-text-primary">
          New {itemLabel}
        </h1>
        <div className="w-10" />
      </div>
      
      {/* Error Message */}
      {errorMessage && (
        <div className="mx-6 mb-4 bg-accent-pink bg-opacity-10 border border-accent-pink rounded-2xl px-5 py-3">
          <p className="text-accent-pink text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-6 space-y-8 pt-2">
        {/* Segmented Control */}
        <div className="bg-bg-card rounded-2xl p-1 flex w-full shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
          <button
            type="button"
            onClick={() => setItemType('task')}
            className={`flex-1 text-center py-2 text-base rounded-xl transition-colors ${
              itemType === 'task'
                ? 'bg-accent-yellow text-on-light-accent font-bold'
                : 'text-text-sec'
            }`}
          >
            Job
          </button>
          <button
            type="button"
            onClick={() => setItemType('milestone')}
            className={`flex-1 text-center py-2 text-base rounded-xl transition-colors ${
              itemType === 'milestone'
                ? 'bg-accent-yellow text-on-light-accent font-bold'
                : 'text-text-sec'
            }`}
          >
            Objective
          </button>
        </div>

        {/* Basics section */}
        <div>
          <SectionHeader icon={FileText} label="Basics" />
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-text-sec text-sm font-medium mb-2 block">
                {itemLabel} title
              </label>
              <input
                type="text"
                placeholder={itemType === 'milestone' ? 'e.g. Beta release, Design handoff' : 'Enter job title'}
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-text-primary placeholder-text-sec focus:outline-none focus:border-accent-yellow transition-colors"
                required
              />
              {titleError && (
                <p className="text-accent-pink text-sm mt-2">{titleError}</p>
              )}
            </div>

            {/* Description - Task only */}
            {itemType === 'task' && (
              <div>
                <label className="text-text-sec text-sm font-medium mb-2 block">
                  Description (optional)
                </label>
                <textarea
                  placeholder="Add a description..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-text-primary placeholder-text-sec focus:outline-none focus:border-accent-yellow resize-none transition-colors"
                />
              </div>
            )}

            {/* Project selection */}
            <div>
              <label className="text-text-sec text-sm font-medium mb-2 block">
                {itemType === 'milestone' ? 'Mission (required)' : 'Mission (optional)'}
              </label>
              <select
                value={formData.project_id}
                onChange={(e) => handleInputChange('project_id', e.target.value)}
                className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-text-primary focus:outline-none focus:border-accent-yellow transition-colors"
                required={itemType === 'milestone'}
              >
                {itemType === 'task' && <option value="">No mission (general job)</option>}
                {itemType === 'milestone' && <option value="">Select a mission</option>}
                {projects.map((project: DbProject) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {projectError && (
                <p className="text-accent-pink text-sm mt-2">{projectError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Schedule section */}
        <div>
          <SectionHeader icon={Calendar} label="Schedule" />
          <div className="space-y-4">
            {/* Estimated time - Task only, and only when project selected or solo */}
            {itemType === 'task' && (formData.project_id || !formData.project_id) && (
              <div>
                <label className="text-text-sec text-sm font-medium mb-2 block">
                  Estimated time (minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="480"
                  step="5"
                  value={formData.estimated_minutes}
                  onChange={(e) => handleInputChange('estimated_minutes', parseInt(e.target.value) || 25)}
                  className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-text-primary focus:outline-none focus:border-accent-yellow transition-colors"
                />
              </div>
            )}

            {/* Due date — hidden when recurrence is on */}
            {!(recurrence.isRecurring && itemType === 'task') && (
              <div>
                <label className="text-text-sec text-sm font-medium mb-2 block">
                  {itemType === 'milestone' ? 'Deadline (optional)' : 'Due date (optional)'}
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleInputChange('due_date', e.target.value)}
                  className={`w-full bg-bg-card border rounded-2xl px-5 py-3.5 text-text-primary focus:outline-none transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 ${
                    deadlineError ? 'border-accent-pink' : 'border-border-card focus:border-accent-yellow'
                  }`}
                />
                {deadlineError && (
                  <p className="text-accent-pink text-sm mt-2">{deadlineError}</p>
                )}
              </div>
            )}

            {/* Priority - Task only */}
            {itemType === 'task' && (
              <div className="flex items-center justify-between bg-bg-card border border-border-card rounded-2xl px-5 py-4">
                <div className="flex items-center gap-2">
                  <ChevronDoubleUpIcon className="w-4 h-4 text-accent-yellow" />
                  <div>
                    <span className="text-text-primary font-medium">High Priority</span>
                    <p className="text-text-sec text-sm mt-0.5">Mark as high priority job</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleInputChange('priority', !formData.priority)}
                  className={`w-14 h-7 rounded-full transition-all duration-200 ${
                    formData.priority ? 'bg-accent-yellow' : 'bg-border-card'
                  } relative border-2 ${
                    formData.priority ? 'border-accent-yellow' : 'border-border-card'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-toggle-thumb rounded-full transition-transform duration-200 shadow-sm ${
                      formData.priority ? 'translate-x-7' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recurrence section - Task only */}
        {itemType === 'task' && (
        <div>
          <SectionHeader icon={RefreshCw} label="Recurrence" />
          <RecurrenceEditor value={recurrence} onChange={setRecurrence} />
        </div>
        )}

        {/* Dependencies - Task only, and only when project selected */}
        {itemType === 'task' && formData.project_id && (
          <div>
            <SectionHeader icon={Link2} label="Dependencies" />
            {/* Current deps list */}
            <div className="space-y-1 mb-2">
              {pendingDeps.length === 0 ? (
                <p className="text-text-sec text-xs py-1">No dependencies added.</p>
              ) : (
                pendingDeps.map(depId => {
                  const depTask = projectTasks.find(t => t.id === depId)
                  return (
                    <div key={depId} className="flex items-center justify-between gap-2 px-4 py-2 bg-bg-card border border-border-card rounded-2xl">
                      <span className="text-text-primary text-sm truncate">{depTask?.title ?? depId}</span>
                      <button
                        type="button"
                        onClick={() => setPendingDeps(prev => prev.filter(id => id !== depId))}
                        className="flex-shrink-0 text-text-sec hover:text-accent-pink transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
            {/* Add dep button / picker */}
            <div className="relative">
              {!showDepPicker ? (
                <button
                  type="button"
                  onClick={() => { setShowDepPicker(true); setDepSearch('') }}
                  className="flex items-center gap-1.5 text-sm text-text-sec hover:text-text-primary transition-colors py-1"
                >
                  <Plus size={14} />
                  Add dependency
                </button>
              ) : (
                <div className="border border-border-card rounded-2xl bg-bg-primary overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-card">
                    <Search size={14} className="text-text-sec flex-shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      value={depSearch}
                      onChange={e => setDepSearch(e.target.value)}
                      placeholder="Search jobs..."
                      className="flex-1 bg-transparent text-text-primary text-sm outline-none placeholder-text-sec"
                    />
                    <button type="button" onClick={() => setShowDepPicker(false)} className="text-text-sec hover:text-text-primary">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {projectTasks
                      .filter(t =>
                        !pendingDeps.includes(t.id) &&
                        !wouldCreateCycle(t.id)
                      )
                      .filter(t => t.title.toLowerCase().includes(depSearch.toLowerCase()))
                      .map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { setPendingDeps(prev => [...prev, t.id]); setShowDepPicker(false); setDepSearch('') }}
                          className="w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-bg-card transition-colors"
                        >
                          {t.title}
                        </button>
                      ))
                    }
                    {projectTasks.filter(t => !pendingDeps.includes(t.id) && !wouldCreateCycle(t.id)).filter(t => t.title.toLowerCase().includes(depSearch.toLowerCase())).length === 0 && (
                      <p className="px-4 py-2.5 text-text-sec text-sm">No jobs available.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Create button */}
        <div className="pt-4 pb-6">
          <button
            type="submit"
            disabled={createTask.isPending}
            className="w-full bg-accent-yellow text-on-light-accent font-bold text-lg py-4 rounded-2xl hover:bg-accent-yellow/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_24px_rgba(255,210,51,0.35)]"
          >
            {createTask.isPending ? 'Creating...' : `Create ${itemLabel}`}
          </button>
        </div>
      </form>
    </div>
    </div>
    </AppShell>
  )
}
