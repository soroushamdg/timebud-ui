'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useProjectsForTasks } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { DbProject, DbTask, DbMilestone } from '@/types/database'
import { toUtcString } from '@/lib/dates'

interface MilestoneFormData {
  name: string
  projectId: string
  selectedTaskIds: string[]
}

const steps = [
  { title: 'Milestone Name', description: 'Give your milestone a clear name' },
  { title: 'Select Project', description: 'Choose which project this milestone belongs to' },
  { title: 'Add Tasks', description: 'Select tasks to include in this milestone' }
]

export default function NewMilestonePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<MilestoneFormData>({
    name: '',
    projectId: '',
    selectedTaskIds: []
  })
  const [nameError, setNameError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [milestoneId, setMilestoneId] = useState('')

  const { data: projects = [] } = useProjectsForTasks()
  
  // Get tasks for selected project that don't have a milestone
  const { data: availableTasks = [] } = useTasks({
    projectId: formData.projectId,
    status: 'pending'
  })

  // Filter tasks that don't already have a milestone
  const tasksWithoutMilestone = availableTasks.filter(task => !task.milestone_id)

  const createMilestone = useMutation({
    mutationFn: async (data: MilestoneFormData) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Ensure user record exists
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

      // Get the highest order number for milestones in this project
      const { data: existingMilestones } = await supabase
        .from('milestones')
        .select('order')
        .eq('project_id', data.projectId)
        .order('order', { ascending: false })
        .limit(1)

      const nextOrder = existingMilestones && existingMilestones.length > 0 
        ? existingMilestones[0].order + 1 
        : 1

      // Create milestone
      const milestoneData = {
        id: milestoneId,
        project_id: data.projectId,
        title: data.name.trim(),
        description: null,
        target_date: null,
        order: nextOrder,
        created_at: toUtcString(new Date())
      }

      const { data: milestone, error: milestoneError } = await supabase
        .from('milestones')
        .insert(milestoneData)
        .select()
        .single()

      if (milestoneError) throw milestoneError

      // Update selected tasks with milestone_id
      if (data.selectedTaskIds.length > 0) {
        const { error: tasksError } = await supabase
          .from('tasks')
          .update({ milestone_id: milestoneId })
          .in('id', data.selectedTaskIds)

        if (tasksError) throw tasksError
      }

      return milestone
    },
    onSuccess: (milestone) => {
      queryClient.invalidateQueries({ queryKey: ['milestones'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      router.replace(`/projects/${milestone.project_id}`)
    },
    onError: (error: any) => {
      console.error('Failed to create milestone:', error)
      const message = error?.message || error?.error_description || 'Failed to create milestone. Please try again.'
      setErrorMessage(message)
    }
  })

  // Generate milestone ID on mount
  useEffect(() => {
    setMilestoneId(crypto.randomUUID())
  }, [])

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0:
        if (!formData.name.trim()) {
          setNameError('Milestone name is required')
          return false
        }
        setNameError('')
        return true
      case 1:
        if (!formData.projectId) {
          setErrorMessage('Please select a project')
          return false
        }
        setErrorMessage('')
        return true
      case 2:
        // Tasks are optional
        setErrorMessage('')
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (!validateCurrentStep()) return
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
      setErrorMessage('')
    } else {
      // Submit form
      createMilestone.mutate(formData)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      setErrorMessage('')
    }
  }

  const handleInputChange = (field: keyof MilestoneFormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (field === 'name' && nameError) {
      setNameError('')
    }
    if (field === 'projectId') {
      // Reset selected tasks when project changes
      setFormData(prev => ({ ...prev, selectedTaskIds: [] }))
    }
  }

  const toggleTaskSelection = (taskId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedTaskIds: prev.selectedTaskIds.includes(taskId)
        ? prev.selectedTaskIds.filter(id => id !== taskId)
        : [...prev.selectedTaskIds, taskId]
    }))
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-text-sec text-sm font-medium mb-2 block">
                Milestone name
              </label>
              <input
                type="text"
                placeholder="Enter milestone name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white placeholder-text-sec focus:outline-none focus:border-accent-yellow transition-colors"
                required
              />
              {nameError && (
                <p className="text-accent-pink text-sm mt-2">{nameError}</p>
              )}
            </div>
          </div>
        )

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-text-sec text-sm font-medium mb-2 block">
                Select Project
              </label>
              <select
                value={formData.projectId}
                onChange={(e) => handleInputChange('projectId', e.target.value)}
                className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-accent-yellow transition-colors"
              >
                <option value="">Choose a project...</option>
                {projects.map((project: DbProject) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-text-sec text-sm font-medium mb-2 block">
                Select Tasks to Include
              </label>
              {tasksWithoutMilestone.length === 0 ? (
                <div className="bg-bg-card border border-border-card rounded-2xl p-6 text-center">
                  <p className="text-text-sec">
                    {formData.projectId 
                      ? 'No available tasks in this project. All tasks are already assigned to milestones.'
                      : 'Please select a project first to see available tasks.'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {tasksWithoutMilestone.map((task: DbTask) => (
                    <div
                      key={task.id}
                      className={`bg-bg-card border border-border-card rounded-2xl p-4 cursor-pointer transition-all ${
                        formData.selectedTaskIds.includes(task.id)
                          ? 'border-accent-yellow bg-opacity-50'
                          : 'hover:bg-opacity-80'
                      }`}
                      onClick={() => toggleTaskSelection(task.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                          formData.selectedTaskIds.includes(task.id)
                            ? 'border-accent-yellow bg-accent-yellow'
                            : 'border-border-card'
                        }`}>
                          {formData.selectedTaskIds.includes(task.id) && (
                            <Check size={14} className="text-black" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-white font-medium">{task.title}</h4>
                          {task.description && (
                            <p className="text-text-sec text-sm mt-1">{task.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-text-sec">
                            <span>⏱️ {task.estimated_minutes}min</span>
                            {task.priority && <span className="text-accent-pink">High Priority</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {formData.selectedTaskIds.length > 0 && (
                <p className="text-text-sec text-sm">
                  {formData.selectedTaskIds.length} task{formData.selectedTaskIds.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          </div>
        )

      default:
        return null
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
          New Milestone
        </h1>
        <div className="w-10" />
      </div>

      {/* Progress Steps */}
      <div className="px-6 mb-8">
        <div className="flex items-center relative">
          {/* Connecting line background */}
          <div className="absolute left-8 right-8 h-0.5 bg-border-card top-1/2 -translate-y-1/2" />
          {/* Connecting line progress */}
          <div 
            className="absolute left-8 h-0.5 bg-accent-yellow top-1/2 -translate-y-1/2 transition-all duration-300"
            style={{ 
              right: currentStep === steps.length - 1 ? '8px' : `${8 + (100 - 16) * (1 - (currentStep / (steps.length - 1)))}%`
            }}
          />
          {steps.map((step, index) => (
            <div key={index} className="flex-1 flex justify-center relative">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors z-10 ${
                  index <= currentStep
                    ? 'bg-accent-yellow text-black'
                    : 'bg-border-card text-text-sec'
                }`}
              >
                {index < currentStep ? <Check size={16} /> : index + 1}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <h3 className="text-white font-semibold">{steps[currentStep].title}</h3>
          <p className="text-text-sec text-sm mt-1">{steps[currentStep].description}</p>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mx-6 mb-4 bg-accent-pink bg-opacity-10 border border-accent-pink rounded-2xl px-5 py-3">
          <p className="text-accent-pink text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Form Content */}
      <div className="px-6">
        {renderStepContent()}
      </div>

      {/* Navigation Buttons */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handlePrevious}
              disabled={createMilestone.isPending}
              className="flex-1 bg-bg-card border border-border-card text-white font-medium py-4 rounded-2xl hover:bg-opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={createMilestone.isPending}
            className="flex-1 bg-accent-yellow text-black font-bold py-4 rounded-2xl hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {createMilestone.isPending 
              ? 'Creating...' 
              : currentStep === steps.length - 1 
                ? 'Create Milestone' 
                : 'Next'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
