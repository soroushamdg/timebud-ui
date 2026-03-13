import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { uploadAvatarToStorage, deleteAvatarFromStorage } from '@/lib/avatars/storage'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const serviceClient = createServiceClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      )
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload JPEG, PNG, or WebP' },
        { status: 400 }
      )
    }

    const maxSize = 2 * 1024 * 1024
    if (imageFile.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 2MB' },
        { status: 400 }
      )
    }

    const { data: userData } = await serviceClient
      .from('users')
      .select('profile_image_url')
      .eq('id', user.id)
      .single()

    if (userData?.profile_image_url) {
      await deleteAvatarFromStorage({
        url: userData.profile_image_url,
        bucket: 'profile-avatars',
      })
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer())

    const publicUrl = await uploadAvatarToStorage({
      file: imageBuffer,
      mimeType: imageFile.type,
      userId: user.id,
      bucket: 'profile-avatars',
      entityId: user.id,
    })

    const { error: updateError } = await serviceClient
      .from('users')
      .update({ profile_image_url: publicUrl })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to update user profile image:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      profileImageUrl: publicUrl,
    })
  } catch (error: any) {
    console.error('Error uploading profile image:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const serviceClient = createServiceClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await serviceClient
      .from('users')
      .select('profile_image_url')
      .eq('id', user.id)
      .single()

    if (userData?.profile_image_url) {
      await deleteAvatarFromStorage({
        url: userData.profile_image_url,
        bucket: 'profile-avatars',
      })
    }

    const { error: updateError } = await serviceClient
      .from('users')
      .update({ profile_image_url: null })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to remove profile image:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error removing profile image:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
