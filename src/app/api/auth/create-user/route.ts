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
    
    // Check if user already exists
    const { data: existingUser } = await serviceSupabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (existingUser) {
      return NextResponse.json({ 
        created: false, 
        message: 'User already exists',
        user: existingUser
      })
    }

    // Create user record
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
    
    console.log('Extracted names for user:', { userId: user.id, firstName, lastName, provider: user.identities?.[0]?.provider })
    
    const { data: newUser, error: userError } = await serviceSupabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email || '',
        first_name: firstName,
        last_name: lastName,
      })
      .select()
      .single()

    if (userError) {
      console.error('Failed to create user:', userError)
      return NextResponse.json(
        { error: 'Failed to create user', details: userError },
        { status: 500 }
      )
    }

    // Initialize credits for the new user
    const renewalDate = new Date()
    renewalDate.setDate(renewalDate.getDate() + 30)

    const { error: creditsError } = await serviceSupabase
      .from('user_credits')
      .insert({
        user_id: user.id,
        free_credits: 300,
        purchased_credits: 0,
        free_renewal_at: renewalDate.toISOString(),
        pro_subscriber: false,
        monthly_allowance: 300,
      })

    if (creditsError) {
      console.error('Failed to initialize credits:', creditsError)
      // Don't fail the whole operation if credits fail, user was created
      return NextResponse.json({ 
        created: true,
        user: newUser,
        warning: 'User created but credits initialization failed'
      })
    }

    console.log('User and credits created successfully via server-side:', user.id)

    return NextResponse.json({ 
      created: true,
      user: newUser,
      credits: {
        free_credits: 300,
        monthly_allowance: 300,
        renewal_date: renewalDate.toISOString()
      }
    })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
