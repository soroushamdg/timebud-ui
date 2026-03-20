import { AVATAR_CONFIG } from './config'

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export async function getCroppedImage(
  imageSrc: string,
  cropArea: CropArea,
  targetSize: number = AVATAR_CONFIG.size
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      canvas.width = targetSize
      canvas.height = targetSize

      ctx.drawImage(
        image,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        targetSize,
        targetSize
      )

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create blob from canvas'))
          }
        },
        'image/png',
        0.95
      )
    }
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = imageSrc
  })
}

export async function getCroppedAndCompressedImage(
  imageSrc: string,
  cropArea: CropArea,
  targetSize: number = AVATAR_CONFIG.size,
  maxSizeKB: number = AVATAR_CONFIG.targetCompressedSizeKB
): Promise<Blob> {
  // First crop the image
  const croppedBlob = await getCroppedImage(imageSrc, cropArea, targetSize)
  
  // Then compress if needed
  return await compressImage(croppedBlob, maxSizeKB)
}

export async function resizeImage(
  file: File,
  targetSize: number = AVATAR_CONFIG.size
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        canvas.width = targetSize
        canvas.height = targetSize

        ctx.drawImage(img, 0, 0, targetSize, targetSize)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to create blob'))
            }
          },
          'image/png',
          0.95
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function compressImage(
  blob: Blob,
  maxSizeKB: number = AVATAR_CONFIG.targetCompressedSizeKB,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const maxSizeBytes = maxSizeKB * 1024

  if (blob.size <= maxSizeBytes) {
    onProgress?.(100)
    return blob
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        let quality = 0.9
        let attempts = 0
        const maxAttempts = 9

        const tryCompress = () => {
          attempts++
          onProgress?.(Math.min(attempts * 10, 90))

          canvas.toBlob(
            (compressedBlob) => {
              if (!compressedBlob) {
                reject(new Error('Failed to compress image'))
                return
              }

              if (compressedBlob.size <= maxSizeBytes || quality <= 0.1 || attempts >= maxAttempts) {
                onProgress?.(100)
                resolve(compressedBlob)
              } else {
                quality -= 0.1
                tryCompress()
              }
            },
            'image/jpeg',
            quality
          )
        }

        tryCompress()
      }
      img.onerror = () => reject(new Error('Failed to load image for compression'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read blob'))
    reader.readAsDataURL(blob)
  })
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // More permissive MIME types for mobile cameras
  const validTypes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/webp',
    'image/heic', // iOS format
    'image/heif', // iOS format
  ]
  
  console.log('Validating file:', file.name, file.type, file.size)
  
  if (!validTypes.includes(file.type)) {
    // Try to detect image type from file extension if MIME type is missing or generic
    const extension = file.name.toLowerCase().split('.').pop()
    const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
    
    if (!extension || !validExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Unsupported file type: ${file.type}. Please upload JPEG, PNG, WebP, HEIC, or HEIF image.`,
      }
    }
  }

  const maxSizeMB = AVATAR_CONFIG.maxFileSizeMB
  const maxSizeBytes = maxSizeMB * 1024 * 1024

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `Image must be smaller than ${maxSizeMB}MB (current: ${(file.size / 1024 / 1024).toFixed(1)}MB)`,
    }
  }

  console.log('File validation passed')
  return { valid: true }
}

export function createImagePreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}

export function revokeImagePreviewUrl(url: string): void {
  URL.revokeObjectURL(url)
}
