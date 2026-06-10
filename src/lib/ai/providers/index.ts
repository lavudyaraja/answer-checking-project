import type { AIProvider } from '../ai-provider'
import { getGroqProvider } from './groq'
import { getClaudeProvider } from './claude'

export function getAIProviderClient(aiProvider: AIProvider) {
  switch (aiProvider) {
    case 'claude':
      return getClaudeProvider()
    case 'groq':
    default:
      return getGroqProvider()
  }
}

// Export all providers for direct access if needed
export { getGroqProvider } from './groq'
export { getClaudeProvider } from './claude'

