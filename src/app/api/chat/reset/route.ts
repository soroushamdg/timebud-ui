import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resetConversation } from '@/lib/ai/chat-history'

// Clearing chat in the UI used to only wipe the client's localStorage cache — the
// server-persisted conversation (summary + history, added in this rewrite) would
// silently survive underneath it, so the "cleared" chat would un-clear itself the
// moment the model needed context. This makes "Clear chat" actually start fresh.
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: { code: 'unauthorized', message: 'You must be logged in' } }, { status: 200 })
    }

    await resetConversation(createServiceClient(), user.id)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Chat reset error:', error)
    return NextResponse.json({ success: false, error: { code: 'server_error', message: 'Failed to reset chat history' } }, { status: 200 })
  }
}
