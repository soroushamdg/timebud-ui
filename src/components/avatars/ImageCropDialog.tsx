'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { X } from 'lucide-react'
import { getCroppedAndCompressedImage } from '@/lib/avatars/imageProcessing'
import { Area } from 'react-easy-crop'

interface ImageCropDialogProps {
  imageSrc: string
  onComplete: (croppedBlob: Blob) => void
  onCancel: () => void
  aspectRatio?: number
}

export function ImageCropDialog({
  imageSrc,
  onComplete,
  onCancel,
  aspectRatio = 1,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [compressionProgress, setCompressionProgress] = useState(0)

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCropConfirm = async () => {
    if (!croppedAreaPixels) return

    setIsProcessing(true)
    setCompressionProgress(0)
    try {
      const croppedBlob = await getCroppedAndCompressedImage(
        imageSrc, 
        croppedAreaPixels,
        256, // target size
        500  // max size in KB
      )
      onComplete(croppedBlob)
    } catch (error) {
      console.error('Failed to crop and compress image:', error)
      alert('Failed to process image. Please try again.')
    } finally {
      setIsProcessing(false)
      setCompressionProgress(0)
    }
  }

  return (
    <div className="fixed inset-0 bg-scrim/80 flex items-center justify-center z-[170] p-4">
      <div className="bg-bg-card rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-card">
          <h2 className="text-text-primary font-bold text-lg">Crop Image</h2>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg bg-bg-primary flex items-center justify-center text-text-sec hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Crop Area */}
        <div className="relative w-full h-96 bg-bg-primary">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={true}
            style={{
              containerStyle: {
                backgroundColor: 'var(--color-bg-primary)',
              },
              cropAreaStyle: {
                border: '2px solid var(--color-accent-yellow)',
              },
            }}
          />
        </div>

        {/* Zoom Control */}
        <div className="p-4 border-b border-border-card">
          <label className="text-text-sec text-sm mb-2 block">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-accent-yellow"
          />
        </div>

        {/* Compression Progress */}
        {isProcessing && compressionProgress > 0 && (
          <div className="px-4 py-2 border-b border-border-card">
            <div className="flex items-center justify-between mb-1">
              <span className="text-text-sec text-xs">Compressing image...</span>
              <span className="text-text-sec text-xs">{compressionProgress}%</span>
            </div>
            <div className="w-full bg-bg-primary rounded-full h-1">
              <div 
                className="bg-accent-yellow h-1 rounded-full transition-all duration-200"
                style={{ width: `${compressionProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 p-4">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 bg-bg-primary border border-border-card text-text-primary font-semibold py-3 rounded-2xl hover:bg-opacity-80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCropConfirm}
            disabled={isProcessing}
            className="flex-1 bg-accent-yellow text-on-light-accent font-semibold py-3 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Crop & Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
