'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, X, Plus, Search, RefreshCw } from 'lucide-react'
import { ChevronDoubleUpIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useProjectsForTasks } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { toUtcString } from '@/lib/dates'
import { DbProject } from '@/types/database'

const PRIORITY_OPTIONS = [
  { value: false, label: 'Normal', color: 'text-text-sec' },
  { value: true, label: 'High Priority', color: 'text-accent-pink' }
]

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
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'specific_days' | 'interval'>('daily')
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([1]) // Mon default
  const [recurrenceInterval, setRecurrenceInterval] = useState(2)
  const [recurrenceEndType, setRecurrenceEndType] = useState<'none' | 'date' | 'after'>('none')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  const [recurrenceEndAfter, setRecurrenceEndAfter] = useState(10)
  const [recurrenceMissedBehavior, setRecurrenceMissedBehavior] = useState<'overdue' | 'skip'>('overdue')

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
    mutationFn: async (data: typeof formData & { itemType: 'task' | 'milestone'; recurring: boolean }) => {
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

      if (data.recurring && data.itemType === 'task') {
        // Recurring task: insert as template
        const templateData: Record<string, unknown> = {
          title: data.title.trim(),
          project_id: data.project_id || null,
          user_id: user.id,
          item_type: 'task',
          order: calculatedOrder,
          created_at: new Date().toISOString(),
          description: data.description?.trim() || null,
          estimated_minutes: Number(data.estimated_minutes) || 25,
          priority: Boolean(data.priority),
          status: null,
          due_date: null,
          is_recurring_template: true,
          recurrence_type: recurrenceType,
          recurrence_days: recurrenceType === 'specific_days' ? recurrenceDays : null,
          recurrence_interval: recurrenceType === 'interval' ? recurrenceInterval : null,
          recurrence_end_date: recurrenceEndType === 'date' && recurrenceEndDate ? toUtcString(new Date(recurrenceEndDate)) : null,
          recurrence_end_after: recurrenceEndType === 'after' ? recurrenceEndAfter : null,
          recurrence_missed_behavior: recurrenceMissedBehavior,
        }

        if (!templateData.title) throw new Error('Task title is required')

        const { data: template, error: tErr } = await supabase
          .from('tasks')
          .insert(templateData)
          .select()
          .single()

        if (tErr) throw tErr

        // Generate first occurrence immediately
        await supabase.rpc('generate_next_occurrence', { p_template_id: template.id })

        return template
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
          due_date: data.due_date ? toUtcString(new Date(data.due_date)) : null,
          priority: false,
        })
      } else {
        // Task-specific fields
        Object.assign(itemData, {
          description: data.description?.trim() || null,
          estimated_minutes: Number(data.estimated_minutes) || 25,
          status: 'pending' as const,
          due_date: data.due_date ? toUtcString(new Date(data.due_date)) : null,
          priority: Boolean(data.priority),
        })
      }
      
      // Validation
      if (!itemData.title) {
        throw new Error(`${data.itemType === 'milestone' ? 'Milestone' : 'Task'} title is required`)
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
      // Insert dependencies if any (only for non-template tasks)
      if (item.item_type === 'task' && !item.is_recurring_template && pendingDeps.length > 0) {
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
      
      let message = `Failed to create ${itemType}. Please try again.`
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
      setTitleError(`${itemType === 'milestone' ? 'Milestone' : 'Task'} title is required`)
      return
    }
    
    if (itemType === 'milestone' && !formData.project_id) {
      setProjectError('Please select a project for this milestone')
      return
    }
    
    // Deadline validation: task/milestone deadline cannot be after project deadline
    if (formData.project_id && formData.due_date) {
      const selectedProject = projects.find(p => p.id === formData.project_id)
      if (selectedProject && selectedProject.deadline) {
        const taskDeadline = new Date(formData.due_date)
        const projectDeadline = new Date(selectedProject.deadline)
        
        if (taskDeadline > projectDeadline) {
          setDeadlineError(`${itemType === 'milestone' ? 'Milestone' : 'Task'} deadline cannot be after project deadline (${new Date(selectedProject.deadline).toLocaleDateString()})`)
          return
        }
      }
    }
    
    createTask.mutate({ ...formData, itemType, recurring: isRecurring && itemType === 'task' })
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
    <div className="min-h-screen bg-bg-primary max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <button 
          onClick={() => router.back()} 
          className="w-10 h-10 rounded-xl bg-bg-card border border-border-card flex items-center justify-center text-white hover:bg-opacity-80 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-white">
          {itemType === 'milestone' ? 'New Milestone' : 'New Task'}
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
      <form onSubmit={handleSubmit} className="px-6 space-y-4">
        {/* Segmented Control */}
        <div className="bg-bg-card rounded-2xl p-1 flex w-full">
          <button
            type="button"
            onClick={() => setItemType('task')}
            className={`flex-1 text-center py-2 text-base rounded-xl transition-colors ${
              itemType === 'task'
                ? 'bg-accent-yellow text-black font-bold'
                : 'text-text-sec'
            }`}
          >
            Task
          </button>
          <button
            type="button"
            onClick={() => setItemType('milestone')}
            className={`flex-1 text-center py-2 text-base rounded-xl transition-colors ${
              itemType === 'milestone'
                ? 'bg-accent-yellow text-black font-bold'
                : 'text-text-sec'
            }`}
          >
            Milestone
          </button>
        </div>

        {/* Title */}
        <div>
          <label className="text-text-sec text-sm font-medium mb-2 block">
            {itemType === 'milestone' ? 'Milestone title' : 'Task title'}
          </label>
          <input
            type="text"
            placeholder={itemType === 'milestone' ? 'e.g. Beta release, Design handoff' : 'Enter task title'}
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white placeholder-text-sec focus:outline-none focus:border-accent-yellow transition-colors"
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
              className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white placeholder-text-sec focus:outline-none focus:border-accent-yellow resize-none transition-colors"
            />
          </div>
        )}
        
        {/* Project selection */}
        <div>
          <label className="text-text-sec text-sm font-medium mb-2 block">
            {itemType === 'milestone' ? 'Project (required)' : 'Project (optional)'}
          </label>
          <select
            value={formData.project_id}
            onChange={(e) => handleInputChange('project_id', e.target.value)}
            className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-accent-yellow transition-colors"
            required={itemType === 'milestone'}
          >
            {itemType === 'task' && <option value="">No project (General task)</option>}
            {itemType === 'milestone' && <option value="">Select a project</option>}
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
              className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-accent-yellow transition-colors"
            />
          </div>
        )}
        
        {/* Due date — hidden when recurrence is on */}
        {!(isRecurring && itemType === 'task') && (
          <div>
            <label className="text-text-sec text-sm font-medium mb-2 block">
              {itemType === 'milestone' ? 'Deadline (optional)' : 'Due date (optional)'}
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => handleInputChange('due_date', e.target.value)}
              className={`w-full bg-bg-card border rounded-2xl px-5 py-3.5 text-white focus:outline-none transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 ${
                deadlineError ? 'border-accent-pink' : 'border-border-card focus:border-accent-yellow'
              }`}
            />
            {deadlineError && (
              <p className="text-accent-pink text-sm mt-2">{deadlineError}</p>
            )}
          </div>
        )}
        
        {/* Recurrence toggle - Task only */}
        {itemType === 'task' && (
          <div className="flex items-center justify-between bg-bg-card border border-border-card rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-accent-yellow" />
              <div>
                <span className="text-white font-medium">Repeats</span>
                <p className="text-text-sec text-sm mt-0.5">Make this a recurring task</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsRecurring(r => !r)}
              className={`w-14 h-7 rounded-full transition-all duration-200 ${
                isRecurring ? 'bg-accent-yellow' : 'bg-border-card'
              } relative border-2 ${
                isRecurring ? 'border-accent-yellow' : 'border-border-card'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm ${
                  isRecurring ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        )}

        {/* Recurrence config section */}
        {isRecurring && itemType === 'task' && (
          <div className="bg-bg-card border border-border-card rounded-2xl px-5 py-4 space-y-5">
            {/* Pattern */}
            <div>
              <p className="text-text-sec text-sm font-medium mb-3">Repeat pattern</p>
              <div className="flex gap-2 flex-wrap">
                {(['daily', 'specific_days', 'interval'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRecurrenceType(type)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                      recurrenceType === type
                        ? 'bg-accent-yellow text-black'
                        : 'bg-bg-primary text-text-sec border border-border-card'
                    }`}
                  >
                    {type === 'daily' ? 'Every day' : type === 'specific_days' ? 'Specific days' : 'Every X days'}
                  </button>
                ))}
              </div>

              {recurrenceType === 'specific_days' && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {[{ label: 'Sun', val: 0 }, { label: 'Mon', val: 1 }, { label: 'Tue', val: 2 }, { label: 'Wed', val: 3 }, { label: 'Thu', val: 4 }, { label: 'Fri', val: 5 }, { label: 'Sat', val: 6 }].map(({ label, val }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRecurrenceDays(prev =>
                        prev.includes(val)
                          ? prev.filter(d => d !== val).length > 0 ? prev.filter(d => d !== val) : prev
                          : [...prev, val]
                      )}
                      className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                        recurrenceDays.includes(val)
                          ? 'bg-accent-yellow text-black'
                          : 'bg-bg-primary text-text-sec border border-border-card'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {recurrenceType === 'interval' && (
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-text-sec text-sm">Every</span>
                  <input
                    type="number"
                    min={2}
                    max={365}
                    value={recurrenceInterval}
                    onChange={e => setRecurrenceInterval(Math.max(2, Math.min(365, parseInt(e.target.value) || 2)))}
                    className="w-20 bg-bg-primary border border-border-card rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-yellow"
                  />
                  <span className="text-text-sec text-sm">days</span>
                </div>
              )}
            </div>

            {/* End condition */}
            <div>
              <p className="text-text-sec text-sm font-medium mb-3">Ends</p>
              <div className="flex gap-2 flex-wrap">
                {(['none', 'date', 'after'] as const).map(et => (
                  <button
                    key={et}
                    type="button"
                    onClick={() => setRecurrenceEndType(et)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                      recurrenceEndType === et
                        ? 'bg-accent-yellow text-black'
                        : 'bg-bg-primary text-text-sec border border-border-card'
                    }`}
                  >
                    {et === 'none' ? 'No end' : et === 'date' ? 'End date' : 'After X times'}
                  </button>
                ))}
              </div>
              {recurrenceEndType === 'date' && (
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={e => setRecurrenceEndDate(e.target.value)}
                  className="mt-3 w-full bg-bg-primary border border-border-card rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-accent-yellow [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70"
                />
              )}
              {recurrenceEndType === 'after' && (
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-text-sec text-sm">After</span>
                  <input
                    type="number"
                    min={1}
                    value={recurrenceEndAfter}
                    onChange={e => setRecurrenceEndAfter(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-bg-primary border border-border-card rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-yellow"
                  />
                  <span className="text-text-sec text-sm">times</span>
                </div>
              )}
            </div>

            {/* Missed behavior */}
            <div>
              <p className="text-text-sec text-sm font-medium mb-3">If a day is missed</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRecurrenceMissedBehavior('overdue')}
                  className={`p-3 rounded-xl text-left transition-colors border ${
                    recurrenceMissedBehavior === 'overdue'
                      ? 'border-accent-yellow bg-accent-yellow/10'
                      : 'border-border-card bg-bg-primary'
                  }`}
                >
                  <p className={`text-sm font-medium ${
                    recurrenceMissedBehavior === 'overdue' ? 'text-accent-yellow' : 'text-white'
                  }`}>Show as overdue</p>
                  <p className="text-text-sec text-xs mt-0.5">Missed days stay visible</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRecurrenceMissedBehavior('skip')}
                  className={`p-3 rounded-xl text-left transition-colors border ${
                    recurrenceMissedBehavior === 'skip'
                      ? 'border-accent-yellow bg-accent-yellow/10'
                      : 'border-border-card bg-bg-primary'
                  }`}
                >
                  <p className={`text-sm font-medium ${
                    recurrenceMissedBehavior === 'skip' ? 'text-accent-yellow' : 'text-white'
                  }`}>Skip missed days</p>
                  <p className="text-text-sec text-xs mt-0.5">Auto-skip and move on</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Priority - Task only */}
        {itemType === 'task' && (
          <div className="flex items-center justify-between bg-bg-card border border-border-card rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2">
              <ChevronDoubleUpIcon className="w-4 h-4 text-accent-yellow" />
              <div>
                <span className="text-white font-medium">High Priority</span>
                <p className="text-text-sec text-sm mt-0.5">Mark as high priority task</p>
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
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm ${
                  formData.priority ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        )}

        {/* Dependencies - Task only, and only when project selected */}
        {itemType === 'task' && formData.project_id && (
          <div>
            <label className="text-text-sec text-sm font-medium mb-2 block">
              Dependencies (optional)
            </label>
            {/* Current deps list */}
            <div className="space-y-1 mb-2">
              {pendingDeps.length === 0 ? (
                <p className="text-text-sec text-xs py-1">No dependencies added.</p>
              ) : (
                pendingDeps.map(depId => {
                  const depTask = projectTasks.find(t => t.id === depId)
                  return (
                    <div key={depId} className="flex items-center justify-between gap-2 px-4 py-2 bg-bg-card border border-border-card rounded-2xl">
                      <span className="text-white text-sm truncate">{depTask?.title ?? depId}</span>
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
                  className="flex items-center gap-1.5 text-sm text-text-sec hover:text-white transition-colors py-1"
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
                      placeholder="Search tasks..."
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder-text-sec"
                    />
                    <button type="button" onClick={() => setShowDepPicker(false)} className="text-text-sec hover:text-white">
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
                          className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-bg-card transition-colors"
                        >
                          {t.title}
                        </button>
                      ))
                    }
                    {projectTasks.filter(t => !pendingDeps.includes(t.id) && !wouldCreateCycle(t.id)).filter(t => t.title.toLowerCase().includes(depSearch.toLowerCase())).length === 0 && (
                      <p className="px-4 py-2.5 text-text-sec text-sm">No tasks available.</p>
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
            className="w-full bg-accent-yellow text-black font-bold text-lg py-4 rounded-2xl hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {createTask.isPending ? 'Creating...' : `Create ${itemType === 'milestone' ? 'Milestone' : 'Task'}`}
          </button>
        </div>
      </form>
    </div>
  )
}
