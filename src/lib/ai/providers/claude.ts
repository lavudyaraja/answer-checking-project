import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider } from '../ai-provider'

// Only initialize Anthropic if API key is available
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null

// Allow overriding via env vars because Anthropic model ids can change.
const CLAUDE_VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL ?? 'claude-sonnet-4-6'
const CLAUDE_TEXT_MODEL = process.env.ANTHROPIC_TEXT_MODEL ?? 'claude-sonnet-4-6'

function extractDataUrlParts(dataUrl: string): { mediaType: string; base64: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) throw new Error('Invalid data URL for Claude vision')
  return { mediaType: m[1], base64: m[2] }
}

export function getClaudeProvider() {
  const provider: AIProvider = 'claude'

  return {
    provider,
    async runTextJSON(params: { prompt: string; temperature: number; maxTokens: number }): Promise<string> {
      if (!anthropic) {
        throw new Error('Anthropic API key is not configured')
      }
      const message = await anthropic.messages.create({
        model: CLAUDE_TEXT_MODEL,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        messages: [{ role: 'user', content: [{ type: 'text', text: params.prompt }] }],
      })

      const text = message.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as any).text)
        .join('')

      return text ?? ''
    },
    async runText(params: { prompt: string; temperature: number; maxTokens: number }): Promise<string> {
      if (!anthropic) {
        throw new Error('Anthropic API key is not configured')
      }
      const message = await anthropic.messages.create({
        model: CLAUDE_TEXT_MODEL,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        messages: [{ role: 'user', content: [{ type: 'text', text: params.prompt }] }],
      })

      const text = message.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as any).text)
        .join('')

      return text ?? ''
    },
    async runVisionJSON(params: {
      promptText: string
      imageDataUrl: string
      temperature: number
      maxTokens: number
    }): Promise<string> {
      if (!anthropic) {
        throw new Error('Anthropic API key is not configured')
      }
      const { mediaType, base64 } = extractDataUrlParts(params.imageDataUrl)

      const message = await anthropic.messages.create({
        model: CLAUDE_VISION_MODEL,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: params.promptText },
              mediaType === 'application/pdf'
                ? {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64,
                  },
                } as any
                : {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType as any,
                    data: base64,
                  },
                },
            ],
          },
        ],
      })

      const text = message.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as any).text)
        .join('')

      return text ?? ''
    },
    async checkHealth(): Promise<boolean> {
      return anthropic !== null
    },
  }
}

