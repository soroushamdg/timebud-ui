'use client'

import { useState, useRef } from 'react'
import { X, Upload, Camera } from 'lucide-react'
import { useStaticAvatars, useSetProjectAvatar, useRemoveProjectAvatar } from '@/hooks/useProjectAvatar'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { ImageCropDialog } from './ImageCropDialog'
import { LegoTransformSheet } from './LegoTransformSheet'
import { ErrorDialog } from '@/components/ui/ErrorDialog'
import { useImageCache } from '@/hooks/useImageCache'
import { validateImageFile, createImagePreviewUrl, revokeImagePreviewUrl, compressImage } from '@/lib/avatars/imageProcessing'

interface ProjectAvatarPickerProps {
  projectId: string
  currentAvatarUrl?: string | null
  onClose: () => void
  onAvatarChanged: (newUrl: string | null) => void
}

export function ProjectAvatarPicker({
  projectId,
  currentAvatarUrl,
  onClose,
  onAvatarChanged,
}: ProjectAvatarPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null)
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [showTransformSheet, setShowTransformSheet] = useState(false)
  const [showConfirmRemove, setShowConfirmRemove] = useState(false)
  const [errorDialog, setErrorDialog] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  })

  const showErrorDialog = (title: string, message: string) => {
    setErrorDialog({ isOpen: true, title, message })
  }

  const dismissErrorDialog = () => {
    setErrorDialog({ isOpen: false, title: '', message: '' })
  }

  const handleOversizedFile = async (file: File): Promise<File> => {
    try {
      console.log('Compressing oversized file:', file.name, file.size)
      const compressedBlob = await compressImage(file, 1500) // Target 1.5MB
      const compressedFile = new File([compressedBlob], file.name, {
        type: compressedBlob.type,
        lastModified: Date.now()
      })
      console.log('Compressed file size:', compressedFile.size)
      return compressedFile
    } catch (error) {
      console.error('Compression failed:', error)
      throw error
    }
  }

  const { data: avatars = [], isLoading } = useStaticAvatars()
  const setAvatar = useSetProjectAvatar()
  const removeAvatar = useRemoveProjectAvatar()
  const { invalidateProject } = useImageCache()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    console.log('Library file selected:', file?.name, file?.type, file?.size)
    
    if (!file) {
      console.error('No file selected from library')
      showErrorDialog('File Selection', 'No file was selected. Please try again.')
      return
    }

    let processedFile = file
    
    // Check if file needs compression
    const validation = validateImageFile(file)
    if (!validation.valid && validation.error?.includes('smaller than')) {
      try {
        // Show compression dialog
        setErrorDialog({ 
          isOpen: true, 
          title: 'Compressing Photo', 
          message: 'Your photo is large. Compressing it to fit size limits...' 
        })
        
        processedFile = await handleOversizedFile(file)
        
        // Close compression dialog
        dismissErrorDialog()
        
        // Re-validate compressed file
        const revalidation = validateImageFile(processedFile)
        if (!revalidation.valid) {
          showErrorDialog('File Too Large', 'Photo is still too large after compression. Please try a smaller photo.')
          return
        }
        
        console.log('File compressed successfully:', processedFile.size)
      } catch (error) {
        console.error('Compression failed:', error)
        showErrorDialog('Compression Failed', 'Failed to compress photo. Please try a smaller photo.')
        return
      }
    } else if (!validation.valid) {
      // Other validation errors (file type, etc.)
      console.error('Validation failed:', validation.error)
      showErrorDialog('Invalid File', validation.error || 'Please select a valid image file.')
      return
    }

    setSelectedFile(processedFile)
    const url = createImagePreviewUrl(processedFile)
    setPreviewUrl(url)
    setShowCropDialog(true)
  }

  const handleCameraSelect = () => {
    // Create a file input that accepts camera with better mobile support
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    
    // Try rear camera first, fallback to front camera
    input.capture = 'environment'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      console.log('Camera file selected:', file?.name, file?.type, file?.size)
      
      if (file) {
        let processedFile = file
        
        // Check if file needs compression
        const validation = validateImageFile(file)
        if (!validation.valid && validation.error?.includes('smaller than')) {
          try {
            // Show compression dialog
            setErrorDialog({ 
              isOpen: true, 
              title: 'Compressing Photo', 
              message: 'Your photo is large. Compressing it to fit size limits...' 
            })
            
            processedFile = await handleOversizedFile(file)
            
            // Close compression dialog
            dismissErrorDialog()
            
            // Re-validate compressed file
            const revalidation = validateImageFile(processedFile)
            if (!revalidation.valid) {
              showErrorDialog('File Too Large', 'Photo is still too large after compression. Please try a smaller photo.')
              return
            }
            
            console.log('File compressed successfully:', processedFile.size)
          } catch (error) {
            console.error('Compression failed:', error)
            showErrorDialog('Compression Failed', 'Failed to compress photo. Please try a smaller photo.')
            return
          }
        } else if (!validation.valid) {
          // Other validation errors (file type, etc.)
          console.error('Validation failed:', validation.error)
          showErrorDialog('Invalid File', validation.error || 'Please select a valid image file.')
          return
        }
        
        setSelectedFile(processedFile)
        const url = createImagePreviewUrl(processedFile)
        setPreviewUrl(url)
        setShowCropDialog(true)
      } else {
        console.error('No file selected from camera')
        showErrorDialog('Camera Error', 'No photo was captured. Please try again.')
      }
    }
    
    input.onerror = (error) => {
      console.error('Camera input error:', error)
      showErrorDialog('Camera Error', 'Failed to access camera. Please try again or use photo library.')
    }
    
    // Add timeout to handle mobile camera issues
    setTimeout(() => {
      try {
        input.click()
        console.log('Camera input triggered')
      } catch (error) {
        console.error('Failed to trigger camera input:', error)
        showErrorDialog('Camera Unavailable', 'Camera is not available. Please use photo library instead.')
      } 
      fileInputRef.current?.click()
    }, 100)
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
    // Invalidate cache when avatar is updated
    invalidateProject(projectId)
    onAvatarChanged(avatarUrl)
    onClose()
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
    try {
      await setAvatar.mutateAsync({ projectId, staticPath: path })
      // Invalidate cache when avatar is updated
      invalidateProject(projectId)
      onAvatarChanged(path)
      onClose()
    } catch (error) {
      console.error('Failed to set avatar:', error)
      showErrorDialog('Upload Failed', 'Failed to set avatar. Please try again.')
    }
  }

  const handleRemoveConfirm = async () => {
    try {
      await removeAvatar.mutateAsync(projectId)
      // Invalidate cache when avatar is removed
      invalidateProject(projectId)
      onAvatarChanged(null)
      onClose()
    } catch (error) {
      console.error('Failed to remove avatar:', error)
      showErrorDialog('Removal Failed', 'Failed to remove avatar. Please try again.')
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-scrim/50 z-[150]" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 bg-bg-card rounded-t-3xl z-[160] max-h-[70vh] overflow-y-auto">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-border-card rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-card">
          <h2 className="text-text-primary font-bold text-xl">Mission Avatar</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-bg-primary flex items-center justify-center text-text-sec hover:text-text-primary transition-colors"
          >
            <X size={16} />
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
                <span className="text-text-primary text-xs font-medium">Camera</span>
              </button>
              <button
                onClick={handleLibrarySelect}
                className="flex-1 h-20 bg-bg-card border-2 border-dashed border-border-card rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-accent-yellow transition-colors"
              >
                <Upload size={20} className="text-accent-yellow" />
                <span className="text-text-primary text-xs font-medium">Library</span>
              </button>
            </div>
          </div>

          {/* Library Section */}
          <div className="mt-8">
            <h3 className="text-text-sec text-sm font-medium mb-4">From Library</h3>
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
                    className={`aspect-square rounded-2xl overflow-hidden transition-all flex items-center justify-center ${
                      currentAvatarUrl === avatar.path
                        ? 'ring-2 ring-accent-yellow ring-offset-2 ring-offset-bg-card'
                        : 'hover:scale-105'
                    }`}
                  >
                    <AvatarImage
                      src={avatar.path}
                      fallbackType="project"
                      fallbackLabel={avatar.label}
                      className="w-full h-full"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Remove Section */}
          {currentAvatarUrl && (
            <div className="pt-4 border-t border-border-card">
              {showConfirmRemove ? (
                <div className="space-y-3">
                  <p className="text-text-sec text-sm text-center">
                    Remove this avatar?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowConfirmRemove(false)}
                      className="flex-1 bg-bg-primary border border-border-card text-text-primary font-medium py-2 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRemoveConfirm}
                      disabled={removeAvatar.isPending}
                      className="flex-1 bg-accent-pink text-on-dark-accent font-medium py-2 rounded-xl disabled:opacity-50"
                    >
                      {removeAvatar.isPending ? 'Removing...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirmRemove(true)}
                  className="w-full text-accent-pink text-sm font-medium py-2"
                >
                  Remove avatar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Loading overlay */}
        {setAvatar.isPending && (
          <div className="absolute inset-0 bg-scrim/50 flex items-center justify-center rounded-t-3xl">
            <div className="w-8 h-8 border-4 border-accent-yellow border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

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
          projectId={projectId}
          onComplete={handleTransformComplete}
          onDismiss={handleTransformDismiss}
        />
      )}

      {/* Error Dialog */}
      <ErrorDialog
        isOpen={errorDialog.isOpen}
        title={errorDialog.title}
        message={errorDialog.message}
        onDismiss={dismissErrorDialog}
      />
    </>
  )
}
