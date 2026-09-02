import { ToolSchema } from './tools'

/**
 * Structured content blocks shared across all three providers' native tool-calling
 * representations. Replaces the old `Promise<string>` contract that made the model
 * hand-roll a JSON object as raw text (fragile — see the deleted response.ts parser
 * that existed only to rescue malformed/wrapped JSON).
 */
export type AIContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
  | { type: 'tool_result'; toolUseId: string; name: string; content: string; isError?: boolean }

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string | AIContentBlock[]
}

export interface AICompletion {
  content: AIContentBlock[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens'
}

export interface AIAdapter {
  completeMessage(
    model: string,
    systemPrompt: string,
    messages: AIMessage[],
    tools: ToolSchema[],
    thinkingMode: boolean,
    maxTokens: number
  ): Promise<AICompletion>
}

export function textOf(completion: AICompletion): string {
  return completion.content
    .filter((b): b is Extract<AIContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

export function toolUsesOf(completion: AICompletion): Extract<AIContentBlock, { type: 'tool_use' }>[] {
  return completion.content.filter(
    (b): b is Extract<AIContentBlock, { type: 'tool_use' }> => b.type === 'tool_use'
  )
}
