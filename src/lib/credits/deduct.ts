import { SupabaseClient } from '@supabase/supabase-js'
import { ActionType, DeductResult } from '@/types/credits'
import { getActionCost } from './config'

export async function deductCreditsForAction(params: {
  userId: string
  actionType: ActionType
  description?: string
  supabase: SupabaseClient
}): Promise<DeductResult> {
  const { userId, actionType, description, supabase } = params
  const cost = getActionCost(actionType)

  if (cost === 0) {
    const { data: credits } = await supabase
      .from('user_credits')
      .select('free_credits, purchased_credits')
      .eq('user_id', userId)
      .single()

    return {
      success: true,
      balance: {
        free_credits: credits?.free_credits || 0,
        purchased_credits: credits?.purchased_credits || 0,
        total: (credits?.free_credits || 0) + (credits?.purchased_credits || 0),
      },
    }
  }

  const { data, error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: cost,
    p_action_type: actionType,
    p_description: description || null,
  })

  if (error) {
    console.error('Credit deduction error:', error)
    throw error
  }

  return data as DeductResult
}

export async function refundCreditsForAction(params: {
  userId: string
  actionType: ActionType
  supabase: SupabaseClient
}): Promise<void> {
  const { userId, actionType, supabase } = params
  const cost = getActionCost(actionType)

  if (cost === 0) {
    return
  }

  await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_amount: cost,
    p_action_type: 'refund',
    p_is_free_renewal: false,
    p_stripe_session_id: null,
    p_description: `Refund for failed ${actionType}`,
  })
}
