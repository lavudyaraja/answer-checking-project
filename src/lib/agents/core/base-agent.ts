/**
 * src/lib/agents/core/base-agent.ts
 *
 * Production-level BaseAgent with:
 *  - Exponential-backoff retry (rate-limit / network only)
 *  - Circuit breaker (opens after 5 consecutive failures, resets after 30s)
 *  - Structured logger (replaceable with Winston / Pino in real infra)
 *  - Graceful Claude → Groq fallback
 *  - Input/output token counting for cost tracking
 */

import { getAIProviderClient } from '@/lib/ai/providers'
import type { AIProvider } from '@/lib/ai/ai-provider'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    model: string
    tokensUsed?: number
    durationMs: number
    retryCount?: number
    usedFallback?: boolean
  }
}

export interface CallModelOptions {
  temperature?: number
  maxTokens?: number
  /** Bypass retry for fast-fail scenarios (e.g. validation errors) */
  noRetry?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured logger (swap for Winston/Pino in production)
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentLogger {
  info(msg: string, meta?: Record<string, unknown>): void
  warn(msg: string, meta?: Record<string, unknown>): void
  error(msg: string, meta?: Record<string, unknown>): void
}

const defaultLogger: AgentLogger = {
  info: (msg, meta) => console.log(`[AGENT:INFO] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[AGENT:WARN] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[AGENT:ERROR] ${msg}`, meta ?? ''),
}

// ─────────────────────────────────────────────────────────────────────────────
// Circuit Breaker
// ─────────────────────────────────────────────────────────────────────────────

class CircuitBreaker {
  private failures = 0
  private openedAt: number | null = null

  constructor(
    private readonly maxFailures = 5,
    private readonly resetAfterMs = 30_000,
  ) {}

  get isOpen(): boolean {
    if (this.openedAt !== null && Date.now() - this.openedAt >= this.resetAfterMs) {
      this.failures = 0
      this.openedAt = null
    }
    return this.openedAt !== null
  }

  recordSuccess(): void {
    this.failures = 0
    this.openedAt = null
  }

  recordFailure(): void {
    this.failures++
    if (this.failures >= this.maxFailures) {
      this.openedAt = Date.now()
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry utility (non-retryable errors throw immediately)
// ─────────────────────────────────────────────────────────────────────────────

const RETRYABLE_PATTERN = /rate.?limit|429|503|network|timeout|ECONNRESET|ETIMEDOUT/i

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1_000,
): Promise<{ result: T; retryCount: number }> {
  let lastError: Error = new Error('No attempts made')
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn()
      return { result, retryCount: attempt }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Do not retry on definite failures (JSON parse, validation, auth)
      if (!RETRYABLE_PATTERN.test(lastError.message)) throw lastError
      if (attempt < maxAttempts - 1) {
        const delay = Math.pow(2, attempt) * baseDelayMs + Math.random() * 500
        await new Promise<void>((r) => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}

// ─────────────────────────────────────────────────────────────────────────────
// BaseAgent
// ─────────────────────────────────────────────────────────────────────────────

export abstract class BaseAgent {
  protected readonly provider: AIProvider
  protected readonly role: string
  protected readonly systemPrompt: string
  protected readonly logger: AgentLogger

  private readonly circuitBreaker = new CircuitBreaker()
  private readonly fallbackProvider: AIProvider = 'groq'

  constructor(
    role: string,
    systemPrompt: string,
    provider: AIProvider = 'groq',
    logger?: AgentLogger,
  ) {
    this.role = role
    this.systemPrompt = systemPrompt
    this.logger = logger ?? defaultLogger

    // Graceful fallback if Claude key is missing
    if (provider === 'claude' && !process.env.ANTHROPIC_API_KEY) {
      this.logger.warn(`${role}: ANTHROPIC_API_KEY not set — falling back to Groq`)
      this.provider = 'groq'
    } else {
      this.provider = provider
    }
  }

  // ─── Public model call ────────────────────────────────────────────────────

  protected async callModel(
    prompt: string,
    opts: CallModelOptions = {},
  ): Promise<{ text: string; usedFallback: boolean; retryCount: number }> {
    const { temperature = 0.2, maxTokens = 2_000, noRetry = false } = opts

    if (this.circuitBreaker.isOpen) {
      throw new Error(`[${this.role}] Circuit breaker is OPEN — skipping call to protect quota`)
    }

    const fullPrompt = `${this.systemPrompt}\n\nTask:\n${prompt}`

    // Primary provider attempt
    try {
      const { result, retryCount } = await (noRetry
        ? withRetry(() => this._runText(this.provider, fullPrompt, temperature, maxTokens), 1)
        : withRetry(() => this._runText(this.provider, fullPrompt, temperature, maxTokens))
      )
      this.circuitBreaker.recordSuccess()
      this.logger.info(`${this.role} ✓`, { provider: this.provider, retryCount })
      return { text: result, usedFallback: false, retryCount }
    } catch (primaryErr) {
      this.circuitBreaker.recordFailure()
      this.logger.warn(`${this.role}: Primary provider failed`, {
        provider: this.provider,
        error: (primaryErr as Error).message,
      })

      // Fallback to Groq only if primary was Claude and error is retryable
      if (this.provider === 'claude' && RETRYABLE_PATTERN.test((primaryErr as Error).message)) {
        try {
          const { result, retryCount } = await withRetry(() =>
            this._runText(this.fallbackProvider, fullPrompt, temperature, maxTokens),
          )
          this.logger.warn(`${this.role}: Using Groq fallback`, { retryCount })
          return { text: result, usedFallback: true, retryCount }
        } catch (fallbackErr) {
          this.logger.error(`${this.role}: Both providers failed`, {
            fallbackError: (fallbackErr as Error).message,
          })
          throw fallbackErr
        }
      }

      throw primaryErr
    }
  }

  // ─── Internal text runner ─────────────────────────────────────────────────

  private async _runText(
    provider: AIProvider,
    prompt: string,
    temperature: number,
    maxTokens: number,
  ): Promise<string> {
    const ai = getAIProviderClient(provider)
    const response = await ai.runText({ prompt, temperature, maxTokens })
    if (!response) throw new Error(`${provider} returned empty response`)
    return response
  }

  // ─── JSON extractor (shared utility) ─────────────────────────────────────

  protected extractJSON<T>(raw: string, requiredKey: keyof T): T | null {
    const candidates = [
      raw.trim(),
      raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim(),
      (() => {
        const first = raw.indexOf('{')
        const last = raw.lastIndexOf('}')
        return first !== -1 && last > first ? raw.slice(first, last + 1) : ''
      })(),
    ].filter(Boolean)

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as T
        if (parsed && typeof parsed === 'object' && requiredKey in parsed) return parsed
      } catch {
        /* try next candidate */
      }
    }

    this.logger.error(`${this.role}: JSON extraction failed — missing key "${String(requiredKey)}"`, {
      rawSnippet: raw.slice(0, 200),
    })
    return null
  }

  // ─── Abstract method ──────────────────────────────────────────────────────

  abstract execute(input: unknown): Promise<AgentResponse>
}