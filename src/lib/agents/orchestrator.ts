/**
 * src/lib/agents/orchestrator.ts
 *
 * Production improvements:
 *  - Parallel question evaluation with configurable concurrency limit
 *  - Progress callbacks at every stage
 *  - Per-question timeout guard
 *  - Partial failure resilience: one bad question doesn't kill the pipeline
 *  - Full audit trail in result metadata
 *  - Singleton export for framework-level reuse
 */

import { CoordinatorAgent, RoutingDecision } from './core/coordinator-agent'
import { SubjectExpertAgent, EvaluationInput, ExpertEvaluationResult } from './subjects/subject-expert'
import { ReviewerAgent, ReviewableEvaluation } from './core/reviewer-agent'
import type { AIProvider } from '@/lib/ai/ai-provider'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OrchestratorQuestion {
  questionId: string
  questionNumber: number
  questionText: string
  maxMarks: number
  modelAnswer?: string
  rubric?: string
}

export interface OrchestratorOptions {
  /** Max parallel expert evaluations (default: 3) */
  concurrency?: number
  /** Per-question timeout in ms (default: 45_000) */
  questionTimeoutMs?: number
  /** Skip the reviewer pass (faster, less reliable) */
  skipReview?: boolean
  /** AI provider to use across all agents */
  provider?: AIProvider
}

export type ProgressCallback = (progressPct: number, status: string) => void

export interface OrchestrationResult {
  fileId: string
  subject: string
  difficulty: string
  routing: RoutingDecision
  evaluations: ExpertEvaluationResult[]
  totalMarks: number
  maxMarks: number
  percentage: number
  overallFeedback: string
  metadata: {
    totalDurationMs: number
    agentsUsed: string[]
    questionsFailed: number[]
    reviewApplied: boolean
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Concurrency pool
// ─────────────────────────────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let index = 0

  async function worker() {
    while (index < tasks.length) {
      const current = index++
      results[current] = await tasks[current]()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker)
  await Promise.all(workers)
  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-question timeout guard
// ─────────────────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[Timeout] ${label} exceeded ${ms}ms`)),
      ms,
    )
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// EvaluationOrchestrator
// ─────────────────────────────────────────────────────────────────────────────

export class EvaluationOrchestrator {
  private readonly coordinator: CoordinatorAgent
  private readonly reviewer: ReviewerAgent
  private readonly provider: AIProvider

  constructor(provider: AIProvider = 'claude') {
    this.provider = provider
    this.coordinator = new CoordinatorAgent(provider)
    this.reviewer = new ReviewerAgent(provider)
  }

  async runFullEvaluation(
    fileId: string,
    questions: OrchestratorQuestion[],
    imageDataUrl: string,
    opts: OrchestratorOptions = {},
    onProgress?: ProgressCallback,
  ): Promise<OrchestrationResult> {
    const {
      concurrency = 3,
      questionTimeoutMs = 45_000,
      skipReview = false,
    } = opts

    const start = Date.now()
    const agentsUsed: string[] = []
    const questionsFailed: number[] = []

    // ── Step 1: Coordinate (5%) ──────────────────────────────────────────
    onProgress?.(5, 'Identifying subject and difficulty…')
    agentsUsed.push('CoordinatorAgent')

    const firstQuestion = questions[0]?.questionText ?? ''
    const coordResult = await this.coordinator.execute(
      `File: ${fileId}. First question: ${firstQuestion}`,
    )
    const routing = coordResult.data!
    const { subject, difficulty } = routing

    onProgress?.(15, `Subject: ${subject} | Difficulty: ${difficulty} — initialising expert…`)

    // ── Step 2: Parallel Expert Evaluation (15% → 75%) ──────────────────
    agentsUsed.push(`${subject}ExpertAgent`)
    const expert = new SubjectExpertAgent(subject, this.provider)

    const progressStep = 60 / questions.length // spread 60% across questions

    let completedCount = 0

    const tasks = questions.map((q) => async () => {
      const input: EvaluationInput = {
        question: q,
        difficulty,
        imageDataUrl,
      }

      try {
        const result = await withTimeout(
          expert.execute(input),
          questionTimeoutMs,
          `Q${q.questionNumber}`,
        )
        completedCount++
        onProgress?.(
          15 + Math.round(completedCount * progressStep),
          `Evaluated Q${q.questionNumber} (${completedCount}/${questions.length})`,
        )
        return result.data!
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[Orchestrator] Q${q.questionNumber} failed: ${msg}`)
        questionsFailed.push(q.questionNumber)
        completedCount++
        onProgress?.(
          15 + Math.round(completedCount * progressStep),
          `Q${q.questionNumber} failed — using fallback (${completedCount}/${questions.length})`,
        )
        // Return a zero-mark safe fallback
        return {
          questionId: q.questionId,
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          maxMarks: q.maxMarks,
          obtainedMarks: 0,
          reasoning: `Evaluation failed: ${msg}. Manual review required.`,
          feedback: 'Automated evaluation failed for this question.',
          confidence: 0,
          subject,
        } satisfies ExpertEvaluationResult
      }
    })

    const rawEvaluations = await runWithConcurrency(tasks, concurrency)

    // ── Step 3: Reviewer Pass (75% → 92%) ───────────────────────────────
    let finalEvaluations: ExpertEvaluationResult[]

    if (skipReview) {
      finalEvaluations = rawEvaluations
      onProgress?.(92, 'Review pass skipped…')
    } else {
      onProgress?.(76, 'Auditing evaluations for consistency…')
      agentsUsed.push('ReviewerAgent')

      const reviewInput: ReviewableEvaluation[] = rawEvaluations.map((e) => ({
        questionNumber: e.questionNumber,
        maxMarks: e.maxMarks,
        obtainedMarks: e.obtainedMarks,
        reasoning: e.reasoning,
        feedback: e.feedback,
        confidence: e.confidence,
      }))

      const reviewResult = await this.reviewer.execute(reviewInput)

      // Merge reviewer corrections back into full evaluation objects
      finalEvaluations = rawEvaluations.map((orig) => {
        const corrected = reviewResult.data?.find(
          (r) => r.questionNumber === orig.questionNumber,
        )
        if (!corrected) return orig
        return {
          ...orig,
          obtainedMarks: corrected.obtainedMarks,
          reasoning: corrected.reasoning ?? orig.reasoning,
          feedback: (corrected.feedback as string | undefined) ?? orig.feedback,
          confidence: corrected.confidence ?? orig.confidence,
        }
      })

      onProgress?.(92, 'Audit complete…')
    }

    // ── Step 4: Compute totals (92% → 100%) ─────────────────────────────
    const totalMaxMarks = questions.reduce((s, q) => s + q.maxMarks, 0)
    const totalObtained = parseFloat(
      finalEvaluations.reduce((s, e) => s + e.obtainedMarks, 0).toFixed(2),
    )
    const percentage =
      totalMaxMarks > 0
        ? parseFloat(((totalObtained / totalMaxMarks) * 100).toFixed(2))
        : 0

    const reviewApplied = !skipReview
    const duration = Date.now() - start

    onProgress?.(100, 'Evaluation complete!')

    return {
      fileId,
      subject,
      difficulty,
      routing,
      evaluations: finalEvaluations,
      totalMarks: totalObtained,
      maxMarks: totalMaxMarks,
      percentage,
      overallFeedback: this.buildOverallFeedback(
        subject,
        difficulty,
        percentage,
        finalEvaluations,
        reviewApplied,
      ),
      metadata: {
        totalDurationMs: duration,
        agentsUsed,
        questionsFailed,
        reviewApplied,
      },
    }
  }

  // ─── Summary feedback builder ─────────────────────────────────────────────

  private buildOverallFeedback(
    subject: string,
    difficulty: string,
    percentage: number,
    evaluations: ExpertEvaluationResult[],
    reviewApplied: boolean,
  ): string {
    const avgConf = Math.round(
      evaluations.reduce((s, e) => s + e.confidence, 0) / (evaluations.length || 1),
    )
    const reviewNote = reviewApplied
      ? 'Results audited by the Reviewer Agent for consistency.'
      : 'Quick mode: review pass skipped.'

    return (
      `${subject.charAt(0).toUpperCase() + subject.slice(1)} evaluation completed at ` +
      `${difficulty} level. Score: ${percentage.toFixed(1)}%. ` +
      `Average AI confidence: ${avgConf}%. ${reviewNote}`
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton for framework-level use (Next.js API routes, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export const orchestrator = new EvaluationOrchestrator()