import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { firstName, lastName } = body

    if (!firstName && !lastName) {
      return NextResponse.json(
        { error: 'At least one name field is required' },
        { status: 400 }
      )
    }

    const serviceSupabase = createServiceClient()
    
    const { data: updatedUser, error: updateError } = await serviceSupabase
      .from('users')
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update user profile:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile', details: updateError },
        { status: 500 }
      )
    }

    // Also update Supabase auth metadata
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        first_name: firstName || '',
        last_name: lastName || '',
        full_name: `${firstName || ''} ${lastName || ''}`.trim() || null,
      }
    })

    if (metadataError) {
      console.error('Failed to update auth metadata:', metadataError)
      // Don't fail the request, but log the error
    }

    console.log('Profile updated successfully:', user.id)

    return NextResponse.json({ 
      success: true,
      user: updatedUser
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
