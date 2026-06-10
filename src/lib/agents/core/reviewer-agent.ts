/**
 * src/lib/agents/core/reviewer-agent.ts
 *
 * Production improvements:
 *  - Structured schema validation on every reviewed evaluation
 *  - Partial-result preservation: if AI review corrupts a record, keep original
 *  - Marks clamped to [0, maxMarks] always
 *  - Deterministic temperature = 0 for grading decisions
 *  - Audit trail appended to reasoning
 */

import { BaseAgent, AgentResponse } from './base-agent'
import type { AIProvider } from '@/lib/ai/ai-provider'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewableEvaluation {
  questionNumber: number
  maxMarks: number
  obtainedMarks: number
  reasoning?: string
  feedback?: string
  confidence?: number
  [key: string]: unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

const REVIEWER_SYSTEM_PROMPT = `
You are a Senior Academic Auditor reviewing AI-generated student evaluations.

AUDIT CHECKLIST (apply to EVERY question):
1. CONSISTENCY  — Are marks proportional to stated reasoning?
2. RUBRIC COMPLIANCE — Does the mark respect the question's maxMarks ceiling?
3. TONE — Is feedback professional, constructive, and non-patronising?
4. HALLUCINATION CHECK — Does reasoning reference specific content from the answer, not fabricated details?
5. MARK SANITY — obtainedMarks must be in [0, maxMarks]. Round to 1 decimal.

STRICT OUTPUT RULE:
Return ONLY a JSON object with key "evaluations" containing the corrected array.
Preserve every original field. Only modify: obtainedMarks, reasoning, feedback.
Do NOT add, remove, or rename any other field.
`.trim()

function buildReviewPrompt(evaluations: ReviewableEvaluation[]): string {
  return `
Review the following student evaluations. Apply the audit checklist.
Correct obtainedMarks, reasoning, and feedback where needed.

Return ONLY valid JSON — no markdown, no preamble:
{
  "evaluations": [ ...corrected evaluation objects... ]
}

INPUT EVALUATIONS:
${JSON.stringify(evaluations, null, 2)}
`.trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema validator — ensures AI can't corrupt critical fields
// ─────────────────────────────────────────────────────────────────────────────

function validateAndMerge(
  original: ReviewableEvaluation,
  reviewed: unknown,
): ReviewableEvaluation {
  if (!reviewed || typeof reviewed !== 'object') return original

  const r = reviewed as Record<string, unknown>

  // obtainedMarks: must be a number in [0, maxMarks]
  let obtainedMarks = original.obtainedMarks
  if (typeof r.obtainedMarks === 'number' && !Number.isNaN(r.obtainedMarks)) {
    obtainedMarks = parseFloat(
      Math.min(Math.max(r.obtainedMarks, 0), original.maxMarks).toFixed(1),
    )
  }

  // reasoning: must be a string
  const reasoning =
    typeof r.reasoning === 'string' && r.reasoning.trim()
      ? r.reasoning.trim() + ' [Reviewed by AuditAgent]'
      : (original.reasoning ?? '') + ' [AuditAgent: no change]'

  // feedback: must be a string
  const feedback =
    typeof r.feedback === 'string' && r.feedback.trim()
      ? r.feedback.trim()
      : original.feedback

  // confidence: optional number
  const confidence =
    typeof r.confidence === 'number'
      ? Math.min(100, Math.max(0, r.confidence))
      : original.confidence

  return { ...original, obtainedMarks, reasoning, feedback, confidence }
}

// ─────────────────────────────────────────────────────────────────────────────
// ReviewerAgent
// ─────────────────────────────────────────────────────────────────────────────

export class ReviewerAgent extends BaseAgent {
  constructor(provider: AIProvider = 'claude') {
    super('Reviewer', REVIEWER_SYSTEM_PROMPT, provider)
  }

  async execute(
    evaluations: ReviewableEvaluation[],
  ): Promise<AgentResponse<ReviewableEvaluation[]>> {
    const start = Date.now()

    if (!evaluations.length) {
      return { success: true, data: [], metadata: { model: 'none', durationMs: 0 } }
    }

    try {
      const { text, usedFallback, retryCount } = await this.callModel(
        buildReviewPrompt(evaluations),
        { temperature: 0, maxTokens: 4_000 }, // Grading = deterministic
      )

      const parsed = this.extractJSON<{ evaluations: unknown[] }>(text, 'evaluations')

      // Merge reviewed data back with originals — original is ground truth for structure
      const reviewedArray: unknown[] = parsed?.evaluations ?? []
      const merged: ReviewableEvaluation[] = evaluations.map((orig) => {
        const reviewedItem = reviewedArray.find(
          (r) => r && typeof r === 'object' && (r as Record<string, unknown>).questionNumber === orig.questionNumber,
        )
        return validateAndMerge(orig, reviewedItem)
      })

      this.logger.info(`Reviewer: Audited ${merged.length} evaluations`, {
        usedFallback,
        retryCount,
      })

      return {
        success: true,
        data: merged,
        metadata: {
          model: usedFallback ? 'groq-fallback' : 'claude-primary',
          durationMs: Date.now() - start,
          retryCount,
          usedFallback,
        },
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Review failed'
      this.logger.error('Reviewer: Audit pass failed — returning originals', { error: msg })

      // Safe fallback: return originals unchanged rather than failing the pipeline
      return {
        success: false,
        data: evaluations,
        error: msg,
        metadata: { model: 'none', durationMs: Date.now() - start },
      }
    }
  }
}