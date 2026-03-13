import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const serviceSupabase = createServiceClient()
    
    // Check if user already has credits
    const { data: existingCredits } = await serviceSupabase
      .from('user_credits')
      .select('user_id')
      .eq('user_id', user.id)
      .single()

    if (existingCredits) {
      return NextResponse.json({ initialized: false, message: 'User already has credits' })
    }

    // First ensure user record exists
    const { data: existingUser } = await serviceSupabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingUser) {
      console.log('User record not found, creating user first...')
      // Create user record first
      let firstName = user.user_metadata?.first_name || ''
      let lastName = user.user_metadata?.last_name || ''
      
      // Extract name from Google OAuth if not in metadata
      if (!firstName && !lastName && user.user_metadata?.name) {
        const fullName = user.user_metadata.name
        const nameParts = fullName.split(' ')
        firstName = nameParts[0] || ''
        lastName = nameParts.slice(1).join(' ') || ''
      }
      
      // Also try to extract from identity provider data
      if (!firstName && !lastName && user.identities) {
        const googleIdentity = user.identities.find(id => id.provider === 'google')
        if (googleIdentity?.identity_data?.name) {
          const fullName = googleIdentity.identity_data.name
          const nameParts = fullName.split(' ')
          firstName = nameParts[0] || ''
          lastName = nameParts.slice(1).join(' ') || ''
        }
      }

      const { error: userCreateError } = await serviceSupabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email || '',
          first_name: firstName,
          last_name: lastName,
        })

      if (userCreateError) {
        console.error('Failed to create user record for credits:', userCreateError)
        return NextResponse.json(
          { error: 'Failed to create user record', details: userCreateError },
          { status: 500 }
        )
      }

      console.log('User record created successfully for credits initialization')
    }

    // Initialize new user with default credits
    const renewalDate = new Date()
    renewalDate.setDate(renewalDate.getDate() + 30)

    const { data: newCredits, error: insertError } = await serviceSupabase
      .from('user_credits')
      .insert({
        user_id: user.id,
        free_credits: 300,
        purchased_credits: 0,
        free_renewal_at: renewalDate.toISOString(),
        pro_subscriber: false,
        monthly_allowance: 300,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to initialize credits:', insertError)
      return NextResponse.json(
        { error: 'Failed to initialize credits' },
        { status: 500 }
      )
    }

    console.log('Credits initialized successfully for user:', user.id)

    return NextResponse.json({ 
      initialized: true,
      credits: newCredits
    })
  } catch (error) {
    console.error('Init credits error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize credits' },
      { status: 500 }
    )
  }
}
