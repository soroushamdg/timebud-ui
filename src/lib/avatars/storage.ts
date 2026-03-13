import { createServiceClient } from '@/lib/supabase/server'
import { AVATAR_CONFIG } from './config'

export interface UploadAvatarParams {
  file: Buffer | Uint8Array
  mimeType: string
  userId: string
  bucket: 'profile-avatars' | 'project-avatars'
  entityId: string
}

export async function uploadAvatarToStorage(
  params: UploadAvatarParams
): Promise<string> {
  const { file, mimeType, userId, bucket, entityId } = params
  const supabase = createServiceClient()

  const filename = `${entityId}/${Date.now()}.png`

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, file, {
      contentType: mimeType,
      upsert: true,
    })

  if (error) {
    console.error('Storage upload error:', error)
    throw new Error(`Failed to upload avatar: ${error.message}`)
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename)

  return publicUrlData.publicUrl
}

export interface DeleteAvatarParams {
  url: string
  bucket: 'profile-avatars' | 'project-avatars'
}

export async function deleteAvatarFromStorage(
  params: DeleteAvatarParams
): Promise<void> {
  const { url, bucket } = params
  const supabase = createServiceClient()

  try {
    const urlParts = url.split(`/storage/v1/object/public/${bucket}/`)
    if (urlParts.length < 2) {
      console.warn('Invalid avatar URL format, skipping deletion')
      return
    }

    const filePath = urlParts[1]

    const { error } = await supabase.storage.from(bucket).remove([filePath])

    if (error) {
      console.warn('Failed to delete avatar from storage:', error)
    }
  } catch (error) {
    console.warn('Error deleting avatar:', error)
  }
}
