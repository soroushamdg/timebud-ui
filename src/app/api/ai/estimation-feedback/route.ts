import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, confirmed } = body

    if (!taskId || typeof confirmed !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'invalid_request',
          message: 'taskId and confirmed (boolean) are required',
        },
      }, { status: 400 })
    }

    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in',
        },
      }, { status: 401 })
    }

    // Update the estimation history record
    const serviceSupabase = createServiceClient()
    const { error } = await serviceSupabase
      .from('task_estimation_history')
      .update({ user_confirmed: confirmed })
      .eq('task_id', taskId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to update estimation feedback:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded',
    })
  } catch (error: any) {
    console.error('Estimation feedback error:', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'server_error',
        message: 'Failed to record feedback',
      },
    }, { status: 500 })
  }
}
