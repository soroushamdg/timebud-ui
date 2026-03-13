import { stripe } from './client'
import { StripePack } from '@/types/credits'

let cachedPacks: StripePack[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function fetchStripePacks(): Promise<StripePack[]> {
  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price'],
  })

  const packs: StripePack[] = []

  for (const product of products.data) {
    const credits = product.metadata.credits || product.metadata.credits_per_month
    
    if (!credits) {
      continue
    }

    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
    })

    for (const price of prices.data) {
      if (!price.unit_amount) continue

      const isSubscription = price.type === 'recurring'
      const creditsAmount = parseInt(credits, 10)

      packs.push({
        productId: product.id,
        priceId: price.id,
        name: product.name,
        credits: creditsAmount,
        amount: price.unit_amount,
        currency: price.currency,
        popular: product.name.toLowerCase().includes('standard'),
        isSubscription,
        interval: price.recurring?.interval as 'month' | 'year' | undefined,
      })
    }
  }

  packs.sort((a, b) => {
    if (a.isSubscription !== b.isSubscription) {
      return a.isSubscription ? 1 : -1
    }
    return a.amount - b.amount
  })

  return packs
}

export async function fetchStripePacksCached(): Promise<StripePack[]> {
  const now = Date.now()
  
  if (cachedPacks && now - cacheTimestamp < CACHE_DURATION) {
    return cachedPacks
  }

  cachedPacks = await fetchStripePacks()
  cacheTimestamp = now
  
  return cachedPacks
}
