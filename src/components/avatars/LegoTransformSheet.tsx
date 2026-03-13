'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useCredits } from '@/hooks/useCredits'
import { createClient } from '@/lib/supabase/client'
import { uploadAvatarToStorage } from '@/lib/avatars/storage'

interface LegoTransformSheetProps {
  file: Blob
  previewUrl: string
  projectId: string
  onComplete: (avatarUrl: string) => void
  onDismiss: () => void
}

export function LegoTransformSheet({
  file,
  previewUrl,
  projectId,
  onComplete,
  onDismiss,
}: LegoTransformSheetProps) {
  const [isTransforming, setIsTransforming] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: credits } = useCredits()

  const totalCredits = (credits?.free_credits || 0) + (credits?.purchased_credits || 0)
  const hasEnoughCredits = totalCredits >= 15

  const handleApplyTheme = async () => {
    setIsTransforming(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', file, 'avatar.png')
      formData.append('projectId', projectId)

      const response = await fetch('/api/avatars/transform', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.error === 'insufficient_credits') {
        setError('Not enough credits. You need 15 credits for this feature.')
        setIsTransforming(false)
        return
      }

      if (data.error === 'transformation_failed') {
        setError('Transformation failed. Uploading original image instead...')
        await handleKeepOriginal()
        return
      }

      if (data.success && data.avatarUrl) {
        onComplete(data.avatarUrl)
      } else {
        throw new Error('Unexpected response from server')
      }
    } catch (error: any) {
      console.error('Transform error:', error)
      setError('Failed to transform image. Uploading original instead...')
      await handleKeepOriginal()
    } finally {
      setIsTransforming(false)
    }
  }

  const handleKeepOriginal = async () => {
    setIsUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('Not authenticated')
      }

      const filename = `${user.id}/${projectId}-${Date.now()}.png`
      
      const { error: uploadError } = await supabase.storage
        .from('project-avatars')
        .upload(filename, file, {
          contentType: 'image/png',
          upsert: true,
        })

      if (uploadError) {
        throw uploadError
      }

      const { data: urlData } = supabase.storage
        .from('project-avatars')
        .getPublicUrl(filename)

      const publicUrl = urlData.publicUrl

      const { error: updateError } = await supabase
        .from('projects')
        .update({ project_avatar_url: publicUrl })
        .eq('id', projectId)
        .eq('user_id', user.id)

      if (updateError) {
        throw updateError
      }

      onComplete(publicUrl)
    } catch (error: any) {
      console.error('Upload error:', error)
      setError('Failed to upload image. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onDismiss} />
      
      <div className="fixed bottom-0 left-0 right-0 bg-bg-card rounded-t-3xl z-50 max-h-[55vh] overflow-y-auto">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-border-card rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 py-4">
          <h2 className="text-white font-bold text-xl text-center">Use this photo?</h2>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Image Preview */}
          <div className="flex justify-center">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-40 h-40 rounded-2xl object-cover"
            />
          </div>

          {/* Credit Notice */}
          <div className="flex items-center justify-center gap-2 text-text-sec text-sm">
            <Sparkles size={16} className="text-accent-yellow" />
            <span>Apply TimeBud Theme uses 15 credits</span>
          </div>

          {/* Credit Balance */}
          <div className="text-center">
            <span
              className={`text-xs ${
                hasEnoughCredits ? 'text-text-sec' : 'text-accent-pink'
              }`}
            >
              You have {totalCredits} credits
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-accent-pink bg-opacity-10 border border-accent-pink rounded-xl px-4 py-3">
              <p className="text-accent-pink text-sm text-center">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleApplyTheme}
              disabled={!hasEnoughCredits || isTransforming || isUploading}
              className="w-full bg-accent-yellow text-black font-bold py-4 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isTransforming ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Transforming...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Apply TimeBud Theme</span>
                </>
              )}
            </button>

            <button
              onClick={handleKeepOriginal}
              disabled={isTransforming || isUploading}
              className="w-full bg-bg-card border border-border-card text-white font-bold py-4 rounded-2xl hover:bg-opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Uploading...</span>
                </div>
              ) : (
                'Keep Original'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
