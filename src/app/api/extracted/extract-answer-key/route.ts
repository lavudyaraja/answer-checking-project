/**
 * src/app/api/extract-answer-key/route.ts
 *
 * Image → Groq Llama vision reads the answer key DIRECTLY (no OCR)
 * PDF   → unpdf text → Groq vision model (single model for all)
 * Text  → Groq vision model (single model for all)
 *
 * Pairs with /api/extract-questions — takes the same question list and
 * fills in modelAnswer + rubric by reading the answer key document.
 *
 * Install: npm install unpdf groq-sdk
 */

import { extractText } from 'unpdf'
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

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
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ExistingQuestion {
  questionNumber: number
  text: string
}

interface RawAnswerEntry {
  questionNumber?: number
  matchedText?: string
  modelAnswer?: string
  rubric?: string
  keywords?: string[]
  maxMarks?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared answer-key extraction prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildExtractionPrompt(existingQuestions?: ExistingQuestion[]): string {
  const questionBlock = existingQuestions?.length
    ? `EXISTING QUESTIONS TO MATCH ANSWERS TO:
${existingQuestions
      .map(q => `[Q${q.questionNumber}]: ${q.text}`)
      .join('\n')}

For EACH answer entry you output, set "questionNumber" to EXACTLY the questionNumber
shown above (e.g. 1, 2, 3). This is the primary key used
to link the answer back to the correct question.`
    : 'Auto-detect question identifiers. Use numbers like 1, 2, 3 for "questionNumber".'

  return `You are an expert exam answer-key parser.

YOUR TASK:
1. **VISUAL ANALYSIS**: Use your capabilities to read the ENTIRE document.
2. Identify ALL model answers / answer key entries. Look for question numbers, "Ans", "Soln", labels.
3. For each answer extract:
   - "questionNumber": The INTEGER question number (e.g. 1, 2, 3). This is MANDATORY and is the primary match key.
   - "matchedText": A unique 5–15 word snippet from the QUESTION text that this answer addresses. Used as a semantic fallback.
   - "modelAnswer": The COMPLETE answer text (all steps, all parts).
   - "rubric": A concise grading rubric with mark distribution.
   - "keywords": Key concepts / terms expected in a correct student answer.
   - "maxMarks": Maximum marks for this question (state as integer; estimate if unstated).

${questionBlock}

RULES:
- **questionNumber IS THE PRIMARY KEY**: Use the exact question number from the list above.
- **NEVER leave modelAnswer empty** if a relevant answer exists anywhere in the document.
- Include ALL steps in mathematical / derivation answers.
- For definition questions include the precise definition.
- List all acceptable alternative answers if they exist.
- If a mark breakdown is stated (e.g. "2 marks for x, 1 mark for y") include it verbatim in "rubric".

Return ONLY valid JSON — NO extra text, NO markdown fences:
{
  "answers": [
    {
      "questionNumber": 1,
      "matchedText": "Unique snippet from the question text this answers",
      "modelAnswer": "Complete model answer text. Include all steps.",
      "rubric": "Award 2 marks for correct formula. Award 3 marks for correct working. Award 1 mark for units.",
      "keywords": ["keyword1", "keyword2"],
      "maxMarks": 6
    }
  ],
  "notes": "Any observations about the answer key document"
}`
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Optional: caller passes existing question list so the model can pair answers correctly
    const questionsRaw = formData.get('questions') as string | null
    let existingQuestions: ExistingQuestion[] | undefined
    if (questionsRaw) {
      try {
        existingQuestions = JSON.parse(questionsRaw)
      } catch {
        // ignore — treat as no existing questions
      }
    }

    if (file.type === 'application/pdf') return extractFromPDF(file, existingQuestions)
    if (file.type.startsWith('image/')) return extractFromImage(file, existingQuestions)
    if (file.type === 'text/plain') return extractFromText(await file.text(), existingQuestions)

    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Use PDF, image, or plain text.` },
      { status: 400 },
    )
  } catch (error) {
    console.error('Error extracting answer key:', error)
    return NextResponse.json({ error: 'Failed to extract answer key' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF — unpdf text extraction → Groq, or scanned PDF → Claude Vision
// ─────────────────────────────────────────────────────────────────────────────

async function extractFromPDF(
  file: File,
  existingQuestions?: ExistingQuestion[],
): Promise<NextResponse> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const uint8 = new Uint8Array(buffer)
    const prompt = buildExtractionPrompt(existingQuestions)

    // ── Step 1: Try text-based extraction (fast, cheap) ───────────────────────
    let pdfText = ''
    try {
      const { text } = await extractText(uint8, { mergePages: true })
      pdfText = text.replace(/\s+/g, ' ').trim()
    } catch (parseErr) {
      console.warn('[extract-answer-key] unpdf failed, falling back to Vision AI:', parseErr)
    }

    if (pdfText && pdfText.length > 50) {
      console.log('[extract-answer-key] Text-based PDF detected, using Groq text model')
      const result = await groq.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          { role: 'user', content: `${prompt}\n\nANSWER KEY DOCUMENT TEXT:\n${pdfText}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 4096,
      })
      console.log('[extract-answer-key] Groq tokens used:', result.usage)
      return parseAndReturn(result.choices[0].message.content ?? '{}')
    }

    // ── Step 2: Scanned PDF → Claude Vision ──────────────────────────────────
    console.log('[extract-answer-key] Scanned PDF detected, using Claude Vision for extraction')

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Scanned PDF detected but Anthropic API key is not configured. Add ANTHROPIC_API_KEY to .env, or upload a JPG/PNG instead.' },
        { status: 422 },
      )
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const base64PDF = buffer.toString('base64')

    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_VISION_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64PDF },
            } as any,
            { type: 'text', text: prompt },
          ],
        },
      ],
    })

    const rawText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('')

    console.log('[extract-answer-key] Claude RAW Response Length:', rawText.length)
    if (rawText.length < 100) {
      console.warn('[extract-answer-key] Warning: Claude response is very short:', rawText)
    }

    return parseAndReturn(rawText)
  } catch (error) {
    console.error('[extract-answer-key] PDF extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract answer key from PDF' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Image — Groq Llama vision reads answer key DIRECTLY (no OCR step)
// ─────────────────────────────────────────────────────────────────────────────

async function extractFromImage(
  file: File,
  existingQuestions?: ExistingQuestion[],
): Promise<NextResponse> {
  try {
    const rawBase64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    const dataUrl = `data:${file.type};base64,${rawBase64}`
    const prompt = buildExtractionPrompt(existingQuestions)

    const result = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4096,
    })

    return parseAndReturn(result.choices[0].message.content ?? '{}')
  } catch (error) {
    console.error('Image answer-key extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract answer key from image' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plain text
// ─────────────────────────────────────────────────────────────────────────────

async function extractFromText(
  text: string,
  existingQuestions?: ExistingQuestion[],
): Promise<NextResponse> {
  try {
    const prompt = buildExtractionPrompt(existingQuestions)

    const result = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: 'user', content: `${prompt}\n\nANSWER KEY DOCUMENT TEXT:\n${text}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4096,
    })

    return parseAndReturn(result.choices[0].message.content ?? '{}')
  } catch (error) {
    console.error('Text answer-key extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract answer key from text' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse Groq / Claude response → validated answer list
// ─────────────────────────────────────────────────────────────────────────────

function parseAndReturn(raw: string): NextResponse {
  const parsed = extractJSON<{ answers?: RawAnswerEntry[]; notes?: string }>(raw)

  if (!parsed?.answers?.length) {
    console.error('No answers in response:', raw.slice(0, 500))
    return NextResponse.json(
      { error: 'No answers could be extracted. Check the document format and try again.' },
      { status: 422 },
    )
  }

  const answers = parsed.answers.map((a: RawAnswerEntry, index: number) => ({
    questionNumber: a.questionNumber ?? index + 1,
    matchedText: a.matchedText ?? '',
    modelAnswer: a.modelAnswer ?? '',
    rubric: a.rubric ?? '',
    keywords: a.keywords ?? [],
    maxMarks: a.maxMarks ?? 10,
  }))

  return NextResponse.json({
    answers,
    notes: parsed.notes ?? '',
  })
}