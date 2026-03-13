import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const serviceSupabase = createServiceClient()
    
    const { data: credits } = await serviceSupabase
      .from('user_credits')
      .select('free_renewal_at, monthly_allowance')
      .eq('user_id', user.id)
      .single()

    if (!credits) {
      return NextResponse.json({ renewed: false })
    }

    const renewalDate = new Date(credits.free_renewal_at)
    const now = new Date()

    if (renewalDate > now) {
      return NextResponse.json({ renewed: false })
    }

    await serviceSupabase.rpc('add_credits', {
      p_user_id: user.id,
      p_amount: credits.monthly_allowance,
      p_action_type: 'renewal',
      p_is_free_renewal: true,
      p_stripe_session_id: null,
      p_description: 'Monthly free credit renewal',
    })

    return NextResponse.json({
      renewed: true,
      new_free_credits: credits.monthly_allowance,
    })
  } catch (error) {
    console.error('Renewal error:', error)
    return NextResponse.json(
      { error: 'Failed to renew credits' },
      { status: 500 }
    )
  }
}
