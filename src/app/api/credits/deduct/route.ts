import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { ActionType } from '@/types/credits'
import { deductCreditsForAction } from '@/lib/credits/deduct'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { actionType, description } = body as {
      actionType: ActionType
      description?: string
    }

    if (!actionType) {
      return NextResponse.json(
        { error: 'Missing actionType' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const serviceSupabase = createServiceClient()
    const result = await deductCreditsForAction({
      userId: user.id,
      actionType,
      description,
      supabase: serviceSupabase,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'insufficient_credits',
          balance: result.balance,
          reason: result.reason,
        },
        { status: 200 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Deduct credits error:', error)
    return NextResponse.json(
      { error: 'Failed to deduct credits' },
      { status: 500 }
    )
  }
}
