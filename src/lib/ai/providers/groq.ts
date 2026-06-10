import Groq from 'groq-sdk'
import type { AIProvider } from '../ai-provider'

const MULTIMODAL_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
const FAST_TEXT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

// Only initialize Groq if API key is available
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null

export function getGroqProvider() {
  const provider: AIProvider = 'groq'

  return {
    provider,
    async runTextJSON(params: { prompt: string; temperature: number; maxTokens: number }): Promise<string> {
      if (!groq) {
        throw new Error('Groq API key is not configured')
      }
      const res = await groq.chat.completions.create({
        model: FAST_TEXT_MODEL,
        messages: [{ role: 'user', content: params.prompt }],
        response_format: { type: 'json_object' },
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      })
      return res.choices[0].message.content ?? ''
    },
    async runText(params: { prompt: string; temperature: number; maxTokens: number }): Promise<string> {
      if (!groq) {
        throw new Error('Groq API key is not configured')
      }
      const res = await groq.chat.completions.create({
        model: FAST_TEXT_MODEL,
        messages: [{ role: 'user', content: params.prompt }],
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      })
      return res.choices[0].message.content ?? ''
    },
    async runVisionJSON(params: {
      promptText: string
      imageDataUrl: string
      temperature: number
      maxTokens: number
    }): Promise<string> {
      if (!groq) {
        throw new Error('Groq API key is not configured')
      }
      if (params.imageDataUrl.startsWith('data:application/pdf')) {
        throw new Error('Groq Llama-Vision does not support native PDF files. Please use the Claude provider for PDFs or upload student answers as images (JPG/PNG).')
      }

      const res = await groq.chat.completions.create({
        model: MULTIMODAL_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: params.promptText },
              { type: 'image_url', image_url: { url: params.imageDataUrl } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      })
      return res.choices[0].message.content ?? ''
    },
    async checkHealth(): Promise<boolean> {
      return groq !== null
    },
  }
}

