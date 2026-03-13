export interface AIAdapter {
  completeMessage(
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    thinkingMode: boolean,
    maxTokens: number
  ): Promise<string>
}
