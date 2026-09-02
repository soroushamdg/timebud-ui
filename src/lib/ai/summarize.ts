import { AIAdapter, textOf } from './adapter'

export interface StoredTurn {
  role: 'user' | 'assistant'
  content: string
}

// Rough token estimate (~4 chars/token for English) — good enough for a rolling-
// summarization trigger. Doesn't need to match any provider's real tokenizer exactly.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export interface SummarizeResult {
  summary: string
  foldedTurnCount: number
  estimatedTokens: number
}

/**
 * Fold `turnsToFold` into `existingSummary`, producing one updated running summary.
 * Called with only the NOT-YET-summarized older turns (chat-history.ts tracks how many
 * have already been folded in), so this never re-reads the same turns twice.
 */
export async function summarizeTurns(
  adapter: AIAdapter,
  model: string,
  existingSummary: string | null,
  turnsToFold: StoredTurn[]
): Promise<SummarizeResult> {
  const transcript = turnsToFold.map((t) => `${t.role === 'user' ? 'User' : 'Bud'}: ${t.content}`).join('\n')

  const summarizerPrompt = `Summarize this slice of a conversation between a user and Bud, TimeBud's AI assistant, into a compact running memory. Preserve: names of missions/jobs discussed, decisions made, actions Bud took and their results, and any open questions or unresolved requests. Be concise — this is context for Bud in future turns, not something the user will read directly.${
    existingSummary ? `\n\nEXISTING SUMMARY (fold this slice into it, don't just append):\n${existingSummary}` : ''
  }`

  const completion = await adapter.completeMessage(model, summarizerPrompt, [{ role: 'user', content: transcript }], [], false, 600)

  const summary = textOf(completion) || existingSummary || ''

  return {
    summary,
    foldedTurnCount: turnsToFold.length,
    estimatedTokens: estimateTokens(summary),
  }
}
