import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider } from '../ai/ai-provider'

const CLAUDE_MODEL = 'claude-sonnet-4-6'
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export function getClaudeSinglePassProvider() {
  return {
    provider: 'claude' as const,
    
    // Single-pass comprehensive evaluation
    async runComprehensiveEvaluation(params: {
      questionText: string
      maxMarks: number
      modelAnswer: string
      imageDataUrl: string
      temperature?: number
      maxTokens?: number
    }): Promise<any> {
      const { mediaType, base64 } = extractDataUrlParts(params.imageDataUrl)
      
      const message = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: params.maxTokens || 4000,
        temperature: params.temperature || 0,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: buildComprehensivePrompt(params)
            },
            {
              type: 'image',
              source: {
                type: 'base64' as const,
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64,
              },
            },
          ],
        }],
      })

      const text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')

      return extractJSON(text, 'evaluation')
    },

    // Existing methods for backward compatibility
    async runVisionJSON(params: {
      promptText: string
      imageDataUrl: string
      temperature: number
      maxTokens: number
    }): Promise<string> {
      const { mediaType, base64 } = extractDataUrlParts(params.imageDataUrl)
      
      const message = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: params.promptText },
              {
                type: 'image',
                source: {
                  type: 'base64' as const,
                  media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: base64,
                },
              },
            ],
          },
        ],
      })
      
      const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
      return text ?? ''
    },

    async runTextJSON(params: {
      prompt: string
      temperature: number
      maxTokens: number
    }): Promise<string> {
      const message = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        messages: [{ role: 'user', content: params.prompt }],
      })
      
      const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
      return text ?? ''
    }
  }
}

function buildComprehensivePrompt(params: {
  questionText: string
  maxMarks: number
  modelAnswer: string
}): string {
  return `
You are an expert educational evaluator with deep expertise in assessing handwritten answers directly.

EVALUATION CONTEXT:
Question: ${params.questionText}
Maximum Marks: ${params.maxMarks}
Model Answer: ${params.modelAnswer}

YOUR TASK:
**DIRECT SCORING**: Look at the handwritten answer and evaluate it directly against the model answer. DO NOT transcribe the text separately - read and evaluate in one step.

EVALUATION CRITERIA:
- Understanding of key concepts
- Accuracy and correctness
- Completeness of answer
- Clarity and organization
- Use of appropriate terminology

SCORING GUIDELINES:
- Award full marks (${params.maxMarks}) only for excellent, complete answers
- Award partial marks for partial understanding or incomplete answers
- Award zero marks for completely incorrect or no answer
- Be fair and consider effort shown
- Base your score on overall understanding, not exact wording

RESPONSE FORMAT (Valid JSON):
{
  "evaluation": {
    "obtainedMarks": number (0 to ${params.maxMarks}),
    "confidence": number (0-100),
    "strengths": ["string", "string"],
    "mistakes": ["string", "string"],
    "suggestions": ["string", "string"],
    "reasoning": "detailed explanation of evaluation"
  }
}

IMPORTANT:
- Read the handwritten answer directly and evaluate
- Do not provide separate transcription
- Focus on understanding and accuracy, not exact text matching
- Be fair and objective in your scoring
- If no answer is provided, set obtainedMarks to 0
  `
}

function extractDataUrlParts(dataUrl: string): { mediaType: string; base64: string } {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) throw new Error('Invalid data URL format')
  return { mediaType: match[1], base64: match[2] }
}

function extractJSON(text: string, key: string): any {
  // Extract JSON from Claude's response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')
  
  try {
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    throw new Error('Failed to parse JSON response')
  }
}

// Utility function to get AI provider client
export function getSinglePassAIProviderClient(provider: AIProvider) {
  switch (provider) {
    case 'claude':
      return getClaudeSinglePassProvider()
    case 'groq':
      // Import Groq provider dynamically to avoid circular dependencies
      const { getGroqSinglePassProvider } = require('./groq-single')
      return getGroqSinglePassProvider()
    default:
      return getClaudeSinglePassProvider()
  }
}
