'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { ChevronLeft, Sparkles, AlertCircle, Check } from 'lucide-react'
import { useTotalCredits } from '@/hooks/useCredits'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { StripePack } from '@/types/credits'

function CreditsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { total, free, purchased, isLow, renewalDate, proSubscriber, monthlyAllowance, isLoading } = useTotalCredits()
  const [buyingPriceId, setBuyingPriceId] = useState<string | null>(null)
  const [creatingPortalSession, setCreatingPortalSession] = useState(false)

  const success = searchParams.get('success') === 'true'
  const cancelled = searchParams.get('cancelled') === 'true'
  const portalReturn = searchParams.get('portal_return') === 'true'

  const { data: packs = [], isLoading: packsLoading } = useQuery({
    queryKey: ['stripe-packs'],
    queryFn: async (): Promise<StripePack[]> => {
      const response = await fetch('/api/stripe/packs')
      if (!response.ok) throw new Error('Failed to fetch packs')
      return response.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (success || portalReturn) {
      queryClient.invalidateQueries({ queryKey: ['credits'] })
    }
  }, [success, portalReturn, queryClient])

  const handleBuyPack = async (priceId: string, isSubscription: boolean) => {
    setBuyingPriceId(priceId)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          mode: isSubscription ? 'subscription' : 'payment',
        }),
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
      setBuyingPriceId(null)
    }
  }

  const handleManageSubscription = async () => {
    setCreatingPortalSession(true)
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Portal session error:', error)
      setCreatingPortalSession(false)
    }
  }

  const oneTimePacks = packs.filter(p => !p.isSubscription)
  const proPack = packs.find(p => p.isSubscription)

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-card">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-xl bg-bg-card border border-border-card flex items-center justify-center text-white hover:bg-opacity-80 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-white font-bold text-xl">Credits & Billing</h1>
        <div className="w-10" />
      </div>

      <div className="p-4 space-y-4">
        {/* Success banner */}
        {success && (
          <div className="bg-accent-green/10 border border-accent-green/30 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-accent-green flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-accent-green font-medium">Payment successful!</p>
              <p className="text-accent-green/80 text-sm">Credits added to your account.</p>
            </div>
          </div>
        )}

        {/* Cancelled banner */}
        {cancelled && (
          <div className="bg-text-sec/10 border border-text-sec/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-text-sec flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-text-sec font-medium">Purchase cancelled</p>
              <p className="text-text-sec/80 text-sm">No charge was made.</p>
            </div>
          </div>
        )}

        {/* Portal return banner */}
        {portalReturn && (
          <div className="bg-accent-green/10 border border-accent-green/30 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-accent-green flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-accent-green font-medium">Subscription updated!</p>
              <p className="text-accent-green/80 text-sm">Your changes have been saved.</p>
            </div>
          </div>
        )}

        {/* Balance card */}
        <div className="bg-bg-card border border-border-card rounded-lg p-6">
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-12 bg-border-card rounded w-32 mb-3"></div>
              <div className="h-4 bg-border-card rounded w-48 mb-2"></div>
              <div className="h-4 bg-border-card rounded w-40"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl font-bold text-white">{total.toLocaleString()}</div>
                {proSubscriber && (
                  <div className="bg-accent-yellow text-black text-xs font-bold px-2 py-1 rounded">
                    PRO
                  </div>
                )}
              </div>
              <div className="text-text-sec text-sm mb-2">
                {free.toLocaleString()} free · {purchased.toLocaleString()} purchased
              </div>
              <div className="text-text-sec text-sm">
                Free credits renew {renewalDate}
              </div>
            </>
          )}
        </div>

        {/* Low credit warning */}
        {isLow && !isLoading && (
          <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-accent-yellow flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-accent-yellow font-medium">Running low on credits</p>
              <p className="text-accent-yellow/80 text-sm">Top up to keep using AI features</p>
            </div>
          </div>
        )}

        {/* One-time credit packs */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">Top up credits</h2>
          
          {packsLoading ? (
            <div className="grid grid-cols-1 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-bg-card border border-border-card rounded-lg p-4 animate-pulse">
                  <div className="h-5 bg-border-card rounded w-24 mb-2"></div>
                  <div className="h-8 bg-border-card rounded w-32 mb-2"></div>
                  <div className="h-10 bg-border-card rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {oneTimePacks.map(pack => (
                <div
                  key={pack.priceId}
                  className={`bg-bg-card border-2 ${
                    pack.popular ? 'border-accent-yellow' : 'border-border-card'
                  } rounded-lg p-4 relative`}
                >
                  {pack.popular && (
                    <div className="absolute -top-2 left-4 bg-accent-yellow text-black text-xs font-bold px-2 py-0.5 rounded">
                      MOST POPULAR
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-white font-bold">{pack.name}</h3>
                      <div className="text-2xl font-bold text-accent-yellow">
                        {pack.credits.toLocaleString()} <span className="text-sm text-text-sec">credits</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        ${(pack.amount / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleBuyPack(pack.priceId, false)}
                    disabled={buyingPriceId === pack.priceId}
                    className="w-full bg-accent-yellow text-black font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {buyingPriceId === pack.priceId ? 'Processing...' : 'Buy Now'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pro subscription */}
        {proPack && (
          <div>
            <h2 className="text-white font-bold text-lg mb-3">Pro Subscription</h2>
            
            {proSubscriber ? (
              <div className="bg-bg-card border-2 border-accent-yellow rounded-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-6 h-6 text-accent-yellow" />
                  <h3 className="text-white font-bold text-xl">You're on Pro ✓</h3>
                </div>
                <p className="text-text-sec mb-2">
                  {monthlyAllowance?.toLocaleString()} credits per month
                </p>
                <p className="text-text-sec text-sm mb-4">
                  Your subscription renews automatically
                </p>
                <button
                  onClick={handleManageSubscription}
                  disabled={creatingPortalSession}
                  className="w-full bg-bg-card-hover border border-border-card text-white font-semibold py-3 rounded-lg hover:bg-opacity-80 transition-opacity disabled:opacity-50"
                >
                  {creatingPortalSession ? 'Loading...' : 'Manage Subscription'}
                </button>
              </div>
            ) : (
              <div className="bg-bg-card border-2 border-accent-yellow rounded-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-6 h-6 text-accent-yellow" />
                  <h3 className="text-white font-bold text-xl">{proPack.name}</h3>
                </div>
                <div className="mb-4">
                  <div className="text-3xl font-bold text-white mb-1">
                    ${(proPack.amount / 100).toFixed(2)}
                    <span className="text-lg text-text-sec">/{proPack.interval}</span>
                  </div>
                  <div className="text-accent-yellow font-semibold">
                    {proPack.credits.toLocaleString()} credits per month
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-text-sec">
                    <Check className="w-4 h-4 text-accent-green" />
                    5× monthly credits
                  </li>
                  <li className="flex items-center gap-2 text-text-sec">
                    <Check className="w-4 h-4 text-accent-green" />
                    Auto-renews monthly
                  </li>
                  <li className="flex items-center gap-2 text-text-sec">
                    <Check className="w-4 h-4 text-accent-green" />
                    Priority AI access
                  </li>
                </ul>
                <button
                  onClick={() => handleBuyPack(proPack.priceId, true)}
                  disabled={buyingPriceId === proPack.priceId}
                  className="w-full bg-accent-yellow text-black font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {buyingPriceId === proPack.priceId ? 'Processing...' : 'Upgrade to Pro'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* How credits work */}
        <details className="bg-bg-card border border-border-card rounded-lg">
          <summary className="p-4 cursor-pointer text-white font-medium hover:bg-bg-card-hover transition-colors">
            How credits work
          </summary>
          <div className="px-4 pb-4 text-text-sec text-sm space-y-2">
            <p>
              <strong className="text-white">Free credits:</strong> You get {monthlyAllowance || 300} free credits every month. 
              These reset monthly and don't roll over.
            </p>
            <p>
              <strong className="text-white">Purchased credits:</strong> Credits you buy never expire and are used 
              after your free credits run out.
            </p>
            <p>
              <strong className="text-white">Credit costs:</strong> Standard AI messages cost 20 credits, 
              thinking mode costs 60 credits, and file analysis costs 25 credits per file.
            </p>
          </div>
        </details>
      </div>
    </div>
  )
}

export default function CreditsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <CreditsContent />
    </Suspense>
  )
}
