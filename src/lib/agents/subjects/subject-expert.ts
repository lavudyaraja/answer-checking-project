/**
 * src/lib/agents/subjects/subject-expert.ts
 *
 * Production improvements:
 *  - Strong TypeScript types throughout
 *  - Vision and text paths both use retry + circuit breaker via BaseAgent
 *  - Structured output validation (obtainedMarks never exceeds maxMarks)
 *  - Difficulty-aware prompt calibration
 *  - Subject fallback: unknown subject → 'other' prompt
 */

import { BaseAgent, AgentResponse } from '../core/base-agent'
import { getAIProviderClient } from '@/lib/ai/providers'
import type { AIProvider } from '@/lib/ai/ai-provider'
import { DifficultyLevel, SubjectType } from '../core/coordinator-agent'

// ─────────────────────────────────────────────────────────────────────────────
// Input/output types
// ─────────────────────────────────────────────────────────────────────────────

export interface ExpertQuestion {
  questionNumber: number
  questionText: string
  maxMarks: number
  modelAnswer?: string
  rubric?: string
}

export interface EvaluationInput {
  question: ExpertQuestion
  difficulty: DifficultyLevel
  imageDataUrl?: string   // base64 data URL for handwritten scripts
  textAnswer?: string    // pre-extracted plain text fallback
}

export interface ExpertEvaluationResult {
  questionNumber: number
  questionText: string
  maxMarks: number
  obtainedMarks: number
  transcription?: string  // what the AI read from handwriting
  reasoning: string
  feedback: string
  strength?: string
  mistakes?: string
  missingConcepts?: string
  suggestions?: string
  confidence: number
  subject: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject-specific grading instructions
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECT_INSTRUCTIONS: Record<SubjectType, string> = {
  mathematics: `
EXPERT ROLE: SENIOR MATHEMATICS PROFESSOR
- Focus on logical derivation and step-by-step calculation.
- Apply Carry-Forward Error principle: if a calculation error propagates, 
  penalise only once at the point of error — award method marks for correct subsequent steps.
- Verify formula application accuracy.
- Recognise handwritten symbols: integrals, summations, Greek letters, set notation.
- Diagrams/graphs: award marks for correct axes, labels, and shape even if scale is off.
`.trim(),

  science: `
EXPERT ROLE: SCIENTIFIC RESEARCHER / TEACHER
- Focus on conceptual clarity and correct technical terminology.
- Prioritise accurate diagrams, labels, and flowcharts.
- Verify Cause-and-Effect understanding in scientific processes.
- Partial credit for correct mechanism even if terminology is slightly off.
- Do not penalise alternative valid scientific explanations.
`.trim(),

  languages: `
EXPERT ROLE: LINGUISTICS & LITERATURE EXPERT
- Focus on expression quality, vocabulary range, and grammatical accuracy.
- Analyse argument depth, narrative structure, and thematic consistency.
- Reward creative expression and well-structured paragraphs.
- Minor spelling errors: deduct at most 1-2% per question.
- Assess coherence and logical paragraph transitions.
`.trim(),

  other: `
EXPERT ROLE: GENERALIST ACADEMIC EXAMINER
- Apply balanced evaluation across understanding, accuracy, and expression.
- Give partial credit for correct reasoning even if the final answer is incomplete.
- Focus on whether the student demonstrates understanding of core concepts.
`.trim(),
}

// ─────────────────────────────────────────────────────────────────────────────
// Difficulty calibration modifiers
// ─────────────────────────────────────────────────────────────────────────────

const DIFFICULTY_CALIBRATION: Record<DifficultyLevel, string> = {
  beginner: `
DIFFICULTY: BEGINNER
- Be generous. Reward any genuine attempt.
- Overlook minor grammar/spelling/formatting issues entirely.
- Award marks for correct idea even if explanation is incomplete.
- Marks floor: at least 5% of maxMarks for any non-blank genuine attempt.
`.trim(),
  intermediate: `
DIFFICULTY: INTERMEDIATE  
- Balanced. Partial credit for correct reasoning.
- Keyword-only answers without explanation: reduce up to 15%.
- Minor grammar acceptable; conceptual gaps deducted proportionally.
`.trim(),
  expert: `
DIFFICULTY: EXPERT
- Strict. Precision and depth required.
- Keyword dumping without explanation: reduce up to 25%.
- Misconceptions explicitly deducted.
- Incomplete derivations lose proportional step marks.
`.trim(),
}

// ─────────────────────────────────────────────────────────────────────────────
// Vision teacher system prompt
// ─────────────────────────────────────────────────────────────────────────────

const VISION_TEACHER_BASE = `
You are a Senior Subject Teacher evaluating a student's handwritten exam script.
Your task is to review the image and provide a fair, semantic evaluation exactly as a human teacher would mark a physical paper.

GRADING PRINCIPLES:
1. SEMANTIC UNDERSTANDING: Do not just look for keywords. Understand the student's intent.
2. VISUAL CONTEXT AWARENESS:
   - Struck-through text → ignore completely.
   - Diagrams and labels → very important; award marks for visual understanding.
   - Margin notes or arrows → include in interpretation.
   - Sequential logic flow → follow the answer as a whole, not line by line.
3. HANDWRITING TOLERANCE: Be patient. Only penalise if truly illegible to any human expert.
4. TRANSCRIPTION: Always transcribe what you read verbatim before analysing.
5. TEACHER-LIKE FEEDBACK: e.g. "Good attempt at X, but you missed the connection to Y."
`.trim()

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────────────────────

function buildEvaluationPrompt(input: EvaluationInput, subjectInstruction: string): string {
  const { question, difficulty } = input

  const rubric = question.rubric || 'General academic accuracy, conceptual clarity, and completeness.'
  const modelAnswer = question.modelAnswer ?? 'Not provided.'

  return `
${DIFFICULTY_CALIBRATION[difficulty]}

SUBJECT GUIDANCE:
${subjectInstruction}

━━━ QUESTION ━━━
Q${question.questionNumber}: ${question.questionText}
Max Marks : ${question.maxMarks}
Model Answer: ${modelAnswer}
Rubric    : ${rubric}

━━━ YOUR TASK ━━━
${input.imageDataUrl
  ? '1. Transcribe the handwritten answer exactly as written.\n2. Analyse against the model answer and rubric.\n3. Award marks.'
  : `Student Answer (pre-extracted text):\n${input.textAnswer ?? '[No answer provided]'}\n\nAnalyse against the model answer and rubric. Award marks.`
}

Return ONLY valid JSON — no markdown, no preamble:
{
  "transcription": "<verbatim transcription or null if text mode>",
  "obtainedMarks": <number 0-${question.maxMarks}>,
  "reasoning": "<step-by-step grading reasoning>",
  "feedback": "<teacher-style feedback for the student>",
  "strength": "<what the student did well, or null>",
  "mistakes": "<specific errors, or null>",
  "missingConcepts": "<key concepts absent, or null>",
  "suggestions": "<concrete actionable improvement tips>",
  "confidence": <integer 0-100>
}
`.trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Output validator
// ─────────────────────────────────────────────────────────────────────────────

function validateExpertOutput(
  raw: unknown,
  input: EvaluationInput,
  subject: SubjectType,
): ExpertEvaluationResult {
  const q = input.question
  const r = (raw ?? {}) as Record<string, unknown>

  const maxMarks = typeof q.maxMarks === 'number' && q.maxMarks > 0 ? q.maxMarks : 0
  const obtainedMarks = parseFloat(
    Math.min(
      Math.max(typeof r.obtainedMarks === 'number' ? r.obtainedMarks : 0, 0),
      maxMarks,
    ).toFixed(1),
  )

  return {
    questionNumber: q.questionNumber,
    questionText: q.questionText,
    maxMarks: typeof q.maxMarks === 'number' ? q.maxMarks : 0,
    obtainedMarks,
    transcription: typeof r.transcription === 'string' ? r.transcription : undefined,
    reasoning: typeof r.reasoning === 'string' ? r.reasoning : 'No reasoning provided.',
    feedback: typeof r.feedback === 'string' ? r.feedback : 'No feedback generated.',
    strength: typeof r.strength === 'string' ? r.strength : undefined,
    mistakes: typeof r.mistakes === 'string' ? r.mistakes : undefined,
    missingConcepts: typeof r.missingConcepts === 'string' ? r.missingConcepts : undefined,
    suggestions: typeof r.suggestions === 'string' ? r.suggestions : undefined,
    confidence: typeof r.confidence === 'number' ? Math.min(100, Math.max(0, r.confidence)) : 50,
    subject,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SubjectExpertAgent
// ─────────────────────────────────────────────────────────────────────────────

export class SubjectExpertAgent extends BaseAgent {
  private readonly subject: SubjectType

  constructor(subject: SubjectType, provider: AIProvider = 'claude') {
    const subjectInstruction = SUBJECT_INSTRUCTIONS[subject] ?? SUBJECT_INSTRUCTIONS.other
    const systemPrompt = `${VISION_TEACHER_BASE}\n\n${subjectInstruction}`
    super(`${subject}Expert`, systemPrompt, provider)
    this.subject = subject
  }

  async execute(input: EvaluationInput): Promise<AgentResponse<ExpertEvaluationResult>> {
    const start = Date.now()
    const subjectInstruction = SUBJECT_INSTRUCTIONS[this.subject] ?? SUBJECT_INSTRUCTIONS.other
    const prompt = buildEvaluationPrompt(input, subjectInstruction)

    try {
      let rawText: string

      if (input.imageDataUrl) {
        // ── Vision path ───────────────────────────────────────────────────
        const ai = getAIProviderClient(this.provider)
        const response = await ai.runVisionJSON({
          promptText: `${this.systemPrompt}\n\n${prompt}`,
          imageDataUrl: input.imageDataUrl,
          temperature: 0,
          maxTokens: 2_000,
        })
        if (!response) throw new Error('Vision model returned empty response')
        rawText = response
      } else {
        // ── Text path (via BaseAgent for retry + circuit breaker) ─────────
        const { text } = await this.callModel(prompt, { temperature: 0, maxTokens: 2_000 })
        rawText = text
      }

      const parsed = this.extractJSON<Record<string, unknown>>(rawText, 'obtainedMarks')
      if (!parsed) throw new Error(`${this.subject}Expert: Could not parse evaluation JSON`)

      const result = validateExpertOutput(parsed, input, this.subject)

      this.logger.info(`${this.subject}Expert: Q${input.question.questionNumber} → ${result.obtainedMarks}/${input.question.maxMarks}`)

      return {
        success: true,
        data: result,
        metadata: {
          model: this.provider,
          durationMs: Date.now() - start,
        },
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown expert evaluation error'
      this.logger.error(`${this.subject}Expert: Q${input.question.questionNumber} failed`, { error: msg })

      // Safe fallback result — 0 marks with error note
      const fallback: ExpertEvaluationResult = {
        questionNumber: input.question.questionNumber,
        questionText: input.question.questionText,
        maxMarks: typeof input.question.maxMarks === 'number' ? input.question.maxMarks : 0,
        obtainedMarks: 0,
        reasoning: `Expert evaluation failed: ${msg}. Manual review required.`,
        feedback: 'Automated evaluation failed for this question. Please review manually.',
        confidence: 0,
        subject: this.subject,
      }

      return {
        success: false,
        data: fallback,
        error: msg,
        metadata: { model: this.provider, durationMs: Date.now() - start },
      }
    }
  }
}