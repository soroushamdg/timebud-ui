'use client'

import { useState, useRef } from 'react'
import { X, Camera, Upload } from 'lucide-react'
import { PencilIcon } from '@heroicons/react/24/outline'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { ImageCropDialog } from './ImageCropDialog'
import { useUploadProfileImage, useRemoveProfileImage } from '@/hooks/useProfileImage'
import { validateImageFile, createImagePreviewUrl, revokeImagePreviewUrl } from '@/lib/avatars/imageProcessing'

interface ProfileAvatarEditorProps {
  userId: string
  firstName: string
  lastName: string
  currentImageUrl?: string | null
  isOpen: boolean
  onClose: () => void
}

export function ProfileAvatarEditor({
  userId,
  firstName,
  lastName,
  currentImageUrl,
  isOpen,
  onClose,
}: ProfileAvatarEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null)
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const uploadImage = useUploadProfileImage()
  const removeImage = useRemoveProfileImage()

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
      }
    }
    input.click()
  }

  const handleLibrarySelect = () => {
    fileInputRef.current?.click()
  }

  const handleCropComplete = async (blob: Blob) => {
    setCroppedBlob(blob)
    setShowCropDialog(false)

    const previewBlobUrl = URL.createObjectURL(blob)
    setLocalPreview(previewBlobUrl)

    try {
      const file = new File([blob], 'avatar.png', { type: 'image/png' })
      await uploadImage.mutateAsync(file)
      
      if (previewUrl) {
        revokeImagePreviewUrl(previewUrl)
      }
      setSelectedFile(null)
      setPreviewUrl(null)
      setCroppedBlob(null)
      setLocalPreview(null)
      onClose()
    } catch (error) {
      console.error('Failed to upload profile image:', error)
      alert('Failed to upload image. Please try again.')
      setLocalPreview(null)
    }
  }

  const handleCropCancel = () => {
    if (previewUrl) {
      revokeImagePreviewUrl(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setShowCropDialog(false)
  }

  const handleRemove = async () => {
    if (!confirm('Remove your profile picture?')) return

    try {
      await removeImage.mutateAsync()
      onClose()
    } catch (error) {
      console.error('Failed to remove profile image:', error)
      alert('Failed to remove image. Please try again.')
    }
  }

  if (!isOpen) return null

  const displayImageUrl = localPreview || currentImageUrl
  const fallbackSeed = `${firstName}${lastName}`

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-bg-card rounded-2xl w-full max-w-sm">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border-card">
            <h2 className="text-white font-bold text-lg">Profile Picture</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-bg-primary flex items-center justify-center text-text-sec hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Avatar Display */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <AvatarImage
                  src={displayImageUrl}
                  fallbackType="profile"
                  fallbackSeed={fallbackSeed}
                  size={96}
                />
                {uploadImage.isPending && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-3">
                {!currentImageUrl ? (
                  <div className="flex gap-3">
                    <button
                      onClick={handleCameraSelect}
                      disabled={uploadImage.isPending}
                      className="flex-1 flex items-center justify-center gap-2 bg-accent-yellow text-black text-sm font-medium py-2 rounded-xl hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      <Camera size={16} />
                      <span>Take Photo</span>
                    </button>
                    <button
                      onClick={handleLibrarySelect}
                      disabled={uploadImage.isPending}
                      className="flex-1 flex items-center justify-center gap-2 bg-bg-card border border-border-card text-white text-sm font-medium py-2 rounded-xl hover:bg-opacity-80 transition-opacity disabled:opacity-50"
                    >
                      <Upload size={16} />
                      <span>Library</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3">
                      <button
                        onClick={handleCameraSelect}
                        disabled={uploadImage.isPending}
                        className="flex-1 flex items-center justify-center gap-2 text-accent-yellow text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                      >
                        <Camera size={16} />
                        <span>Camera</span>
                      </button>
                      <button
                        onClick={handleLibrarySelect}
                        disabled={uploadImage.isPending}
                        className="flex-1 flex items-center justify-center gap-2 text-accent-yellow text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                      >
                        <Upload size={16} />
                        <span>Library</span>
                      </button>
                    </div>
                    <button
                      onClick={handleRemove}
                      disabled={removeImage.isPending || uploadImage.isPending}
                      className="w-full flex items-center justify-center gap-2 text-accent-pink text-sm font-medium py-2 hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      <X size={16} />
                      <span>{removeImage.isPending ? 'Removing...' : 'Remove'}</span>
                    </button>
                  </>
                )}
              </div>

              {uploadImage.error && (
                <p className="text-accent-pink text-xs text-center">
                  {uploadImage.error.message}
                </p>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Crop Dialog */}
      {showCropDialog && previewUrl && (
        <ImageCropDialog
          imageSrc={previewUrl}
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </>
  )
}
