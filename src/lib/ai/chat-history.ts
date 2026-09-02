import { SupabaseClient } from '@supabase/supabase-js'
import { DbChatConversation } from '@/types/database'
import { AIAdapter, AIMessage } from './adapter'
import { StoredTurn, summarizeTurns } from './summarize'

// Server-side persisted conversation history — replaces the old client-only
// localStorage cap (last 40 messages, no summarization, nothing survived across
// devices, and no durable record of what Bud actually did). Each user has a single
// running conversation; a rolling summary absorbs turns older than the most recent
// window so the prompt sent to the model stays bounded no matter how long the
// conversation runs, instead of growing (or silently truncating) forever.
//
// What gets persisted per turn is plain text only (the user's message, Bud's final
// reply) — never the raw tool_use/tool_result scaffolding, which is specific to one
// provider's wire format and only meaningful within the single request that produced
// it. tool_calls/tool_results are stored alongside purely as an audit trail (answers
// "did it actually run?"), not replayed into future prompts.

const KEEP_RECENT_TURNS = 18
// Once at least this many older turns have piled up beyond the recent window, fold
// them into the running summary. A dozen real chat turns is a reasonable proxy for
// "getting close to the ~8K token target" without paying for an exact tokenizer call
// on every single request.
const SUMMARIZE_BATCH_SIZE = 12

export interface LoadedHistory {
  conversationId: string
  summary: string | null
  recentTurns: StoredTurn[]
}

export async function getOrCreateConversation(
  supabase: SupabaseClient,
  userId: string
): Promise<DbChatConversation> {
  const { data: existing } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return existing as DbChatConversation

  const { data: created, error } = await supabase
    .from('chat_conversations')
    .insert({ user_id: userId })
    .select('*')
    .single()

  if (error) throw error
  return created as DbChatConversation
}

export async function loadHistory(
  supabase: SupabaseClient,
  adapter: AIAdapter,
  model: string,
  conversation: DbChatConversation
): Promise<LoadedHistory> {
  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)

  const totalCount = count ?? 0

  const { data: recentRows } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(KEEP_RECENT_TURNS)

  const recentTurns: StoredTurn[] = (recentRows ?? [])
    .slice()
    .reverse()
    .map((r: any) => ({ role: r.role, content: r.content }))

  let summary = conversation.summary
  const alreadyFolded = conversation.summarized_message_count ?? 0
  const unsummarizedOlderCount = Math.max(0, totalCount - KEEP_RECENT_TURNS - alreadyFolded)

  if (unsummarizedOlderCount >= SUMMARIZE_BATCH_SIZE) {
    const { data: olderRows } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .range(alreadyFolded, totalCount - KEEP_RECENT_TURNS - 1)

    const turnsToFold: StoredTurn[] = (olderRows ?? []).map((r: any) => ({ role: r.role, content: r.content }))

    if (turnsToFold.length > 0) {
      try {
        const result = await summarizeTurns(adapter, model, summary, turnsToFold)
        summary = result.summary
        await supabase
          .from('chat_conversations')
          .update({
            summary,
            summary_token_count: result.estimatedTokens,
            summarized_message_count: alreadyFolded + turnsToFold.length,
            updated_at: new Date().toISOString(),
          })
          .eq('id', conversation.id)
      } catch (err) {
        // Summarization is a background quality improvement, not load-bearing for this
        // request — on failure, fall through and just send the recent verbatim turns.
        console.error('[chat-history] summarization failed:', err)
      }
    }
  }

  return { conversationId: conversation.id, summary, recentTurns }
}

export function toPromptMessages(history: LoadedHistory): AIMessage[] {
  const messages: AIMessage[] = []
  if (history.summary) {
    messages.push({
      role: 'user',
      content: `[CONVERSATION SUMMARY — earlier turns, for your context only, don't repeat this back verbatim]\n${history.summary}`,
    })
  }
  for (const turn of history.recentTurns) {
    messages.push({ role: turn.role, content: turn.content })
  }
  return messages
}

export async function appendTurn(
  supabase: SupabaseClient,
  conversationId: string,
  turn: { role: 'user' | 'assistant'; content: string; toolCalls?: any; toolResults?: any }
): Promise<void> {
  await supabase.from('chat_messages').insert({
    conversation_id: conversationId,
    role: turn.role,
    content: turn.content,
    tool_calls: turn.toolCalls ?? null,
    tool_results: turn.toolResults ?? null,
  })
  await supabase
    .from('chat_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
}

export async function resetConversation(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase.from('chat_conversations').delete().eq('user_id', userId)
}
