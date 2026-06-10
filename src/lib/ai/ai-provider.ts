export type AIProvider = 'groq' | 'claude'

export interface AIModel {
  id: string
  name: string
  provider: AIProvider
  description?: string
  isAvailable?: boolean
}

export const DEFAULT_MODELS: AIModel[] = [
  {
    id: 'llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout (Groq)',
    provider: 'groq',
    description: 'Fast and efficient model for text extraction'
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6 (Anthropic)',
    provider: 'claude',
    description: 'High-quality vision and text analysis'
  }
]

