import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

/**
 * Stripe Webhook Handler
 * 
 * LOCAL DEVELOPMENT SETUP:
 * 1. Run the dev server: npm run dev
 * 2. In a separate terminal, run: npm run stripe:listen
 * 3. The Stripe CLI will output a webhook signing secret (whsec_xxx)
 * 4. Copy this secret to .env.local as STRIPE_WEBHOOK_SECRET
 * 
 * PRODUCTION SETUP:
 * 1. Create a webhook endpoint in the Stripe Dashboard
 * 2. Point it to: https://yourdomain.com/api/stripe/webhook
 * 3. Copy the webhook signing secret from the dashboard to your production env
 * 
 * The webhook signing secret is DIFFERENT between local (CLI) and production (dashboard).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  console.log('Webhook event:', event.type)

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id

        if (!userId) {
          console.error('No user_id in session metadata')
          break
        }

        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items.data.price.product'],
        })

        const lineItem = fullSession.line_items?.data[0]
        if (!lineItem?.price) {
          console.error('No line items in session')
          break
        }

        const product = lineItem.price.product as Stripe.Product
        const credits = product.metadata.credits || product.metadata.credits_per_month
        
        if (!credits) {
          console.error('No credits metadata on product')
          break
        }

        const creditsAmount = parseInt(credits, 10)
        const isSubscription = session.mode === 'subscription'

        await supabase.rpc('add_credits', {
          p_user_id: userId,
          p_amount: creditsAmount,
          p_action_type: isSubscription ? 'subscription' : 'purchase',
          p_is_free_renewal: false,
          p_stripe_session_id: session.id,
          p_description: `${product.name} purchase`,
        })

        if (isSubscription && session.subscription) {
          await supabase
            .from('stripe_customers')
            .update({
              subscription_id: session.subscription as string,
              subscription_status: 'active',
            })
            .eq('user_id', userId)

          await supabase
            .from('user_credits')
            .update({
              pro_subscriber: true,
              monthly_allowance: creditsAmount,
            })
            .eq('user_id', userId)
        }

        console.log(`Added ${creditsAmount} credits to user ${userId}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: customer } = await supabase
          .from('stripe_customers')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!customer) {
          console.error('Customer not found')
          break
        }

        await supabase
          .from('stripe_customers')
          .update({
            subscription_status: 'canceled',
            subscription_id: null,
          })
          .eq('user_id', customer.user_id)

        await supabase
          .from('user_credits')
          .update({
            pro_subscriber: false,
            monthly_allowance: 300,
          })
          .eq('user_id', customer.user_id)

        console.log(`Subscription canceled for user ${customer.user_id}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        await supabase
          .from('stripe_customers')
          .update({
            subscription_status: subscription.status,
          })
          .eq('stripe_customer_id', customerId)

        console.log(`Subscription updated: ${subscription.status}`)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceWithSub = invoice as any

        if (!invoiceWithSub.subscription) {
          break
        }

        const subscriptionId = typeof invoiceWithSub.subscription === 'string'
          ? invoiceWithSub.subscription
          : invoiceWithSub.subscription?.id

        if (!subscriptionId) {
          break
        }

        const customerId = invoice.customer as string

        const { data: customer } = await supabase
          .from('stripe_customers')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!customer) {
          console.error('Customer not found')
          break
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        const priceId = subscription.items.data[0]?.price.id
        if (!priceId) {
          console.error('No price in subscription')
          break
        }

        const price = await stripe.prices.retrieve(priceId, {
          expand: ['product'],
        })

        const product = price.product as Stripe.Product
        const creditsPerMonth = product.metadata.credits_per_month

        if (!creditsPerMonth) {
          console.error('No credits_per_month metadata')
          break
        }

        const creditsAmount = parseInt(creditsPerMonth, 10)

        await supabase.rpc('add_credits', {
          p_user_id: customer.user_id,
          p_amount: creditsAmount,
          p_action_type: 'renewal',
          p_is_free_renewal: true,
          p_stripe_session_id: null,
          p_description: 'Pro subscription renewal',
        })

        console.log(`Renewed ${creditsAmount} credits for user ${customer.user_id}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    console.error('Webhook handler error:', error)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
