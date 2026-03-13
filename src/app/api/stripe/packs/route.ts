import { NextResponse } from 'next/server'
import { fetchStripePacksCached } from '@/lib/stripe/products'

export async function GET() {
  try {
    const packs = await fetchStripePacksCached()
    return NextResponse.json(packs)
  } catch (error) {
    console.error('Failed to fetch Stripe packs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pricing' },
      { status: 500 }
    )
  }
}
