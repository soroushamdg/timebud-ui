import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    // Build the redirect response first so cookies are set directly on it,
    // preserving all original Supabase cookie attributes (maxAge, expires, etc.)
    const response = NextResponse.redirect(`${origin}/`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      try {
        const userResponse = await fetch(`${origin}/api/auth/create-user`, {
          method: 'POST',
          headers: {
            'Cookie': request.headers.get('Cookie') || ''
          }
        })

        if (userResponse.ok) {
          const result = await userResponse.json()
          console.log('OAuth callback user creation:', result.created ? 'success' : 'already exists')
        } else {
          console.error('OAuth callback user creation failed:', await userResponse.text())
        }
      } catch (createError) {
        console.error('Failed to create user after OAuth callback:', createError)
      }

      return response
    }

    console.error('OAuth code exchange failed:', error.message)
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
