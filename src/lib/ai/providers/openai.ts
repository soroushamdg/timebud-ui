import OpenAI from 'openai'
import { AIAdapter } from '../adapter'

export class OpenAIAdapter implements AIAdapter {
  async completeMessage(
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    thinkingMode: boolean,
    maxTokens: number
  ): Promise<string> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const formattedMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    ]

    const isReasoningModel = model.startsWith('o1') || model.startsWith('o3')

    const params: any = {
      model,
      messages: formattedMessages,
    }

    if (isReasoningModel) {
      params.max_completion_tokens = maxTokens
    } else {
      params.max_tokens = maxTokens
    }

    const response = await client.chat.completions.create(params)

    return response.choices[0]?.message?.content || ''
  }
}
