'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Check, Camera, Upload } from 'lucide-react'
import { ChevronDoubleUpIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { AppShell } from '@/components/layout/AppShell'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { ImageCropDialog } from '@/components/avatars/ImageCropDialog'
import { LegoTransformSheet } from '@/components/avatars/LegoTransformSheet'
import { useStaticAvatars, useSetProjectAvatar } from '@/hooks/useProjectAvatar'
import { validateImageFile, createImagePreviewUrl, revokeImagePreviewUrl } from '@/lib/avatars/imageProcessing'
import { MissionDifficulty } from '@/types/database'

const DIFFICULTIES: { value: MissionDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

const COLOR_SWATCHES = [
  '#F5C518',
  '#FF6B6B', 
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
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    deadline: '',
    priority: false,
    difficulty: 'medium' as MissionDifficulty
  })
  const [nameError, setNameError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null)
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [showTransformSheet, setShowTransformSheet] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { data: avatars = [], isLoading } = useStaticAvatars()
  const setAvatar = useSetProjectAvatar()
  
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
        deadline: data.deadline || null,
        priority: data.priority,
        difficulty: data.difficulty,
        color: selectedColor,
        project_avatar_url: selectedAvatarUrl,
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
      console.error('Failed to create mission:', error)
      const message = error?.message || error?.error_description || 'Failed to create mission. Please try again.'
      setErrorMessage(message)
    }
  })
  
  // Generate preview ID on mount
  useEffect(() => {
    setPreviewId(crypto.randomUUID())
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      alert(validation.error)
      return
    }

    setSelectedFile(file)
    const url = createImagePreviewUrl(file)
    setPreviewUrl(url)
    setShowCropDialog(true)
    setShowAvatarPicker(false)
  }

  const handleCameraSelect = () => {
    // Create a file input that accepts camera
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // Use rear camera
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const validation = validateImageFile(file)
        if (!validation.valid) {
          alert(validation.error)
          return
        }
        setSelectedFile(file)
        const url = createImagePreviewUrl(file)
        setPreviewUrl(url)
        setShowCropDialog(true)
        setShowAvatarPicker(false)
      }
    }
    input.click()
  }

  const handleLibrarySelect = () => {
    fileInputRef.current?.click()
  }

  const handleCropComplete = (blob: Blob) => {
    setCroppedBlob(blob)
    setShowCropDialog(false)
    setShowTransformSheet(true)
  }

  const handleCropCancel = () => {
    if (previewUrl) {
      revokeImagePreviewUrl(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setShowCropDialog(false)
  }

  const handleTransformComplete = (avatarUrl: string) => {
    setShowTransformSheet(false)
    if (previewUrl) {
      revokeImagePreviewUrl(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setCroppedBlob(null)
    setSelectedAvatarUrl(avatarUrl)
  }

  const handleTransformDismiss = () => {
    setShowTransformSheet(false)
    if (previewUrl) {
      revokeImagePreviewUrl(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setCroppedBlob(null)
  }

  const handleStaticAvatarSelect = async (path: string) => {
    setSelectedAvatarUrl(path)
    setShowAvatarPicker(false)
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name.trim()) {
      setNameError('Mission name is required')
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
    <AppShell showTabBar={false}>
    <div className="flex flex-col h-[calc(100vh-5rem)] pb-5">
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <button 
          onClick={() => router.back()} 
          className="w-10 h-10 rounded-xl bg-bg-card border border-border-card flex items-center justify-center text-white hover:bg-opacity-80 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-white">
          New Mission
        </h1>
        <div className="w-10" />
      </div>
      
      {/* Avatar preview */}
      <div className="flex justify-center mb-8 mt-6">
        <div className="relative">
          <AvatarImage
            src={selectedAvatarUrl}
            fallbackType="project"
            fallbackLabel={formData.name || 'New Mission'}
            fallbackColor={selectedColor}
            size={128}
            className="shadow-lg border-4 border-white"
          />
          <button
            type="button"
            onClick={() => setShowAvatarPicker(true)}
            className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-bg-card flex items-center justify-center text-white hover:opacity-90 transition-opacity border-2 border-bg-primary"
          >
            <Camera size={20} />
          </button>
        </div>
      </div>
      
      {/* Error Message */}
      {errorMessage && (
        <div className="mx-6 bg-accent-pink bg-opacity-10 border border-accent-pink rounded-2xl px-5 py-3">
          <p className="text-accent-pink text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-6 space-y-4">
        {/* Mission name */}
        <div>
          <label className="text-text-sec text-sm font-medium mb-2 block">
            Mission name
          </label>
          <input
            type="text"
            placeholder="Enter mission name"
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
              <span className="text-white font-medium">Priority Mission</span>
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

        {/* Difficulty — sets the XP multiplier every job in this mission earns */}
        <div className="bg-bg-card border border-border-card rounded-2xl p-5">
          <label className="text-white font-medium mb-1 block">
            Difficulty
          </label>
          <p className="text-text-sec text-sm mb-3">Harder missions pay out more XP per job</p>
          <div className="flex gap-2">
            {DIFFICULTIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, difficulty: value }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  formData.difficulty === value
                    ? value === 'hard' ? 'bg-accent-pink/20 text-accent-pink border border-accent-pink'
                      : value === 'easy' ? 'bg-accent-green/20 text-accent-green border border-accent-green'
                      : 'bg-accent-yellow/20 text-accent-yellow border border-accent-yellow'
                    : 'bg-bg-primary text-text-sec border border-border-card'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Color swatches */}
        <div className="bg-bg-card border border-border-card rounded-2xl p-5">
          <label className="text-white font-medium mb-3 block">
            Mission Color
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
            {createProject.isPending ? 'Creating...' : 'Create Mission'}
          </button>
        </div>
      </form>
    </div>
    </div>

      {/* Avatar Picker Dialog */}
      {showAvatarPicker && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="bg-bg-card w-full rounded-t-3xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-bg-card border-b border-border-card px-6 py-4 flex items-center justify-between">
              <h3 className="text-white text-lg font-semibold">Choose Avatar</h3>
              <button
                onClick={() => setShowAvatarPicker(false)}
                className="text-text-sec hover:text-white transition-colors"
              >
                <Check size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Upload Section */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleCameraSelect}
                    className="flex-1 h-20 bg-bg-card border-2 border-dashed border-border-card rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-accent-yellow transition-colors"
                  >
                    <Camera size={20} className="text-accent-yellow" />
                    <span className="text-white text-xs font-medium">Camera</span>
                  </button>
                  <button
                    onClick={handleLibrarySelect}
                    className="flex-1 h-20 bg-bg-card border-2 border-dashed border-border-card rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-accent-yellow transition-colors"
                  >
                    <Upload size={20} className="text-accent-yellow" />
                    <span className="text-white text-xs font-medium">Library</span>
                  </button>
                </div>
              </div>

              {/* Library Section */}
              <div>
                <h3 className="text-text-sec text-sm font-medium mb-3">From Library</h3>
                {isLoading ? (
                  <div className="grid grid-cols-4 gap-3">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="aspect-square bg-bg-primary rounded-2xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {avatars.map((avatar) => (
                      <button
                        key={avatar.id}
                        onClick={() => handleStaticAvatarSelect(avatar.path)}
                        className={`aspect-square rounded-2xl overflow-hidden transition-all ${
                          selectedAvatarUrl === avatar.path
                            ? 'ring-2 ring-accent-yellow ring-offset-2 ring-offset-bg-card'
                            : 'hover:scale-105'
                        }`}
                      >
                        <img
                          src={avatar.path}
                          alt={avatar.label}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crop Dialog */}
      {showCropDialog && previewUrl && (
        <ImageCropDialog
          imageSrc={previewUrl}
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      {/* Transform Sheet */}
      {showTransformSheet && croppedBlob && (
        <LegoTransformSheet
          file={croppedBlob}
          previewUrl={URL.createObjectURL(croppedBlob)}
          projectId={previewId}
          onComplete={handleTransformComplete}
          onDismiss={handleTransformDismiss}
        />
      )}
    </AppShell>
  )
}
