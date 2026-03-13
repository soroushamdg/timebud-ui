import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
      
      return NextResponse.redirect(`${origin}/`)
    }
  }
  
  // Return the user to an error page with some context
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
