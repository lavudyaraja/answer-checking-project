/**
 * src/app/api/extract-student-answer/route.ts
 *
 * ✅ Image → Groq Llama vision reads student answer DIRECTLY (no OCR)
 *
 * Uses the same vision model as extract-questions for consistency
 */

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { db } from '@/lib/db'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

// ─────────────────────────────────────────────────────────────────────────────
// JSON extractor
// ─────────────────────────────────────────────────────────────────────────────

function extractJSON<T>(raw: string): T | null {
  const clean = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')

  try { return JSON.parse(clean) as T } catch { /* fall through */ }

  let depth = 0, start = -1
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '{') { if (depth === 0) start = i; depth++ }
    else if (clean[i] === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(clean.slice(start, i + 1)) as T }
        catch { start = -1 }
      }
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Student answer extraction prompt
// ─────────────────────────────────────────────────────────────────────────────

const STUDENT_ANSWER_PROMPT = `You are an expert handwriting recognition and text extraction specialist.

Your task is to carefully read and extract the exact text written in this student's answer image.

Instructions:
1. Read ALL handwritten text visible in the image
2. Preserve the original structure and formatting as much as possible
3. Include any mathematical expressions, diagrams text, or labels
4. If the text is unclear or illegible, make your best effort and note [unclear] for unreadable parts
5. Return ONLY the extracted text without any additional commentary
6. Maintain line breaks and paragraph structure where visible

Extract the student's answer text exactly as written:`

// ─────────────────────────────────────────────────────────────────────────────
// Vision model extraction
// ─────────────────────────────────────────────────────────────────────────────

async function extractWithVision(imageDataUrl: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: STUDENT_ANSWER_PROMPT },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
    temperature: 0.1, // Low temperature for accurate extraction
    max_tokens: 2000,
  })

  return response.choices[0]?.message?.content?.trim() || ''
}

// ─────────────────────────────────────────────────────────────────────────────
// Main API handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { image, evaluationId, questionId } = await request.json()

    if (!image) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      )
    }

    // Validate image data URL format
    if (!image.startsWith('data:image/') && !image.startsWith('http')) {
      return NextResponse.json(
        { error: 'Invalid image format' },
        { status: 400 }
      )
    }

    // Extract text using vision model
    const extractedText = await extractWithVision(image)

    if (!extractedText) {
      return NextResponse.json(
        { error: 'No text could be extracted from the image' },
        { status: 400 }
      )
    }

    // Save extracted text to database if evaluationId and questionId are provided
    if (evaluationId && questionId) {
      try {
        await db.questionEvaluation.updateMany({
          where: {
            evaluationId: evaluationId,
            questionId: questionId
          },
          data: {
            studentAnswer: extractedText
          }
        })
      } catch (dbError) {
        console.error('Failed to save extracted text to database:', dbError)
        // Continue anyway - we still return the extracted text
      }
    }

    return NextResponse.json({ text: extractedText })
  } catch (error) {
    console.error('Student answer extraction error:', error)
    
    if (error instanceof Error && error.message.includes('rate limit')) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable due to rate limits. Please try again.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to extract text from image' },
      { status: 500 }
    )
  }
}
