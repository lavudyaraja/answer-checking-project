import type { AIProvider } from '../ai/ai-provider'

const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

// Initialize Groq client
let groqClient: any = null

function getGroqClient() {
  if (!groqClient) {
    try {
      // Dynamic import to avoid build issues
      const Groq = require('groq-sdk').default
      groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY! })
    } catch (error) {
      console.error('Failed to initialize Groq client:', error)
      throw new Error('Groq SDK not available')
    }
  }
  return groqClient
}

export function getGroqSinglePassProvider() {
  return {
    provider: 'groq' as const,
    
    // Single-pass comprehensive evaluation
    async runComprehensiveEvaluation(params: {
      questionText: string
      maxMarks: number
      modelAnswer: string
      imageDataUrl: string
      temperature?: number
      maxTokens?: number
    }): Promise<any> {
      const client = getGroqClient()
      const { mediaType, base64 } = extractDataUrlParts(params.imageDataUrl)
      
      const completion = await client.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: buildComprehensivePrompt(params)
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${base64}`
              }
            }
          ]
        }],
        temperature: params.temperature || 0,
        max_tokens: params.maxTokens || 4000,
        response_format: { type: "json_object" }
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from Groq')
      }

      return extractJSON(content, 'evaluation')
    },

    // Existing methods for backward compatibility
    async runVisionJSON(params: {
      promptText: string
      imageDataUrl: string
      temperature: number
      maxTokens: number
    }): Promise<string> {
      const client = getGroqClient()
      const { mediaType, base64 } = extractDataUrlParts(params.imageDataUrl)
      
      const completion = await client.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: params.promptText },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${base64}`
                }
              }
            ]
          },
        ],
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      })
      
      return completion.choices[0]?.message?.content || ''
    },

    async runTextJSON(params: {
      prompt: string
      temperature: number
      maxTokens: number
    }): Promise<string> {
      const client = getGroqClient()
      
      const completion = await client.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: params.prompt }],
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      })
      
      return completion.choices[0]?.message?.content || ''
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
  // Extract JSON from Groq's response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')
  
  try {
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    throw new Error('Failed to parse JSON response')
  }
}
