import Anthropic from '@anthropic-ai/sdk'
import { AIAdapter, AICompletion, AIContentBlock, AIMessage } from '../adapter'
import { ToolSchema } from '../tools'

function toAnthropicContent(content: string | AIContentBlock[]): any {
  if (typeof content === 'string') return content
  return content.map((block) => {
    if (block.type === 'text') return { type: 'text', text: block.text }
    if (block.type === 'tool_use') return { type: 'tool_use', id: block.id, name: block.name, input: block.input }
    return { type: 'tool_result', tool_use_id: block.toolUseId, content: block.content, is_error: block.isError }
  })
}

export class AnthropicAdapter implements AIAdapter {
  async completeMessage(
    model: string,
    systemPrompt: string,
    messages: AIMessage[],
    tools: ToolSchema[],
    thinkingMode: boolean,
    maxTokens: number
  ): Promise<AICompletion> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const formattedMessages = messages.map((msg) => ({
      role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: toAnthropicContent(msg.content),
    }))

    const params: any = {
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: formattedMessages,
    }

    if (tools.length > 0) {
      params.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }))
    }

    if (thinkingMode && model.includes('sonnet-4')) {
      params.thinking = {
        type: 'enabled',
        budget_tokens: 5000,
      }
    }

    const response = await client.messages.create(params)

    const content: AIContentBlock[] = response.content
      .map((block: any): AIContentBlock | null => {
        if (block.type === 'text') return { type: 'text', text: block.text }
        if (block.type === 'tool_use') return { type: 'tool_use', id: block.id, name: block.name, input: block.input }
        return null
      })
      .filter((b): b is AIContentBlock => b !== null)

    const stopReason =
      response.stop_reason === 'tool_use'
        ? 'tool_use'
        : response.stop_reason === 'max_tokens'
          ? 'max_tokens'
          : 'end_turn'

    return { content, stopReason }
  }
}
