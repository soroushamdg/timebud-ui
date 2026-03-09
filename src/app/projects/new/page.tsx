'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Check } from 'lucide-react'
import { ChevronDoubleUpIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toUtcString } from '@/lib/dates'
import { getDiceBearUrl } from '@/lib/avatar'

const COLOR_SWATCHES = [
  '#F5C518',
  '#E8004D', 
  '#2ECC71',
  '#3B82F6',
  '#8B5CF6',
  '#F97316'
]

export default function NewProjectPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const [previewId, setPreviewId] = useState('')
  const [selectedColor, setSelectedColor] = useState(COLOR_SWATCHES[0])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    deadline: '',
    priority: false
  })
  const [nameError, setNameError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  // Generate preview ID on mount
  useEffect(() => {
    setPreviewId(crypto.randomUUID())
  }, [])
  
  const createProject = useMutation({
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
      
      const projectData = {
        id: previewId,
        name: data.name,
        description: data.description || null,
        deadline: data.deadline ? toUtcString(new Date(data.deadline)) : null,
        priority: data.priority,
        color: selectedColor,
        user_id: user.id,
        status: 'active' as const
      }
      
      const { data: result, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single()
      
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      router.replace(`/projects/${previewId}`)
    },
    onError: (error: any) => {
      console.error('Failed to create project:', error)
      const message = error?.message || error?.error_description || 'Failed to create project. Please try again.'
      setErrorMessage(message)
    }
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name.trim()) {
      setNameError('Project name is required')
      return
    }
    
    setNameError('')
    setErrorMessage('')
    createProject.mutate(formData)
  }
  
  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (field === 'name' && nameError) {
      setNameError('')
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
          New Project
        </h1>
        <div className="w-10" />
      </div>
      
      {/* Avatar preview */}
      <div className="flex justify-center mb-8 mt-6">
        <img
          src={getDiceBearUrl(previewId, selectedColor)}
          alt="Project preview"
          className="w-32 h-32 rounded-3xl border-4 border-black shadow-lg"
        />
      </div>
      
      {/* Error Message */}
      {errorMessage && (
        <div className="mx-6 bg-accent-pink bg-opacity-10 border border-accent-pink rounded-2xl px-5 py-3">
          <p className="text-accent-pink text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-6 space-y-4">
        {/* Project name */}
        <div>
          <label className="text-text-sec text-sm font-medium mb-2 block">
            Project name
          </label>
          <input
            type="text"
            placeholder="Enter project name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white placeholder-text-sec focus:outline-none focus:border-accent-yellow transition-colors"
            required
          />
          {nameError && (
            <p className="text-accent-pink text-sm mt-2">{nameError}</p>
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
        
        {/* Deadline */}
        <div>
          <label className="text-text-sec text-sm font-medium mb-2 block">
            Deadline (optional)
          </label>
          <input
            type="date"
            value={formData.deadline}
            onChange={(e) => handleInputChange('deadline', e.target.value)}
            className="w-full bg-bg-card border border-border-card rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-accent-yellow transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
          />
        </div>
        
        {/* Priority */}
        <button
          type="button"
          onClick={() => handleInputChange('priority', !formData.priority)}
          className="w-full flex items-center justify-between bg-bg-card border border-border-card rounded-2xl px-5 py-4 hover:bg-opacity-80 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ChevronDoubleUpIcon className="w-4 h-4 text-accent-yellow" />
            <div className="text-left">
              <span className="text-white font-medium">Priority Project</span>
              <p className="text-text-sec text-sm mt-0.5">Mark as high priority</p>
            </div>
          </div>
          <div
            className={`w-14 h-7 rounded-full transition-all duration-200 ${
              formData.priority ? 'bg-accent-yellow' : 'bg-border-card'
            } relative flex items-center`}
          >
            <div
              className={`w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-md ${
                formData.priority ? 'translate-x-8' : 'translate-x-0'
              }`}
            />
          </div>
        </button>
        
        {/* Color swatches */}
        <div className="bg-bg-card border border-border-card rounded-2xl p-5">
          <label className="text-white font-medium mb-3 block">
            Project Color
          </label>
          <div className="flex justify-between gap-2">
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className={`w-10 h-10 rounded-full relative transition-all ${
                  selectedColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-card scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              >
                {selectedColor === color && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check size={18} className="text-black" strokeWidth={3} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* Create button */}
        <div className="pt-4 pb-6">
          <button
            type="submit"
            disabled={createProject.isPending}
            className="w-full bg-accent-yellow text-black font-bold text-lg py-4 rounded-2xl hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {createProject.isPending ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  )
}
