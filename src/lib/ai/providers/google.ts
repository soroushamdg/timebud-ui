import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIAdapter, AICompletion, AIContentBlock, AIMessage } from '../adapter'
import { ToolSchema } from '../tools'

// Gemini has no id-based tool_use/tool_result pairing like Anthropic/OpenAI — a
// functionCall carries only a name, and the matching functionResponse is matched by
// name (and turn order), not by id. Our shared AIContentBlock always carries both
// `toolUseId` (for the other two providers) and `name` (for this one) on tool_result
// blocks specifically so this adapter can ignore the id and match by name.
function toGeminiParts(content: string | AIContentBlock[]): any[] {
  if (typeof content === 'string') return [{ text: content }]
  return content.map((block) => {
    if (block.type === 'text') return { text: block.text }
    if (block.type === 'tool_use') return { functionCall: { name: block.name, args: block.input } }
    let response: object
    try {
      const parsed = JSON.parse(block.content)
      response = typeof parsed === 'object' && parsed !== null ? parsed : { result: parsed }
    } catch {
      response = { result: block.content }
    }
    return { functionResponse: { name: block.name, response } }
  })
}

export class GoogleAdapter implements AIAdapter {
  async completeMessage(
    model: string,
    systemPrompt: string,
    messages: AIMessage[],
    tools: ToolSchema[],
    thinkingMode: boolean,
    maxTokens: number
  ): Promise<AICompletion> {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
    const geminiModel = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      tools:
        tools.length > 0
          ? ([
              {
                functionDeclarations: tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.inputSchema,
                })),
              },
            ] as any)
          : undefined,
    })

    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === 'user' ? ('user' as const) : ('model' as const),
      parts: toGeminiParts(msg.content),
    }))

    const lastMessage = messages[messages.length - 1]

    const chat = geminiModel.startChat({
      history,
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    })

    const result = await chat.sendMessage(toGeminiParts(lastMessage.content))
    const response = result.response

    const content: AIContentBlock[] = []
    const text = response.text()
    if (text) content.push({ type: 'text', text })

    const calls = response.functionCalls() || []
    for (const call of calls) {
      content.push({ type: 'tool_use', id: crypto.randomUUID(), name: call.name, input: (call.args as Record<string, any>) || {} })
    }

    return {
      content,
      stopReason: calls.length > 0 ? 'tool_use' : 'end_turn',
    }
  }
}
