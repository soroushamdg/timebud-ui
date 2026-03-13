import { stripe } from './client'
import { SupabaseClient } from '@supabase/supabase-js'

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  supabase: SupabaseClient
): Promise<string> {
  const { data: existing } = await supabase
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id
  }

  const customer = await stripe.customers.create({
    email,
    metadata: {
      user_id: userId,
    },
  })

  await supabase
    .from('stripe_customers')
    .insert({
      user_id: userId,
      stripe_customer_id: customer.id,
    })

  return customer.id
}
