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
  maxSizeKB: number = AVATAR_CONFIG.targetCompressedSizeKB
): Promise<Blob> {
  const maxSizeBytes = maxSizeKB * 1024

  if (blob.size <= maxSizeBytes) {
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
        const tryCompress = () => {
          canvas.toBlob(
            (compressedBlob) => {
              if (!compressedBlob) {
                reject(new Error('Failed to compress image'))
                return
              }

              if (compressedBlob.size <= maxSizeBytes || quality <= 0.5) {
                resolve(compressedBlob)
              } else {
                quality -= 0.1
                tryCompress()
              }
            },
            'image/png',
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
  const validTypes = ['image/jpeg', 'image/png', 'image/webp']
  
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Please upload a JPEG, PNG, or WebP image',
    }
  }

  const maxSizeMB = AVATAR_CONFIG.maxFileSizeMB
  const maxSizeBytes = maxSizeMB * 1024 * 1024

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `Image must be smaller than ${maxSizeMB}MB`,
    }
  }

  return { valid: true }
}

export function createImagePreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}

export function revokeImagePreviewUrl(url: string): void {
  URL.revokeObjectURL(url)
}
