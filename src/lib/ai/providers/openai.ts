import OpenAI from 'openai'
import { AIAdapter, AICompletion, AIContentBlock, AIMessage } from '../adapter'
import { ToolSchema } from '../tools'

// OpenAI's wire format splits a tool round-trip across three message roles instead of
// Anthropic's "tool_use/tool_result live inside assistant/user content blocks": the
// assistant message that requested tools carries a `tool_calls` array, and each result
// is its own `{role: 'tool', tool_call_id, content}` message. This maps our shared
// AIMessage[] (which mirrors Anthropic's shape) into that.
function toOpenAIMessages(systemPrompt: string, messages: AIMessage[]): any[] {
  const result: any[] = [{ role: 'system', content: systemPrompt }]

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      result.push({ role: msg.role, content: msg.content })
      continue
    }

    if (msg.role === 'assistant') {
      const text = msg.content
        .filter((b): b is Extract<AIContentBlock, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
      const toolUses = msg.content.filter(
        (b): b is Extract<AIContentBlock, { type: 'tool_use' }> => b.type === 'tool_use'
      )

      result.push({
        role: 'assistant',
        content: text || null,
        ...(toolUses.length > 0
          ? {
              tool_calls: toolUses.map((t) => ({
                id: t.id,
                type: 'function',
                function: { name: t.name, arguments: JSON.stringify(t.input) },
              })),
            }
          : {}),
      })
    } else {
      const toolResults = msg.content.filter(
        (b): b is Extract<AIContentBlock, { type: 'tool_result' }> => b.type === 'tool_result'
      )
      const text = msg.content
        .filter((b): b is Extract<AIContentBlock, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('\n')

      for (const tr of toolResults) {
        result.push({ role: 'tool', tool_call_id: tr.toolUseId, content: tr.content })
      }
      if (text) {
        result.push({ role: 'user', content: text })
      }
    }
  }

  return result
}

export class OpenAIAdapter implements AIAdapter {
  async completeMessage(
    model: string,
    systemPrompt: string,
    messages: AIMessage[],
    tools: ToolSchema[],
    thinkingMode: boolean,
    maxTokens: number
  ): Promise<AICompletion> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const isReasoningModel = model.startsWith('o1') || model.startsWith('o3')

    const params: any = {
      model,
      messages: toOpenAIMessages(systemPrompt, messages),
    }

    if (tools.length > 0) {
      params.tools = tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      }))
    }

    if (isReasoningModel) {
      params.max_completion_tokens = maxTokens
    } else {
      params.max_tokens = maxTokens
    }

    const response = await client.chat.completions.create(params)

    const choice: any = response.choices[0]
    const message = choice?.message

    const content: AIContentBlock[] = []
    if (message?.content) {
      content.push({ type: 'text', text: message.content })
    }
    for (const call of message?.tool_calls || []) {
      let input: Record<string, any> = {}
      try {
        input = JSON.parse(call.function?.arguments || '{}')
      } catch {
        input = {}
      }
      content.push({ type: 'tool_use', id: call.id, name: call.function?.name, input })
    }

    const stopReason: AICompletion['stopReason'] =
      (message?.tool_calls?.length ?? 0) > 0
        ? 'tool_use'
        : choice?.finish_reason === 'length'
          ? 'max_tokens'
          : 'end_turn'

    return { content, stopReason }
  }
}
