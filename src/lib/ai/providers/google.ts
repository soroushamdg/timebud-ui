import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIAdapter } from '../adapter'

export class GoogleAdapter implements AIAdapter {
  async completeMessage(
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    thinkingMode: boolean,
    maxTokens: number
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
    const geminiModel = genAI.getGenerativeModel({ 
      model,
      systemInstruction: systemPrompt,
    })

    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }],
    }))

    const lastMessage = messages[messages.length - 1]

    const chat = geminiModel.startChat({
      history,
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    })

    const result = await chat.sendMessage(lastMessage.content)
    const response = result.response
    return response.text()
  }
}
