import { AIProvider } from '@/types/database'
import { DbUserAISettings } from '@/types/database'
import { AIAdapter } from './adapter'
import { AnthropicAdapter } from './providers/anthropic'
import { OpenAIAdapter } from './providers/openai'
import { GoogleAdapter } from './providers/google'
import { SUPPORTED_MODELS, ROUTING_RULES } from './config'

export function getAdapter(provider: AIProvider): AIAdapter {
  switch (provider) {
    case 'anthropic':
      return new AnthropicAdapter()
    case 'openai':
      return new OpenAIAdapter()
    case 'google':
      return new GoogleAdapter()
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

export function resolveModel(
  settings: DbUserAISettings,
  complexity: 'simple' | 'complex' = 'complex'
): string {
  if (complexity === 'simple') {
    const cheapModel = SUPPORTED_MODELS.find(
      m => m.provider === settings.provider && m.isCheap
    )
    return cheapModel?.id || settings.model
  }
  return settings.model
}

export function getMaxTokens(complexity: 'simple' | 'complex' = 'complex'): number {
  return ROUTING_RULES.maxTokens[complexity]
}
