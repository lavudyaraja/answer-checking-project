/**
 * src/app/api/extracted/extract-questions/route.ts
 *
 * Image → Sharp auto-crop (remove blank borders, resize) → Groq Llama vision
 * PDF   → unpdf text → Groq text model  |  Scanned PDF → Claude Vision
 * Text  → Groq vision model
 *
 * Install: npm install unpdf groq-sdk sharp
 *          npm install --save-dev @types/sharp
 */

import { extractText } from 'unpdf'
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { randomUUID } from 'crypto'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

// ─────────────────────────────────────────────────────────────────────────────
// Image auto-crop & optimisation
// ─────────────────────────────────────────────────────────────────────────────

interface ImageOptimizationMeta {
  originalKB: number
  processedKB: number
  savedPercent: number
  dimensions: string
  wasCropped: boolean
}

/**
 * Uses Sharp to:
 *  1. Trim white/near-white borders (removes blank margins around exam paper scans)
 *  2. Resize to max 2 000 px on longest side (cuts token count dramatically)
 *  3. Re-encode as JPEG @ 88 % quality
 *
 * Falls back to the original buffer if Sharp fails.
 */
async function autoCropImage(
  rawBuffer: Buffer,
): Promise<{ buffer: Buffer; meta: ImageOptimizationMeta }> {
  const originalKB = Math.round(rawBuffer.length / 1024)

  try {
    // Dynamic import so the cold-start penalty is paid only for image routes
    const sharp = (await import('sharp')).default

    const MAX_DIM = 2_000   // px – beyond this Groq vision gains nothing
    const TRIM_THRESHOLD = 20 // colour distance from white to count as "blank"

    // ── Step 1: Trim blank borders ───────────────────────────────────────────
    // Sharp's .trim() removes edges whose colour matches the top-left corner
    // pixel within `threshold` distance (Euclidean in RGB space).
    let pipeline = sharp(rawBuffer).trim({
      background: { r: 255, g: 255, b: 255 },
      threshold: TRIM_THRESHOLD,
    })

    // ── Step 2: Downscale if oversized ──────────────────────────────────────
    const tmpMeta = await sharp(rawBuffer).metadata()
    const w = tmpMeta.width ?? 0
    const h = tmpMeta.height ?? 0
    if (w > MAX_DIM || h > MAX_DIM) {
      pipeline = pipeline.resize(MAX_DIM, MAX_DIM, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }

    // ── Step 3: Output as progressive JPEG ──────────────────────────────────
    const processed = await pipeline
      .jpeg({ quality: 88, progressive: true, mozjpeg: true })
      .toBuffer()

    const finalMeta = await sharp(processed).metadata()
    const processedKB = Math.round(processed.length / 1024)
    const savedPercent = Math.max(
      0,
      Math.round((1 - processedKB / originalKB) * 100),
    )
    const dimensions = `${finalMeta.width ?? '?'}×${finalMeta.height ?? '?'}`
    const wasCropped = savedPercent >= 5 // at least 5 % smaller → meaningful crop

    console.log(
      `[extract-questions] Image: ${originalKB} KB → ${processedKB} KB ` +
      `(saved ${savedPercent}%, ${dimensions}px)${wasCropped ? ' [CROPPED]' : ''}`,
    )

    return {
      buffer: processed,
      meta: { originalKB, processedKB, savedPercent, dimensions, wasCropped },
    }
  } catch (err) {
    console.warn('[extract-questions] Sharp preprocessing failed, using original:', err)
    return {
      buffer: rawBuffer,
      meta: {
        originalKB,
        processedKB: originalKB,
        savedPercent: 0,
        dimensions: 'unknown',
        wasCropped: false,
      },
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON extractor – handles markdown fences & partial JSON
// ─────────────────────────────────────────────────────────────────────────────

function extractJSON<T>(raw: string): T | null {
  const clean = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')

  try { return JSON.parse(clean) as T } catch { /* fall through */ }

  let depth = 0, start = -1
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '{') {
      if (depth === 0) start = i
      depth++
    } else if (clean[i] === '}') {
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
// Shared extraction prompt
// ─────────────────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are an expert exam paper parser specialising in mathematical and scientific content.

YOUR TASK:
1. Read the ENTIRE document (every page / all content).
2. Identify ALL questions — numbered as Q1, Q2, 1., 2., Question 1, etc.
3. **SUB-PARTS LOGIC (MANDATORY)**:
   - If a question has sub-parts like (a), (b), (c) or i, ii, iii, extract each as a SEPARATE entry.
   - NEVER group sub-parts into one JSON object.
   - Assign a unique "questionId" string for every entry:
     - Whole question  → questionId: "1", "2", "3" …
     - Sub-parts       → questionId: "1a", "1b", "2i", "2ii" …
   - The "number" field holds the INTEGER parent number only (e.g. 1 for Q1(a)).
   - Include the parent instruction in each sub-part text.
   - Example for "Q1. Answer any FOUR: (a) What is OTEC? (b) Define geothermal energy.":
     Entry 1 → questionId "1a", number 1, text "Q1. Answer any FOUR: (a) What is OTEC?"
     Entry 2 → questionId "1b", number 1, text "Q1. Answer any FOUR: (b) Define geothermal energy."
4. Extract COMPLETE question text with exact mathematical notation.
5. PRESERVE ALL MATHEMATICAL NOTATION:
   - Superscripts, subscripts, fractions, Greek letters, symbols — exactly as they appear.
6. ASSIGN MARKS:
   - If marks are explicitly stated (e.g. "[7M]" or "7 marks"), use those.
   - If a section header says "each part carries 7 marks", assign 7 to every sub-part.
   - If marks are NOT stated, estimate based on complexity:
     - 2–5 marks for short / one-liners.
     - 6–10 marks for medium derivations / explanations.
     - 11–20 marks for long / essay questions.
7. DETECT THE SUBJECT — pick ONE of these exact values:
   "mathematics", "science", "languages", "history", "computer_science", "other"

IMPORTANT: Preserve mathematical expressions exactly. Do not simplify or alter notation.

Return ONLY valid JSON — NO extra text, NO markdown fences:
{
  "subject": "mathematics",
  "subjectLabel": "Mathematics",
  "questions": [
    {
      "questionId": "1a",
      "number": 1,
      "text": "Complete question text with exact notation",
      "modelAnswer": "",
      "marks": 10,
      "keywords": []
    }
  ]
}`

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

    if (file.type === 'application/pdf')  return extractFromPDF(file)
    if (file.type.startsWith('image/'))   return extractFromImage(file)
    if (file.type === 'text/plain')       return extractFromText(await file.text())

    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Use PDF, image, or plain text.` },
      { status: 400 },
    )
  } catch (error) {
    console.error('[extract-questions] Unhandled error:', error)
    return NextResponse.json({ error: 'Failed to extract questions' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF  →  unpdf text  OR  Claude Vision (scanned)
// ─────────────────────────────────────────────────────────────────────────────

async function extractFromPDF(file: File): Promise<NextResponse> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const uint8  = new Uint8Array(buffer)

    // ── Try text-based extraction first (fast, cheap) ────────────────────────
    let pdfText = ''
    try {
      const { text } = await extractText(uint8, { mergePages: true })
      pdfText = text.replace(/\s+/g, ' ').trim()
    } catch (parseErr) {
      console.warn('[extract-questions] unpdf failed, falling back to Vision AI:', parseErr)
    }

    if (pdfText && pdfText.length > 50) {
      console.log('[extract-questions] Text-based PDF — using Groq text model')
      const result = await groq.chat.completions.create({
        model: VISION_MODEL,
        messages: [{ role: 'user', content: `${EXTRACTION_PROMPT}\n\nDOCUMENT TEXT:\n${pdfText}` }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 4096,
      })
      return parseAndReturn(result.choices[0].message.content ?? '{}')
    }

    // ── Scanned PDF → Claude Vision ──────────────────────────────────────────
    console.log('[extract-questions] Scanned PDF — using Claude Vision')

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Scanned PDF detected but ANTHROPIC_API_KEY is not configured. ' +
            'Add it to .env, or upload a JPG/PNG instead.',
        },
        { status: 422 },
      )
    }

    const Anthropic  = (await import('@anthropic-ai/sdk')).default
    const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const base64PDF  = buffer.toString('base64')

    const message = await anthropic.messages.create({
      model:      process.env.ANTHROPIC_VISION_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type:   'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64PDF },
            } as any,
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    })

    const rawText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('')

    return parseAndReturn(rawText)
  } catch (error) {
    console.error('[extract-questions] PDF extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract questions from PDF' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Image  →  Sharp auto-crop  →  Groq Llama vision
// ─────────────────────────────────────────────────────────────────────────────

async function extractFromImage(file: File): Promise<NextResponse> {
  try {
    const rawBuffer = Buffer.from(await file.arrayBuffer())

    // ── Auto-crop: remove blank margins & downscale ──────────────────────────
    const { buffer: croppedBuffer, meta: imageOpt } = await autoCropImage(rawBuffer)

    // Build data-URL from the processed (potentially JPEG) buffer
    const mimeType = imageOpt.wasCropped ? 'image/jpeg' : (file.type as 'image/jpeg' | 'image/png' | 'image/webp')
    const dataUrl  = `data:${mimeType};base64,${croppedBuffer.toString('base64')}`

    const result = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text',      text: EXTRACTION_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens:  4096,
    })

    return parseAndReturn(result.choices[0].message.content ?? '{}', imageOpt)
  } catch (error) {
    console.error('[extract-questions] Image extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract questions from image' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plain text
// ─────────────────────────────────────────────────────────────────────────────

async function extractFromText(text: string): Promise<NextResponse> {
  try {
    const result = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [{ role: 'user', content: `${EXTRACTION_PROMPT}\n\nDOCUMENT TEXT:\n${text}` }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens:  4096,
    })
    return parseAndReturn(result.choices[0].message.content ?? '{}')
  } catch (error) {
    console.error('[extract-questions] Text extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract questions from text' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse AI response → validated question list + JSON response
// ─────────────────────────────────────────────────────────────────────────────

interface RawQuestion {
  questionId?: string
  number?: number
  text?: string
  modelAnswer?: string
  marks?: number
  keywords?: string[]
}

const SUBJECT_AGENT_MAP: Record<string, { label: string; agent: string; emoji: string }> = {
  mathematics:      { label: 'Mathematics',     agent: 'Mathematics Expert Agent', emoji: '📐' },
  science:          { label: 'Science',          agent: 'Science Expert Agent',      emoji: '🔬' },
  languages:        { label: 'Languages',        agent: 'Language Expert Agent',     emoji: '📝' },
  history:          { label: 'History',          agent: 'History Expert Agent',      emoji: '📜' },
  computer_science: { label: 'Computer Science', agent: 'CS Expert Agent',           emoji: '💻' },
  other:            { label: 'General',          agent: 'General Expert Agent',      emoji: '📚' },
}

function parseAndReturn(
  raw: string,
  imageOptimization?: ImageOptimizationMeta,
): NextResponse {
  const parsed = extractJSON<{
    questions?: RawQuestion[]
    subject?: string
    subjectLabel?: string
  }>(raw)

  if (!parsed?.questions?.length) {
    console.error('[extract-questions] No questions in AI response:', raw.slice(0, 500))
    return NextResponse.json(
      { error: 'No questions could be extracted. Check the document format and try again.' },
      { status: 422 },
    )
  }

  const questions = parsed.questions.map((q: RawQuestion, index: number) => ({
    id:             randomUUID(),
    questionNumber: q.number ?? index + 1,
    text:           q.text ?? '',
    modelAnswer:    q.modelAnswer ?? '',
    marks:          q.marks ?? 10,
    keywords:       q.keywords ?? [],
    expanded:       true,
  }))

  const subjectKey  = parsed.subject ?? 'other'
  const subjectInfo = SUBJECT_AGENT_MAP[subjectKey] ?? SUBJECT_AGENT_MAP.other

  return NextResponse.json({
    questions,
    subject:       subjectKey,
    subjectLabel:  parsed.subjectLabel ?? subjectInfo.label,
    agentName:     subjectInfo.agent,
    agentEmoji:    subjectInfo.emoji,
    // Included only for image uploads — undefined for PDF / text
    ...(imageOptimization ? { imageOptimization } : {}),
  })
}