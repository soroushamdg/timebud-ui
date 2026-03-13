'use client'

import { useState, useRef } from 'react'
import { X, Upload, Camera } from 'lucide-react'
import { useStaticAvatars, useSetProjectAvatar, useRemoveProjectAvatar } from '@/hooks/useProjectAvatar'
import { AvatarImage } from '@/components/ui/AvatarImage'
import { ImageCropDialog } from './ImageCropDialog'
import { LegoTransformSheet } from './LegoTransformSheet'
import { validateImageFile, createImagePreviewUrl, revokeImagePreviewUrl } from '@/lib/avatars/imageProcessing'

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

  const { data: avatars = [], isLoading } = useStaticAvatars()
  const setAvatar = useSetProjectAvatar()
  const removeAvatar = useRemoveProjectAvatar()

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
      onAvatarChanged(path)
      onClose()
    } catch (error) {
      console.error('Failed to set avatar:', error)
      alert('Failed to set avatar. Please try again.')
    }
  }

  const handleRemoveConfirm = async () => {
    try {
      await removeAvatar.mutateAsync(projectId)
      onAvatarChanged(null)
      onClose()
    } catch (error) {
      console.error('Failed to remove avatar:', error)
      alert('Failed to remove avatar. Please try again.')
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      
      <div className="fixed bottom-0 left-0 right-0 bg-bg-card rounded-t-3xl z-50 max-h-[70vh] overflow-y-auto">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-border-card rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-card">
          <h2 className="text-white font-bold text-xl">Project Avatar</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-bg-primary flex items-center justify-center text-text-sec hover:text-white transition-colors"
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
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-20 bg-bg-card border-2 border-dashed border-border-card rounded-2xl flex items-center justify-center gap-3 hover:border-accent-yellow transition-colors"
            >
              <Camera size={24} className="text-accent-yellow" />
              <span className="text-white font-medium">Upload photo</span>
            </button>
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
                      currentAvatarUrl === avatar.path
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
                      className="flex-1 bg-bg-primary border border-border-card text-white font-medium py-2 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRemoveConfirm}
                      disabled={removeAvatar.isPending}
                      className="flex-1 bg-accent-pink text-white font-medium py-2 rounded-xl disabled:opacity-50"
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
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-3xl">
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
    </>
  )
}
