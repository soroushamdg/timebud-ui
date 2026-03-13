export interface UserCredits {
  user_id: string
  free_credits: number
  purchased_credits: number
  free_renewal_at: string
  pro_subscriber: boolean
  monthly_allowance: number
  created_at: string
  updated_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  action_type: string
  description: string | null
  free_credits_before: number
  purchased_credits_before: number
  free_credits_after: number
  purchased_credits_after: number
  stripe_session_id: string | null
  created_at: string
}

export interface StripeCustomer {
  user_id: string
  stripe_customer_id: string
  subscription_id: string | null
  subscription_status: string | null
  created_at: string
  updated_at: string
}

export type ActionType =
  | 'ai_message'
  | 'ai_thinking'
  | 'ai_cheap'
  | 'file_analysis'
  | 'project_from_file'
  | 'bulk_tasks'
  | 'avatar_generation'
  | 'purchase'
  | 'renewal'
  | 'subscription'
  | 'refund'

export interface StripePack {
  productId: string
  priceId: string
  name: string
  credits: number
  amount: number
  currency: string
  popular: boolean
  isSubscription: boolean
  interval?: 'month' | 'year'
}

export interface DeductResult {
  success: boolean
  reason?: string
  balance: {
    free_credits: number
    purchased_credits: number
    total: number
  }
  deducted?: {
    from_free: number
    from_purchased: number
    total: number
  }
}
