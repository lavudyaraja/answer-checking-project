/**
 * src/lib/agents/core/coordinator-agent.ts
 *
 * Production improvements:
 *  - Correct model constant (no hardcoded string)
 *  - Schema validation on routing output
 *  - Confidence threshold gate (< 40 → fallback subject)
 *  - Deterministic temperature (0) for routing decisions
 */

import { BaseAgent, AgentResponse } from './base-agent'
import type { AIProvider } from '@/lib/ai/ai-provider'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SubjectType = 'mathematics' | 'science' | 'languages' | 'other'
export type DifficultyLevel = 'beginner' | 'intermediate' | 'expert'

export interface RoutingDecision {
  subject: SubjectType
  difficulty: DifficultyLevel
  confidence: number
  reasoning: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompts (co-located for easy maintenance)
// ─────────────────────────────────────────────────────────────────────────────

const COORDINATOR_SYSTEM_PROMPT = `
You are the Lead Coordinator Agent for an Advanced AI Educational Evaluation System.
Your sole responsibility in this pass is SUBJECT IDENTIFICATION and DIFFICULTY ROUTING.

RULES:
1. Analyze the provided exam content and identify the primary subject domain.
2. Determine the difficulty calibration level.
3. Return ONLY a JSON object — no preamble, no markdown, no explanation outside the JSON.
4. If you cannot determine the subject with confidence >= 40, set subject to "other".
`.trim()

function buildRoutingPrompt(content: string): string {
  return `
Analyze the following exam content. Identify the subject and difficulty level.

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "subject": "mathematics" | "science" | "languages" | "other",
  "difficulty": "beginner" | "intermediate" | "expert",
  "confidence": <integer 0-100>,
  "reasoning": "<one sentence>"
}

CONTENT:
${content.slice(0, 1_500)}
`.trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema validator
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SUBJECTS = new Set<string>(['mathematics', 'science', 'languages', 'other'])
const VALID_DIFFICULTIES = new Set<string>(['beginner', 'intermediate', 'expert'])

function validateRouting(raw: unknown): RoutingDecision {
  if (!raw || typeof raw !== 'object') throw new Error('Routing response is not an object')
  const r = raw as Record<string, unknown>

  const subject = VALID_SUBJECTS.has(String(r.subject)) ? (r.subject as SubjectType) : 'other'
  const difficulty = VALID_DIFFICULTIES.has(String(r.difficulty))
    ? (r.difficulty as DifficultyLevel)
    : 'intermediate'
  const confidence = typeof r.confidence === 'number' ? Math.min(100, Math.max(0, r.confidence)) : 50
  const reasoning = typeof r.reasoning === 'string' ? r.reasoning : 'No reasoning provided.'

  return { subject, difficulty, confidence, reasoning }
}

// ─────────────────────────────────────────────────────────────────────────────
// CoordinatorAgent
// ─────────────────────────────────────────────────────────────────────────────

export class CoordinatorAgent extends BaseAgent {
  constructor(provider: AIProvider = 'claude') {
    super('Coordinator', COORDINATOR_SYSTEM_PROMPT, provider)
  }

  async execute(content: string): Promise<AgentResponse<RoutingDecision>> {
    const start = Date.now()

    try {
      const { text, usedFallback, retryCount } = await this.callModel(
        buildRoutingPrompt(content),
        { temperature: 0, maxTokens: 300 }, // Routing is deterministic
      )

      const parsed = this.extractJSON<RoutingDecision>(text, 'subject')
      if (!parsed) {
        throw new Error('Coordinator returned unparseable JSON')
      }

      const decision = validateRouting(parsed)

      // If confidence is very low, default to 'other' so we don't mis-calibrate
      if (decision.confidence < 40) {
        this.logger.warn('Coordinator: Low confidence routing — defaulting subject to "other"', {
          original: decision.subject,
          confidence: decision.confidence,
        })
        decision.subject = 'other'
      }

      this.logger.info('Coordinator: Routing decision', decision as unknown as Record<string, unknown>)

      return {
        success: true,
        data: decision,
        metadata: {
          model: usedFallback ? 'groq-fallback' : 'claude-primary',
          durationMs: Date.now() - start,
          retryCount,
          usedFallback,
        },
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown coordination error'
      this.logger.error('Coordinator: Execution failed', { error: msg })

      // Safe default so the orchestrator can continue
      const fallback: RoutingDecision = {
        subject: 'other',
        difficulty: 'intermediate',
        confidence: 0,
        reasoning: 'Fallback — coordinator failed.',
      }

      return {
        success: false,
        data: fallback,
        error: msg,
        metadata: { model: 'none', durationMs: Date.now() - start },
      }
    }
  }
}