'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLoading } from '@/contexts/LoadingContext'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { setLoadingComplete } = useLoading()

  useEffect(() => {
    setLoadingComplete()
  }, [setLoadingComplete])

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      
      router.push('/')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="text-center mb-2">
          <h1 className="text-accent-yellow text-3xl font-bold">TimeBud</h1>
        </div>

        {/* Welcome message */}
        <div className="text-center mb-8">
          <h2 className="text-white text-2xl font-bold">Welcome back</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleEmailSignIn} className="space-y-4">
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

          {/* Sign In button */}
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
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-border-card"></div>
          <span className="px-4 text-text-sec text-sm">or</span>
          <div className="flex-1 h-px bg-border-card"></div>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-bg-card border border-border-card text-white rounded-2xl h-14 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-card/80 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Sign up link */}
        <div className="text-center mt-8 text-text-sec">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-accent-yellow hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}
