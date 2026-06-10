/**
 * evaluation-storage.ts */
import {
  Question,
  QuestionEvaluation,
  EvaluationResult,
  ExtractedAnswer
} from '@/types/evaluation'

// ─── Status shape (FIX #17) ──────────────────────────────────────────────────
// Kept local so it doesn't conflict with whatever EvaluationStatus is in types/
export interface TaskStatus {
  progress: number   // 0–100
  status: string     // human-readable label
  completed: boolean
  activeAgent?: string    // which agent is currently running (Coordinator, MathExpert, Reviewer etc.)
  subject?: string        // detected subject (once coordinator runs)
}

// ─── Task shape (FIX #18 adds `error`) ───────────────────────────────────────
export interface EvaluationTask {
  fileId: string
  status: TaskStatus
  result?: EvaluationResult
  extractedAnswers?: ExtractedAnswer[]
  error?: string           // FIX #18: surface failure reason
  createdAt: Date
}

// ─── Abstract store interface (swap for Redis in production) ──────────────────
interface TaskStore {
  get(fileId: string): EvaluationTask | undefined
  set(fileId: string, task: EvaluationTask): void
  delete(fileId: string): void
  entries(): IterableIterator<[string, EvaluationTask]>
}

class InMemoryStore implements TaskStore {
  private map = new Map<string, EvaluationTask>()
  get(fileId: string) { return this.map.get(fileId) }
  set(fileId: string, task: EvaluationTask) { this.map.set(fileId, task) }
  delete(fileId: string) { this.map.delete(fileId) }
  entries() { return this.map.entries() }
}

// ─────────────────────────────────────────────────────────────────────────────

class EvaluationStorage {
  private store: TaskStore

  constructor(store: TaskStore = new InMemoryStore()) {
    this.store = store
  }

  /** Create or fully replace a task entry. */
  setTask(fileId: string, patch: Partial<EvaluationTask>): void {
    const existing = this.store.get(fileId) ?? {
      fileId,
      status: { progress: 0, status: 'Initializing', completed: false },
      createdAt: new Date(),
    }
    // FIX #19: always produce a new object — no in-place mutation
    this.store.set(fileId, {
      ...existing,
      ...patch,
      fileId,                              // never overridden
      createdAt: existing.createdAt,       // never overridden
      status: patch.status ?? existing.status,
    })
  }

  /** Retrieve a task, or undefined if not found. */
  getTask(fileId: string): EvaluationTask | undefined {
    return this.store.get(fileId)
  }

  /** Convenience: update only the progress/status fields. */
  updateStatus(
    fileId: string,
    progress: number,
    status: string,
    completed = false
  ): void {
    const existing = this.store.get(fileId)
    if (!existing) return

    this.setTask(fileId, {
      status: {
        ...existing.status,
        progress,
        status,
        completed
      }
    })
  }

  /** Convenience: update which agent is currently active + subject detected. */
  updateAgent(fileId: string, activeAgent: string, subject?: string): void {
    const existing = this.store.get(fileId)
    if (!existing) return
    this.setTask(fileId, {
      status: {
        ...existing.status,
        activeAgent,
        ...(subject ? { subject } : {})
      }
    })
  }

  /** Convenience: attach a completed result. */
  setResult(fileId: string, result: EvaluationResult): void {
    this.setTask(fileId, {
      result,
      status: { progress: 100, status: 'Complete', completed: true },
    })
  }

  /** FIX #18: Convenience: record a failure so the API can return it. */
  setError(fileId: string, error: string): void {
    this.setTask(fileId, {
      error,
      status: { progress: 0, status: 'Failed', completed: true },
    })
  }

  /** Remove a task from storage. */
  deleteTask(fileId: string): void {
    this.store.delete(fileId)
  }

  /**
   * Remove tasks older than `maxAgeMs` (default 1 hour).
   * FIX #16 note: in serverless this is called manually per-request if needed,
   * since setInterval is unreliable across cold starts.
   */
  cleanup(maxAgeMs = 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAgeMs)
    for (const [fileId, task] of this.store.entries()) {
      if (task.createdAt < cutoff) {
        this.store.delete(fileId)
      }
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
// FIX #16: Use globalThis to survive Next.js hot-reload in dev without creating
// multiple instances. In production serverless each worker still gets its own
// instance — swap `InMemoryStore` for Redis to share state across workers.
const GLOBAL_KEY = '__evaluationStorage__'

declare global {
  // eslint-disable-next-line no-var
  var __evaluationStorage__: EvaluationStorage | undefined
}

if (!globalThis[GLOBAL_KEY]) {
  globalThis[GLOBAL_KEY] = new EvaluationStorage()
}

export const evaluationStorage = globalThis[GLOBAL_KEY] as EvaluationStorage

// FIX #16: setInterval removed — unreliable in serverless.
// Call `evaluationStorage.cleanup()` inside a long-running route handler
// (e.g. the evaluate POST route) instead:
//
//   evaluationStorage.cleanup()   // prune stale tasks on each evaluation start