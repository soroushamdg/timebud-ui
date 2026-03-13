import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { priceId, mode } = body

    if (!priceId || !mode) {
      return NextResponse.json(
        { error: 'Missing priceId or mode' },
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
    const stripeCustomerId = await getOrCreateStripeCustomer(
      user.id,
      user.email!,
      serviceSupabase
    )

    const sessionParams: any = {
      customer: stripeCustomerId,
      mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/credits?cancelled=true`,
      metadata: {
        user_id: user.id,
      },
      allow_promotion_codes: true,
    }

    if (mode === 'subscription') {
      sessionParams.subscription_data = {
        metadata: {
          user_id: user.id,
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
