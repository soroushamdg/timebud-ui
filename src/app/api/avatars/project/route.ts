import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { deleteAvatarFromStorage } from '@/lib/avatars/storage'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const serviceClient = createServiceClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, staticPath } = body

    if (!projectId || !staticPath) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!staticPath.startsWith('/project-avatars/')) {
      return NextResponse.json(
        { error: 'Invalid static path' },
        { status: 400 }
      )
    }

    const { error: updateError } = await serviceClient
      .from('projects')
      .update({ project_avatar_url: staticPath })
      .eq('id', projectId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to update project avatar:', updateError)
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      avatarUrl: staticPath,
    })
  } catch (error: any) {
    console.error('Error setting project avatar:', error)
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

    const body = await request.json()
    const { projectId } = body

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId' },
        { status: 400 }
      )
    }

    const { data: projectData } = await serviceClient
      .from('projects')
      .select('project_avatar_url')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectData?.project_avatar_url) {
      if (projectData.project_avatar_url.includes('supabase')) {
        await deleteAvatarFromStorage({
          url: projectData.project_avatar_url,
          bucket: 'project-avatars',
        })
      }
    }

    const { error: updateError } = await serviceClient
      .from('projects')
      .update({ project_avatar_url: null })
      .eq('id', projectId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to remove project avatar:', updateError)
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error removing project avatar:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
