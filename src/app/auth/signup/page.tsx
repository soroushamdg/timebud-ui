'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AppShell } from '@/components/layout/AppShell'
import { useLoading } from '@/contexts/LoadingContext'

export default function SignupPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { setLoadingComplete } = useLoading()

  useEffect(() => {
    setLoadingComplete()
  }, [setLoadingComplete])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      })

      if (error) throw error
      
      // If email confirmation is disabled, user should be created immediately
      if (!error) {
        try {
          const userResponse = await fetch('/api/auth/create-user', { method: 'POST' })
          if (userResponse.ok) {
            const result = await userResponse.json()
            console.log('Post-signup user creation:', result.created ? 'success' : 'already exists')
          } else {
            console.error('Post-signup user creation failed:', await userResponse.text())
          }
        } catch (createError) {
          console.error('Failed to ensure user exists after signup:', createError)
        }
      }
      
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AppShell showTabBar={false}>
      <div className="flex flex-col h-[calc(100vh-5rem)] overflow-y-auto bg-black items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bud/bud-avatar.png" alt="Bud" className="w-16 h-16 rounded-full border-2 border-accent-yellow mb-3 mx-auto object-cover" />
            <h1 className="text-accent-yellow text-3xl font-bold">TimeBud</h1>
            <h2 className="text-white text-2xl font-bold mt-4">Check your email</h2>
          </div>
          
          <div className="text-text-sec mb-8">
            We've sent you a confirmation link. Please check your email and click the link to verify your account.
          </div>
          
          <div className="text-text-sec">
            Already verified?{' '}
            <Link href="/auth/login" className="text-accent-yellow hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
      </AppShell>
    )
  }

  return (
    <AppShell showTabBar={false}>
    <div className="flex flex-col h-[calc(100vh-5rem)] overflow-y-auto bg-black items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="flex flex-col items-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bud/bud-avatar.png" alt="Bud" className="w-16 h-16 rounded-full border-2 border-accent-yellow mb-3 object-cover" />
          <h1 className="text-accent-yellow text-3xl font-bold">TimeBud</h1>
          <span className="text-text-sec text-[11px] font-bold tracking-[0.14em] uppercase mt-0.5">Missions</span>
        </div>

        {/* Welcome message */}
        <div className="text-center mb-8">
          <h2 className="text-white text-2xl font-bold">Start your first mission</h2>
          <p className="text-text-sec text-sm mt-1">Bud&apos;s ready when you are.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          {/* Name inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full bg-bg-card border border-border-card rounded-2xl px-4 py-3 text-white placeholder:text-text-sec focus:outline-none focus:ring-2 focus:ring-accent-yellow"
                required
              />
            </div>
            <div>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full bg-bg-card border border-border-card rounded-2xl px-4 py-3 text-white placeholder:text-text-sec focus:outline-none focus:ring-2 focus:ring-accent-yellow"
                required
              />
            </div>
          </div>

          {/* Email input */}
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-bg-card border border-border-card rounded-2xl px-4 py-3 text-white placeholder:text-text-sec focus:outline-none focus:ring-2 focus:ring-accent-yellow"
              required
            />
          </div>

          {/* Password input */}
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-bg-card border border-border-card rounded-2xl px-4 py-3 text-white placeholder:text-text-sec focus:outline-none focus:ring-2 focus:ring-accent-yellow"
              required
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="text-accent-pink text-sm text-center">
              {error}
            </div>
          )}

          {/* Sign Up button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent-yellow text-black font-bold text-lg rounded-2xl h-14 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              'Sign Up'
            )}
          </button>
        </form>

        {/* Sign in link */}
        <div className="text-center mt-8 text-text-sec">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-accent-yellow hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
    </AppShell>
  )
}
