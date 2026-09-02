'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { AppShell } from '@/components/layout/AppShell'

function ErrorContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')

  return (
    <AppShell showTabBar={false}>
    <div className="flex flex-col h-[calc(100vh-5rem)] overflow-y-auto bg-black items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-accent-yellow text-3xl font-bold mb-2">TimeBud</h1>
        <h2 className="text-white text-2xl font-bold mb-4">Sign-in failed</h2>
        <p className="text-text-sec mb-2">
          Something went wrong during Google sign-in. Please try again.
        </p>
        {reason && (
          <p className="text-text-sec text-sm mb-6 font-mono bg-bg-card border border-border-card rounded-xl px-3 py-2">
            {reason}
          </p>
        )}
        <Link
          href="/auth/login"
          className="inline-block bg-accent-yellow text-black font-bold text-base rounded-2xl px-8 py-3 hover:opacity-90 transition-opacity"
        >
          Back to Login
        </Link>
      </div>
    </div>
    </AppShell>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  )
}
