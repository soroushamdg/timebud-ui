import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Ensure user is created in database after OAuth callback
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
      
      // Get all cookies that were set during the auth exchange
      const cookieStore = await cookies()
      const allCookies = cookieStore.getAll()
      
      // Create redirect response and copy all cookies
      const redirectUrl = `${origin}/`
      const response = NextResponse.redirect(redirectUrl)
      
      // Copy all cookies to the response
      allCookies.forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, {
          // Ensure cookies are properly set for the redirect
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          path: '/',
        })
      })
      
      return response
    }
  }
  
  // Return the user to an error page with some context
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
