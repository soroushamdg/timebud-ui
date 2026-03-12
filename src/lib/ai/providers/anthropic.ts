import Anthropic from '@anthropic-ai/sdk'
import { AIAdapter } from '../adapter'

export class AnthropicAdapter implements AIAdapter {
  async completeMessage(
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    thinkingMode: boolean,
    apiKey: string,
    maxTokens: number
  ): Promise<string> {
    const client = new Anthropic({ apiKey })

    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content,
    }))

    const params: any = {
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: formattedMessages,
    }

    if (thinkingMode && model.includes('sonnet-4')) {
      params.thinking = {
        type: 'enabled',
        budget_tokens: 5000,
      }
    }

    const response = await client.messages.create(params)

    const textContent = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n')

    return textContent
  }
}
