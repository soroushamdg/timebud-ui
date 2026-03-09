'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { ChevronDoubleUpIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useProjectsForTasks } from '@/hooks/useProjects'
import { getDiceBearUrl } from '@/lib/avatar'
import { DbProject } from '@/types/database'

const PRIORITY_OPTIONS = [
  { value: false, label: 'Normal', color: 'text-text-sec' },
  { value: true, label: 'High Priority', color: 'text-accent-pink' }
]

export default function NewTaskPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    estimated_minutes: 30,
    due_date: '',
    priority: false,
    project_id: ''
  })
  const [titleError, setTitleError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const { data: projects = [] } = useProjectsForTasks()
  
  const createTask = useMutation({
    mutationFn: async (data: typeof formData) => {
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
      
      // Validate and prepare task data
      const taskData = {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        estimated_minutes: Number(data.estimated_minutes) || 30,
        due_date: data.due_date || null,
        priority: Boolean(data.priority),
        project_id: data.project_id || null,
        milestone_id: null,
        user_id: user.id,
        status: 'pending' as const,
        order: 1,
        depends_on_task: null
      }
      
      // Additional validation
      if (!taskData.title) {
        throw new Error('Task title is required')
      }
      if (taskData.estimated_minutes < 1 || taskData.estimated_minutes > 480) {
        throw new Error('Estimated time must be between 1 and 480 minutes')
      }
      
      console.log('Creating task with data:', taskData)
      
      const { data: result, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single()
      
      if (error) {
        console.error('Supabase task creation error:', error)
        throw error
      }
      return result
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      if (task.project_id) {
        router.replace(`/projects/${task.project_id}`)
      } else {
        router.replace('/')
      }
    },
    onError: (error: any) => {
      console.error('Failed to create task - Full error object:', error)
      console.error('Error details:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        error_description: error?.error_description
      })
      
      let message = 'Failed to create task. Please try again.'
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
    
    // Validation
    if (!formData.title.trim()) {
      setTitleError('Task title is required')
      return
    }
    
    setTitleError('')
    setErrorMessage('')
    createTask.mutate(formData)
  }
  
  const handleInputChange = (field: keyof typeof formData, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (field === 'title' && titleError) {
      setTitleError('')
    }
  }
  
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
          New Task
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
        {/* Task title */}
        <div>
          <label className="text-text-sec text-sm font-medium mb-2 block">
            Task title
          </label>
          <input
            type="text"
            placeholder="Enter task title"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white placeholder-text-sec focus:outline-none focus:border-accent-yellow transition-colors"
            required
          />
          {titleError && (
            <p className="text-accent-pink text-sm mt-2">{titleError}</p>
          )}
        </div>
        
        {/* Description */}
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
        
        {/* Project selection */}
        <div>
          <label className="text-text-sec text-sm font-medium mb-2 block">
            Project (optional)
          </label>
          <select
            value={formData.project_id}
            onChange={(e) => handleInputChange('project_id', e.target.value)}
            className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-accent-yellow transition-colors"
          >
            <option value="">No project (General task)</option>
            {projects.map((project: DbProject) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Estimated time */}
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
            onChange={(e) => handleInputChange('estimated_minutes', parseInt(e.target.value) || 30)}
            className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-accent-yellow transition-colors"
          />
        </div>
        
        {/* Due date */}
        <div>
          <label className="text-text-sec text-sm font-medium mb-2 block">
            Due date (optional)
          </label>
          <input
            type="date"
            value={formData.due_date}
            onChange={(e) => handleInputChange('due_date', e.target.value)}
            className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-accent-yellow transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
          />
        </div>
        
        {/* Priority */}
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
        
        {/* Create button */}
        <div className="pt-4 pb-6">
          <button
            type="submit"
            disabled={createTask.isPending}
            className="w-full bg-accent-yellow text-black font-bold text-lg py-4 rounded-2xl hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {createTask.isPending ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  )
}
