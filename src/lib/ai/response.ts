import { AIResponse } from '@/types/ai'

export function parseAIResponse(rawText: string): AIResponse {
  try {
    let trimmed = rawText.trim()
    
    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    const codeBlockRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/
    const match = trimmed.match(codeBlockRegex)
    if (match) {
      trimmed = match[1].trim()
    }
    
    if (!trimmed.startsWith('{')) {
      console.warn('AI returned non-JSON response, wrapping as respond action')
      return {
        action: 'respond',
        message: trimmed,
      }
    }

    const parsed = JSON.parse(trimmed)
    
    if (!parsed.action) {
      console.warn('AI response missing action field, defaulting to respond')
      return {
        action: 'respond',
        message: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
      }
    }

    return parsed as AIResponse
  } catch (error) {
    console.error('Failed to parse AI response:', error)
    return {
      action: 'respond',
      message: 'I encountered an error processing that request. Please try again.',
    }
  }
}

export function isValidAction(action: string): boolean {
  return ['need_context', 'respond', 'execute_tools', 'preview_creation'].includes(action)
}
