# AI Credits & Billing System

This document describes the complete AI credits and billing system implementation for TimeBud.

## Overview

TimeBud uses a credit-based system for all AI features. Users receive free monthly credits and can purchase additional credits or subscribe to Pro for higher allowances.

## Architecture

### Core Principle: Stripe as Source of Truth

**Credit amounts and prices are NEVER hardcoded.** All pricing and credit values live in Stripe product metadata and are fetched dynamically at runtime. This allows business changes (pricing, credit amounts) without code deployments.

### Credit Deduction Flow

1. User initiates AI action (chat message, file analysis, etc.)
2. System determines action type and cost from `CREDIT_COSTS` config
3. Credits are deducted via `deduct_credits()` Postgres RPC function
4. Deduction order: free credits first, then purchased credits
5. If insufficient credits: return error, no AI call is made
6. If AI call fails after deduction: credits are automatically refunded

### Database Schema

**user_credits**
- `user_id` - Primary key
- `free_credits` - Monthly renewable credits
- `purchased_credits` - Never expire
- `free_renewal_at` - Next renewal timestamp
- `pro_subscriber` - Boolean flag
- `monthly_allowance` - 300 for free, 1500 for Pro

**credit_transactions**
- Immutable log of every credit movement
- Tracks before/after balances for audit trail

**stripe_customers**
- Maps user_id to Stripe customer ID
- Stores subscription status and ID

### Postgres Functions

**deduct_credits(p_user_id, p_amount, p_action_type, p_description)**
- Atomically deducts credits (free first, then purchased)
- Returns success/failure with balance info
- Creates transaction record

**add_credits(p_user_id, p_amount, p_action_type, p_is_free_renewal, p_stripe_session_id, p_description)**
- Adds credits to appropriate bucket
- Handles renewals vs purchases
- Creates transaction record

## Credit Costs

Defined in `src/lib/credits/config.ts`:

- **Standard AI message**: 20 credits
- **Thinking mode**: 60 credits
- **Cheap model** (background tasks): 5 credits
- **File attachment**: 25 credits per file
- **Project from file**: 50 credits
- **Bulk task generation**: 30 credits

## Free vs Purchased Credits

### Free Credits
- 300 per month for free users
- 1,500 per month for Pro subscribers
- Renew every 30 days
- Do NOT roll over

### Purchased Credits
- Never expire
- Used after free credits are depleted
- Persist even if subscription is cancelled

## Stripe Integration

### Product Setup

Each Stripe Product must have metadata:
- One-time packs: `metadata.credits = "500"`
- Pro subscription: `metadata.credits_per_month = "1500"`

Environment variables use Product IDs (not Price IDs):
```
STRIPE_PRODUCT_STARTER=prod_xxx
STRIPE_PRODUCT_STANDARD=prod_xxx
STRIPE_PRODUCT_POWER=prod_xxx
STRIPE_PRODUCT_PRO=prod_xxx
```

### Webhook Events

The webhook handler (`/api/stripe/webhook`) processes:

1. **checkout.session.completed**
   - Adds credits from product metadata
   - Updates subscription status for Pro

2. **customer.subscription.deleted**
   - Cancels Pro status
   - Resets monthly_allowance to 300
   - Keeps purchased credits

3. **customer.subscription.updated**
   - Updates subscription status

4. **invoice.payment_succeeded**
   - Renews Pro credits monthly
   - Resets free_credits to monthly_allowance

### Local Development

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run stripe:listen
```

The Stripe CLI outputs a webhook signing secret - copy it to `.env.local` as `STRIPE_WEBHOOK_SECRET`.

**Important**: Local webhook secret (from CLI) is different from production secret (from dashboard).

## API Routes

### Credits
- `GET /api/stripe/packs` - Fetch available credit packs
- `POST /api/stripe/checkout` - Create Stripe checkout session
- `POST /api/stripe/webhook` - Handle Stripe events
- `POST /api/credits/renew` - Manual renewal trigger
- `POST /api/credits/deduct` - Client-initiated deduction

### Chat Integration
- `/api/chat` - Deducts credits before AI call, refunds on failure

## React Hooks

### useCredits()
Queries user_credits table, auto-renews if due.

### useTotalCredits()
Returns derived state:
```typescript
{
  total: number
  free: number
  purchased: number
  isLow: boolean  // true when below 20% of monthly allowance
  renewalDate: string
  proSubscriber: boolean
  monthlyAllowance: number
  isLoading: boolean
}
```

### useDeductCredits()
Mutation for client-side credit deductions (future features).

## UI Components

### Credits Page (`/credits`)
- Balance display with free/purchased breakdown
- One-time credit pack cards (fetched from Stripe)
- Pro subscription card
- Success/cancelled banners
- "How credits work" collapsible section

### Chat Page
- Credit pill in top bar (shows balance, yellow if low)
- Dismissible low credit warning banner
- Insufficient credits error handling
- Credit cost display after each AI response

### Profile Page
- Credits & Billing row (shows balance)
- PRO badge next to username if subscribed

## Security

- API keys stored server-side only (environment variables)
- Service role key used for credit mutations
- Webhook signature verification (critical!)
- RLS enabled on all database tables
- Atomic credit operations via Postgres functions

## Future Features

Any new AI feature must:
1. Import `getActionType()` and `deductCreditsForAction()` from `src/lib/credits/`
2. Determine action type before AI call
3. Deduct credits using the utility function
4. Refund on failure using `refundCreditsForAction()`

Example:
```typescript
import { getActionType } from '@/lib/credits/config'
import { deductCreditsForAction, refundCreditsForAction } from '@/lib/credits/deduct'

const actionType = getActionType({ hasFiles: true })
const result = await deductCreditsForAction({
  userId,
  actionType,
  description: 'My feature',
  supabase: serviceSupabase,
})

if (!result.success) {
  // Handle insufficient credits
}

try {
  // Call AI
} catch (error) {
  // Refund on failure
  await refundCreditsForAction({ userId, actionType, supabase: serviceSupabase })
}
```

## Testing Checklist

- [ ] Purchase one-time credit pack
- [ ] Subscribe to Pro
- [ ] Cancel Pro subscription (credits should persist)
- [ ] Verify free credit renewal after 30 days
- [ ] Test insufficient credits error in chat
- [ ] Verify credit refund on AI failure
- [ ] Test low credit warning (below 60 for free, 300 for Pro)
- [ ] Verify webhook signature validation
- [ ] Test Stripe CLI local webhooks
- [ ] Verify credit costs are correct for each action type

## Maintenance

### Changing Credit Costs
Update `CREDIT_COSTS` in `src/lib/credits/config.ts` and deploy.

### Changing Prices or Credit Amounts
Update in Stripe Dashboard product metadata - no code deployment needed.

### Adding New Credit Packs
Create new product in Stripe with `metadata.credits` - appears automatically in UI.

## Files Created/Modified

### New Files
- `src/types/credits.ts` - TypeScript types
- `src/lib/credits/config.ts` - Credit costs and utilities
- `src/lib/credits/deduct.ts` - Credit deduction utilities
- `src/lib/stripe/client.ts` - Stripe singleton
- `src/lib/stripe/products.ts` - Product fetching with cache
- `src/lib/stripe/customer.ts` - Customer management
- `src/app/api/stripe/packs/route.ts` - Packs API
- `src/app/api/stripe/checkout/route.ts` - Checkout API
- `src/app/api/stripe/webhook/route.ts` - Webhook handler
- `src/app/api/credits/renew/route.ts` - Renewal API
- `src/app/api/credits/deduct/route.ts` - Deduction API
- `src/hooks/useCredits.ts` - React Query hooks
- `src/app/credits/page.tsx` - Credits purchase page

### Modified Files
- `src/types/database.ts` - Removed api_key field
- `src/types/ai.ts` - Added credits field to ChatAPIResponse
- `src/lib/ai/adapter.ts` - Removed apiKey parameter
- `src/lib/ai/providers/*.ts` - Use env vars for API keys
- `src/app/api/chat/route.ts` - Credit integration
- `src/app/chat/page.tsx` - Credit UI elements
- `src/app/profile/page.tsx` - Credits row and PRO badge
- `package.json` - Added stripe:listen script
