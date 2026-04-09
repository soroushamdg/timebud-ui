import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { planSessionFromAI } from '@/lib/ai/session-planner'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { budgetMinutes, pinnedTaskIds, excludedTaskIds } = body

    if (!budgetMinutes || typeof budgetMinutes !== 'number') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'invalid_request',
          message: 'budgetMinutes is required and must be a number',
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
          message: 'You must be logged in to plan a session',
        },
      }, { status: 401 })
    }

    // Plan the session
    const sessionPlan = await planSessionFromAI(
      user.id,
      {
        budgetMinutes,
        pinnedTaskIds: pinnedTaskIds || [],
        excludedTaskIds: excludedTaskIds || [],
      },
      supabase
    )

    return NextResponse.json({
      success: true,
      sessionPlan,
    })
  } catch (error: any) {
    console.error('Plan session error:', error)
    
    if (error.message.includes('Insufficient credits')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'insufficient_credits',
          message: 'Not enough credits to plan session (requires 5 credits)',
        },
      }, { status: 200 })
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'server_error',
        message: 'Failed to plan session',
      },
    }, { status: 500 })
  }
}
