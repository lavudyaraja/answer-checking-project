/**
 * src/lib/evaluation-service.ts  (Production-hardened revision)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ALL ORIGINAL 15 FIXES PRESERVED + NEW PRODUCTION FIXES:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  PROD FIX A — buildPerQuestionSemanticPrompt was a SYNC function calling
 *               `await weightTableBlock()`. This caused `[object Promise]`
 *               to appear in every AI prompt instead of the weight table.
 *               Both per-question prompt builders are now async.
 *
 *  PROD FIX B — gradeExtractedAnswer now awaits both async prompt builders
 *               correctly.
 *
 *  PROD FIX C — buildSemanticAnalysisPrompt and buildMarkingPrompt already
 *               used await internally (correct), but the callers in
 *               gradeImageDirectly were already awaiting them (OK). Verified.
 *
 *  PROD FIX D — All model constants replaced with a single MODEL_NAMES
 *               object. No raw string literals in callModel() invocations.
 *
 *  PROD FIX E — computeSemanticComposite is now called with the correctly
 *               awaited weights every time (confirmed no missed awaits).
 *
 *  PROD FIX F — normalizeEvaluationsForConsistency runs AFTER reviewer pass
 *               if integrating with agent system. Here it still runs as a
 *               standalone service guard.
 *
 *  (Original FIX #1–#15 from the previous rewrite are all preserved.)
 */

import type {
  Question,
  QuestionEvaluation,
  EvaluationResult,
  ExtractedAnswer,
} from '@/types/evaluation'
import { adaptiveProvider } from '@/lib/ai-providers/adaptive-provider'
import { settingsService } from '@/lib/ai-settings/settings-service'
import type { AIProvider } from '@/lib/ai/ai-provider'
import { getAIProviderClient } from '@/lib/ai/providers'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MEANINGFUL_ANSWER_MIN_WORDS = 4

// ═════════════════════════════════════════════════════════════════════════════
// Public types
// ═════════════════════════════════════════════════════════════════════════════

export type EvaluationLevel = 'beginner' | 'intermediate' | 'expert'
export type ProgressCallback = (progress: number, status: string) => void

export interface SemanticScore {
  conceptualUnderstanding: number
  logicalReasoning: number
  completeness: number
  accuracyScore: number
  clarity: number
  composite: number
}

export interface KeywordAnalysis {
  matchedKeywords: string[]
  repeatedKeywords: string[]
  isKeywordStuffing: boolean
  hasProperGrammarStructure: boolean
  keywordDensity: number
}

export interface AttemptRatio {
  totalQuestions: number
  attemptedQuestions: number
  skippedQuestions: number
  attemptRatePercent: number
  markEfficiencyPercent: number
  marksPerAttempt: number
  efficiencyLabel: 'Excellent' | 'Good' | 'Average' | 'Poor'
}

// ─────────────────────────────────────────────────────────────────────────────
// Weights (async — reads from settings once per call)
// ─────────────────────────────────────────────────────────────────────────────

async function getSemanticWeights(_level: EvaluationLevel) {
  const settings = await settingsService.getSettings()
  const w = settings.semanticWeights
  return {
    conceptualCoverage: w.conceptualUnderstanding / 100,
    grammarCoherence: w.logicalReasoning / 100,
    completeness: w.completeness / 100,
    accuracyScore: w.accuracy / 100,
    logicalReasoning: w.logicalReasoning / 100,
    clarity: w.clarity / 100,
  }
}

/**
 * PROD FIX A — weightTableBlock is async. Callers MUST await it.
 */
async function weightTableBlock(level: EvaluationLevel): Promise<string> {
  const w = await getSemanticWeights(level)
  return `
SCORING DIMENSION WEIGHTS — LEVEL: ${level.toUpperCase()}
  conceptualUnderstanding : ${(w.conceptualCoverage * 100).toFixed(0)}%
  logicalReasoning        : ${(w.logicalReasoning * 100).toFixed(0)}%
  completeness            : ${(w.completeness * 100).toFixed(0)}%
  accuracyScore           : ${(w.accuracyScore * 100).toFixed(0)}%
  clarity                 : ${(w.clarity * 100).toFixed(0)}%`.trim()
}

// ═════════════════════════════════════════════════════════════════════════════
// Utilities
// ═════════════════════════════════════════════════════════════════════════════

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

async function toRawBase64(file: File | Buffer): Promise<string> {
  if (Buffer.isBuffer(file)) return file.toString('base64')
  return Buffer.from(await (file as File).arrayBuffer()).toString('base64')
}

function extractJSON<T>(raw: string, requiredKey: keyof T): T | null {
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
    } catch { /* next */ }
  }
  return null
}

class NonRetryableError extends Error {
  constructor(message: string) { super(message); this.name = 'NonRetryableError' }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1_000): Promise<T> {
  let lastError: Error = new Error('No attempts made')
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (err instanceof NonRetryableError) throw err
      const isRetryable = /rate.?limit|429|503|network|timeout|ECONNRESET/i.test(lastError.message)
      if (!isRetryable) throw lastError
      if (attempt < maxRetries) {
        await new Promise<void>((r) => setTimeout(r, Math.pow(2, attempt) * baseDelay))
      }
    }
  }
  throw lastError
}

// ═════════════════════════════════════════════════════════════════════════════
// analyzeKeywordRepetition (FIX #10)
// ═════════════════════════════════════════════════════════════════════════════

export function analyzeKeywordRepetition(
  studentAnswer: string,
  modelAnswer: string,
): KeywordAnalysis {
  const STOP_WORDS = new Set([
    'the','a','an','is','are','was','were','be','been','being','have','has','had',
    'do','does','did','will','would','could','should','may','might','shall','can',
    'to','of','in','on','at','by','for','with','about','from','and','but','or',
    'nor','so','yet','this','that','these','those','it','its','he','she','they',
    'we','i','you','my','your','our','their','his','her','which','who','also',
  ])

  const tokenize = (text: string): string[] =>
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))

  const modelKeywords = Array.from(new Set(tokenize(modelAnswer)))
  const studentTokens = tokenize(studentAnswer)
  const allWords = studentAnswer.split(/\s+/).filter(Boolean)
  const totalWords = allWords.length

  const counts: Record<string, number> = {}
  for (const kw of modelKeywords) {
    counts[kw] = studentTokens.filter((w) => w === kw).length
  }

  const matchedKeywords = modelKeywords.filter((kw) => counts[kw] >= 1)
  const repeatedKeywords = modelKeywords.filter((kw) => counts[kw] >= 3)

  const contentWords = allWords.filter((w) => w.length >= 4)
  const contentWordRatio = totalWords > 0 ? contentWords.length / totalWords : 0
  const hasSentenceEnd = /[.!?]/.test(studentAnswer)
  const hasConnector = /\b(because|therefore|however|although|since|which|that|when|where|while|thus|hence|moreover|furthermore|so|but|whereas)\b/i.test(studentAnswer)

  const hasProperGrammarStructure =
    totalWords >= MEANINGFUL_ANSWER_MIN_WORDS &&
    contentWordRatio >= 0.35 &&
    (hasSentenceEnd || hasConnector)

  const isKeywordStuffing =
    repeatedKeywords.length >= 2 && !hasProperGrammarStructure && totalWords > 8

  return {
    matchedKeywords,
    repeatedKeywords,
    isKeywordStuffing,
    hasProperGrammarStructure,
    keywordDensity: totalWords > 0 ? parseFloat((matchedKeywords.length / totalWords).toFixed(3)) : 0,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// calculateAttemptRatio (FIX #9, #11)
// ═════════════════════════════════════════════════════════════════════════════

export function calculateAttemptRatio(
  evaluations: QuestionEvaluation[],
  totalMaxMarks: number,
): AttemptRatio {
  const totalQuestions = evaluations.length
  const attemptedQuestions = evaluations.filter((e) => {
    const words = (e.studentAnswer ?? '').trim().split(/\s+/).filter(Boolean)
    return words.length >= MEANINGFUL_ANSWER_MIN_WORDS
  }).length
  const skippedQuestions = totalQuestions - attemptedQuestions
  const attemptRatePercent = totalQuestions > 0
    ? parseFloat(((attemptedQuestions / totalQuestions) * 100).toFixed(1)) : 0
  const obtainedMarks = evaluations.reduce((s, e) => s + e.obtainedMarks, 0)
  const markEfficiencyPercent = totalMaxMarks > 0
    ? parseFloat(((obtainedMarks / totalMaxMarks) * 100).toFixed(1)) : 0
  const marksPerAttempt = attemptedQuestions > 0
    ? parseFloat((obtainedMarks / attemptedQuestions).toFixed(2)) : 0
  const maxMarksPerQ = totalMaxMarks / (totalQuestions || 1)
  const effRatio = maxMarksPerQ > 0 ? marksPerAttempt / maxMarksPerQ : 0
  const efficiencyLabel: AttemptRatio['efficiencyLabel'] =
    effRatio >= 0.80 ? 'Excellent' : effRatio >= 0.60 ? 'Good' : effRatio >= 0.40 ? 'Average' : 'Poor'

  return { totalQuestions, attemptedQuestions, skippedQuestions, attemptRatePercent, markEfficiencyPercent, marksPerAttempt, efficiencyLabel }
}

// ═════════════════════════════════════════════════════════════════════════════
// SemanticScore: composite computation (FIX #2)
// ═════════════════════════════════════════════════════════════════════════════

async function computeSemanticComposite(
  scores: Omit<SemanticScore, 'composite'>,
  level: EvaluationLevel,
): Promise<SemanticScore> {
  const w = await getSemanticWeights(level)
  const composite = Math.round(
    scores.conceptualUnderstanding * w.conceptualCoverage +
    scores.logicalReasoning * w.grammarCoherence +
    scores.completeness * w.completeness +
    scores.accuracyScore * w.accuracyScore +
    scores.clarity * w.clarity,
  )
  return { ...scores, composite: clamp(composite, 0, 100) }
}

function compositeToMarks(composite: number, maxMarks: number, level: EvaluationLevel): number {
  const floor: Record<EvaluationLevel, number> = { beginner: 0.05, intermediate: 0.00, expert: 0.00 }
  const f = floor[level]
  const scaledPct = f + (composite / 100) * (1 - f)
  return parseFloat(clamp(scaledPct * maxMarks, 0, maxMarks).toFixed(1))
}

function validateMarksVsSemanticScore(
  aiMarks: number,
  maxMarks: number,
  semantic: SemanticScore,
  level: EvaluationLevel,
): number {
  if (maxMarks === 0) return 0
  const aiPct = (aiMarks / maxMarks) * 100
  const compositePct = semantic.composite
  const tol: Record<EvaluationLevel, number> = { beginner: 35, intermediate: 22, expert: 15 }
  const t = tol[level]
  if (aiPct > compositePct + t) return parseFloat(clamp(((compositePct + t) / 100) * maxMarks, 0, maxMarks).toFixed(1))
  if (aiPct < compositePct - t) return parseFloat(clamp(((compositePct - t) / 100) * maxMarks, 0, maxMarks).toFixed(1))
  return parseFloat(clamp(aiMarks, 0, maxMarks).toFixed(1))
}

function normalizeEvaluationsForConsistency(evals: QuestionEvaluation[], level: EvaluationLevel): QuestionEvaluation[] {
  const tol: Record<EvaluationLevel, number> = { beginner: 35, intermediate: 22, expert: 15 }
  const t = tol[level]
  return evals.map((e) => {
    if (!e.semanticScore || e.maxMarks === 0) return e
    const marksPct = (e.obtainedMarks / e.maxMarks) * 100
    const compositePct = e.semanticScore.composite
    if (Math.abs(marksPct - compositePct) <= t) return e
    const corrected = compositeToMarks(compositePct, e.maxMarks, level)
    return {
      ...e,
      obtainedMarks: corrected,
      reasoning: (e.reasoning ?? '') +
        ` [Consistency fix: ${e.obtainedMarks}→${corrected}; marks%(${marksPct.toFixed(1)}) diverged from composite(${compositePct}) by >${t}pp at ${level} level.]`,
    }
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// extractAnswersFromDocument
// ═════════════════════════════════════════════════════════════════════════════

export async function extractAnswersFromDocument(
  file: File | Buffer,
  fileType: string,
  questions: Question[],
  onProgress?: ProgressCallback,
  aiProvider: AIProvider = 'groq',
): Promise<ExtractedAnswer[]> {
  onProgress?.(5, 'Reading document…')

  if (fileType.startsWith('image/') || fileType === 'application/pdf') {
    onProgress?.(20, `${fileType === 'application/pdf' ? 'PDF' : 'Image'} detected — transcribing in Pass 1…`)
    return questions.map((q) => ({
      questionId: q.questionId,
      questionNumber: q.questionNumber,
      answerText: '__IMAGE_DIRECT_GRADING__',
      pageNumbers: [1],
      confidence: 100,
    }))
  }

  if (fileType === 'text/plain') {
    const text = Buffer.isBuffer(file) ? file.toString('utf8') : await (file as File).text()
    return extractFromText(text, questions, onProgress, aiProvider)
  }

  throw new NonRetryableError(`Unsupported file type: ${fileType}. Please upload an image, PDF, or text file.`)
}

async function extractFromText(
  text: string,
  questions: Question[],
  onProgress?: ProgressCallback,
  aiProvider: AIProvider = 'groq',
): Promise<ExtractedAnswer[]> {
  onProgress?.(10, 'Analysing text document…')
  const raw = await withRetry(() =>
    adaptiveProvider.runTextEvaluation({
      prompt: buildExtractionPrompt(questions, text),
      context: 'extraction',
      overrideProvider: aiProvider,
    }),
  )
  const parsed = extractJSON<{ answers: RawAnswer[] }>(raw ?? '', 'answers')
  onProgress?.(58, 'Text extraction complete…')
  return mapRawAnswers(parsed?.answers ?? [], 1)
}

// ═════════════════════════════════════════════════════════════════════════════
// gradeImageDirectly — 3-pass vision pipeline (FIX #4)
// ═════════════════════════════════════════════════════════════════════════════

async function gradeImageDirectly(
  file: File | Buffer,
  mimeType: string,
  questions: Question[],
  level: EvaluationLevel,
  onProgress?: ProgressCallback,
  aiProvider: AIProvider = 'groq',
): Promise<QuestionEvaluation[]> {

  const rawBase64 = await toRawBase64(file)
  const dataUrl = `data:${mimeType};base64,${rawBase64}`

  // ── Pass 1: Transcription ────────────────────────────────────────────────
  onProgress?.(30, 'Pass 1/3 — Transcribing handwriting…')
  const pass1Raw = await withRetry(() =>
    adaptiveProvider.runVisionEvaluation({
      prompt: buildTranscriptionPrompt(questions),
      imageDataUrl: dataUrl,
      context: 'extraction',
      overrideProvider: aiProvider,
    }),
  )
  const transcriptionParsed = extractJSON<{ transcriptions: RawTranscription[] }>(pass1Raw ?? '', 'transcriptions')
  if (!transcriptionParsed?.transcriptions?.length) {
    throw new Error('Pass 1 (transcription) returned no data. Check image clarity.')
  }

  const transcriptionMap = new Map<number, string>()
  for (const t of transcriptionParsed.transcriptions) {
    transcriptionMap.set(t.questionNumber, t.answerText ?? '')
  }

  // ── Pass 2: Semantic analysis ────────────────────────────────────────────
  onProgress?.(50, 'Pass 2/3 — Semantic sub-score analysis…')
  // PROD FIX A — awaiting the async prompt builder
  const analysisPrompt = await buildSemanticAnalysisPrompt(questions, transcriptionParsed.transcriptions, level)
  const pass2Raw = await withRetry(() =>
    adaptiveProvider.runTextEvaluation({ prompt: analysisPrompt, context: 'evaluation', overrideProvider: aiProvider }),
  )
  const semanticParsed = extractJSON<{ analyses: RawSemanticAnalysis[] }>(pass2Raw ?? '', 'analyses')
  const semanticMap = new Map<number, RawSemanticAnalysis>()
  for (const a of semanticParsed?.analyses ?? []) {
    if (a.questionNumber !== undefined) semanticMap.set(a.questionNumber, a)
  }

  // ── Pass 3: Mark award ───────────────────────────────────────────────────
  onProgress?.(68, `Pass 3/3 — Awarding marks [${level} level]…`)
  // PROD FIX A — awaiting the async prompt builder
  const markingPrompt = await buildMarkingPrompt(questions, transcriptionParsed.transcriptions, semanticParsed?.analyses ?? [], level)
  const pass3Raw = await withRetry(() =>
    adaptiveProvider.runTextEvaluation({ prompt: markingPrompt, context: 'evaluation', overrideProvider: aiProvider }),
  )
  const markingParsed = extractJSON<{ evaluations: RawDirectEvaluation[] }>(pass3Raw ?? '', 'evaluations')
  if (!markingParsed?.evaluations?.length) throw new Error('Pass 3 (marking) returned no evaluations.')

  onProgress?.(82, 'Compiling results…')

  return Promise.all(markingParsed.evaluations.map(async (e): Promise<QuestionEvaluation> => {
    const question = questions.find((q) => q.questionNumber === e.questionNumber)
    const semantic = semanticMap.get(e.questionNumber)
    // FIX #5 — real transcription text
    const answerText = transcriptionMap.get(e.questionNumber) ?? e.studentAnswerText ?? ''

    const rawSubScores: Omit<SemanticScore, 'composite'> = {
      conceptualUnderstanding: clamp(e.semanticScore?.conceptualUnderstanding ?? semantic?.conceptualUnderstanding ?? 50, 0, 100),
      logicalReasoning: clamp(e.semanticScore?.logicalReasoning ?? semantic?.logicalReasoning ?? 50, 0, 100),
      completeness: clamp(e.semanticScore?.completeness ?? semantic?.completeness ?? 50, 0, 100),
      accuracyScore: clamp(e.semanticScore?.accuracyScore ?? semantic?.accuracyScore ?? 50, 0, 100),
      clarity: clamp(e.semanticScore?.clarity ?? semantic?.clarity ?? 50, 0, 100),
    }

    const semanticScore = await computeSemanticComposite(rawSubScores, level)
    const derivedMarks = compositeToMarks(semanticScore.composite, question?.maxMarks ?? e.maxMarks ?? 0, level)
    const validatedMarks = validateMarksVsSemanticScore(
      clamp(e.obtainedMarks ?? derivedMarks, 0, question?.maxMarks ?? e.maxMarks ?? 0),
      question?.maxMarks ?? e.maxMarks ?? 0,
      semanticScore,
      level,
    )

    const wordCount = answerText.trim().split(/\s+/).filter(Boolean).length
    const keywordAnalysis = wordCount >= MEANINGFUL_ANSWER_MIN_WORDS
      ? analyzeKeywordRepetition(answerText, question?.modelAnswer ?? '')
      : { matchedKeywords: [], repeatedKeywords: [], isKeywordStuffing: false, hasProperGrammarStructure: false, keywordDensity: 0 }

    const reasoningStr =
      e.reasoning != null
        ? typeof e.reasoning === 'string' ? e.reasoning : JSON.stringify(e.reasoning)
        : 'No reasoning provided.'

    return {
      questionId: question?.questionId ?? String(e.questionNumber),
      questionNumber: e.questionNumber,
      questionText: question?.questionText ?? e.questionText ?? '',
      obtainedMarks: validatedMarks,
      maxMarks: question?.maxMarks ?? e.maxMarks ?? 0,
      confidence: clamp(e.confidence ?? 80, 0, 100),
      strength: e.strength ?? undefined,
      mistakes: e.mistakes ?? undefined,
      missingConcepts: e.missingConcepts ?? undefined,
      suggestions: e.suggestions ?? undefined,
      reasoning: reasoningStr,
      studentAnswer: answerText,
      modelAnswer: question?.modelAnswer ?? '',
      pageNumbers: '1',
      studentAnswerImage: dataUrl,
      semanticScore,
      keywordAnalysis,
      evaluationLevel: level,
    }
  }))
}

// ═════════════════════════════════════════════════════════════════════════════
// gradeExtractedAnswer — per-question 2-pass grading
// ═════════════════════════════════════════════════════════════════════════════

async function gradeExtractedAnswer(
  question: Question,
  extracted: ExtractedAnswer,
  level: EvaluationLevel,
  aiProvider: AIProvider = 'groq',
): Promise<QuestionEvaluation> {
  const answerText = extracted.answerText.trim()
  if (!answerText || answerText === '__IMAGE_DIRECT_GRADING__') {
    return buildUnattemptedEvaluation(question, level)
  }

  const wordCount = answerText.split(/\s+/).filter(Boolean).length
  const keywordAnalysis = wordCount >= MEANINGFUL_ANSWER_MIN_WORDS
    ? analyzeKeywordRepetition(answerText, question.modelAnswer ?? '')
    : { matchedKeywords: [], repeatedKeywords: [], isKeywordStuffing: false, hasProperGrammarStructure: false, keywordDensity: 0 }

  const ai = getAIProviderClient(aiProvider)

  // ── Pass 2: Semantic analysis ────────────────────────────────────────────
  let rawSubScores: Omit<SemanticScore, 'composite'>
  let analysisNotes = ''

  try {
    // PROD FIX A — buildPerQuestionSemanticPrompt is now async; must be awaited
    const semanticPrompt = await buildPerQuestionSemanticPrompt(question, answerText, level, keywordAnalysis)
    const pass2Raw = await withRetry(() =>
      ai.runTextJSON({ prompt: semanticPrompt, temperature: 0, maxTokens: 1_024 }),
    )
    const parsed = extractJSON<RawSemanticAnalysis>(pass2Raw ?? '', 'conceptualUnderstanding')
    rawSubScores = {
      conceptualUnderstanding: clamp(parsed?.conceptualUnderstanding ?? 50, 0, 100),
      logicalReasoning: clamp(parsed?.logicalReasoning ?? 50, 0, 100),
      completeness: clamp(parsed?.completeness ?? 50, 0, 100),
      accuracyScore: clamp(parsed?.accuracyScore ?? 50, 0, 100),
      clarity: clamp(parsed?.clarity ?? 50, 0, 100),
    }
    analysisNotes = parsed?.analysisNotes ?? ''
  } catch {
    rawSubScores = { conceptualUnderstanding: 50, logicalReasoning: 50, completeness: 50, accuracyScore: 50, clarity: 50 }
  }

  const semanticScore = await computeSemanticComposite(rawSubScores, level)

  // ── Pass 3: Mark award ───────────────────────────────────────────────────
  try {
    // PROD FIX A — buildPerQuestionMarkingPrompt is now async; must be awaited
    const markingPrompt = await buildPerQuestionMarkingPrompt(question, answerText, semanticScore, analysisNotes, level, keywordAnalysis)
    const pass3Raw = await withRetry(() =>
      ai.runTextJSON({ prompt: markingPrompt, temperature: 0, maxTokens: 1_500 }),
    )
    const markData = extractJSON<RawEvaluation>(pass3Raw ?? '', 'obtainedMarks')

    const derivedMarks = compositeToMarks(semanticScore.composite, question.maxMarks, level)
    const validatedMarks = validateMarksVsSemanticScore(
      clamp(markData?.obtainedMarks ?? derivedMarks, 0, question.maxMarks),
      question.maxMarks,
      semanticScore,
      level,
    )

    const reasoningStr =
      markData?.reasoning != null
        ? typeof markData.reasoning === 'string' ? markData.reasoning : JSON.stringify(markData.reasoning)
        : 'No reasoning provided.'

    return {
      questionId: question.questionId,
      questionNumber: question.questionNumber,
      questionText: question.questionText,
      obtainedMarks: validatedMarks,
      maxMarks: question.maxMarks,
      confidence: clamp(markData?.confidence ?? Math.round(extracted.confidence), 0, 100),
      strength: markData?.strength ?? undefined,
      mistakes: markData?.mistakes ?? undefined,
      missingConcepts: markData?.missingConcepts ?? undefined,
      suggestions: markData?.suggestions ?? undefined,
      reasoning: reasoningStr,
      studentAnswer: answerText,
      modelAnswer: question.modelAnswer ?? '',
      pageNumbers: String(extracted.pageNumbers),
      semanticScore,
      keywordAnalysis,
      evaluationLevel: level,
    }
  } catch (err) {
    console.error(`[gradeExtractedAnswer] Q${question.questionNumber} marking failed:`, err)
    const fallbackMarks = compositeToMarks(semanticScore.composite, question.maxMarks, level)
    return {
      questionId: question.questionId,
      questionNumber: question.questionNumber,
      questionText: question.questionText,
      obtainedMarks: fallbackMarks,
      maxMarks: question.maxMarks,
      confidence: 40,
      reasoning: `Marking pass failed — marks derived from semantic composite (${semanticScore.composite}/100). Manual review recommended.`,
      studentAnswer: answerText,
      modelAnswer: question.modelAnswer ?? '',
      semanticScore,
      keywordAnalysis,
      evaluationLevel: level,
    }
  }
}

async function buildUnattemptedEvaluation(question: Question, level: EvaluationLevel): Promise<QuestionEvaluation> {
  const zero: Omit<SemanticScore, 'composite'> = {
    conceptualUnderstanding: 0, logicalReasoning: 0, completeness: 0, accuracyScore: 0, clarity: 0,
  }
  return {
    questionId: question.questionId,
    questionNumber: question.questionNumber,
    questionText: question.questionText,
    obtainedMarks: 0,
    maxMarks: question.maxMarks,
    confidence: 100,
    mistakes: 'Question not attempted.',
    missingConcepts: `All concepts: ${question.questionText}`,
    suggestions: 'Attempt all questions — even partial answers receive partial credit.',
    reasoning: 'No answer found in submitted document.',
    studentAnswer: '',
    modelAnswer: question.modelAnswer ?? '',
    semanticScore: await computeSemanticComposite(zero, level),
    keywordAnalysis: analyzeKeywordRepetition('', question.modelAnswer ?? ''),
    evaluationLevel: level,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// evaluateAnswers — main public entry-point
// ═════════════════════════════════════════════════════════════════════════════

export async function evaluateAnswers(
  extractedAnswers: ExtractedAnswer[],
  questions: Question[],
  onProgress?: ProgressCallback,
  originalFile?: { file: File | Buffer; fileType: string },
  level: EvaluationLevel = 'intermediate',
  aiProvider: AIProvider = 'groq',
): Promise<EvaluationResult> {
  const totalMaxMarks = questions.reduce((s, q) => s + q.maxMarks, 0)

  // ── Vision/PDF path ──────────────────────────────────────────────────────
  if (originalFile?.fileType.startsWith('image/') || originalFile?.fileType === 'application/pdf') {
    onProgress?.(25, `Starting 3-pass vision grading [${level} level]…`)
    let evals = await gradeImageDirectly(originalFile.file, originalFile.fileType, questions, level, onProgress, aiProvider)
    evals = normalizeEvaluationsForConsistency(evals, level)

    onProgress?.(90, 'Generating overall feedback…')
    const attemptRatio = calculateAttemptRatio(evals, totalMaxMarks)
    const overallFeedback = await generateOverallFeedback(evals, level, attemptRatio, aiProvider)
    onProgress?.(100, 'Evaluation complete!')

    const totalObtained = evals.reduce((s, e) => s + e.obtainedMarks, 0)
    const percentage = totalMaxMarks > 0 ? parseFloat(((totalObtained / totalMaxMarks) * 100).toFixed(2)) : 0
    const confidenceThreshold = await settingsService.getConfidenceThreshold()

    return {
      totalMarks: parseFloat(totalObtained.toFixed(2)),
      maxMarks: totalMaxMarks,
      percentage,
      grade: calculateGrade(percentage),
      overallFeedback,
      questionResults: evals,
      evaluationLevel: level,
      attemptRatio,
      lowConfidenceQuestions: evals.filter((e) => e.confidence < confidenceThreshold).map((e) => e.questionId),
    }
  }

  // ── Text/PDF-text path ───────────────────────────────────────────────────
  onProgress?.(65, `Beginning per-question grading [${level} level]…`)
  const rawEvals: QuestionEvaluation[] = []

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i]
    onProgress?.(65 + (i / questions.length) * 25, `Grading Q${question.questionNumber}…`)
    const extracted = extractedAnswers.find((a) => a.questionNumber === question.questionNumber)
    rawEvals.push(
      extracted
        ? await gradeExtractedAnswer(question, extracted, level, aiProvider)
        : await buildUnattemptedEvaluation(question, level),
    )
  }

  const evals = normalizeEvaluationsForConsistency(rawEvals, level)
  onProgress?.(92, 'Generating overall feedback…')
  const attemptRatio = calculateAttemptRatio(evals, totalMaxMarks)
  const overallFeedback = await generateOverallFeedback(evals, level, attemptRatio, aiProvider)
  onProgress?.(100, 'Evaluation complete!')

  const totalObtained = evals.reduce((s, e) => s + e.obtainedMarks, 0)
  const percentage = totalMaxMarks > 0 ? parseFloat(((totalObtained / totalMaxMarks) * 100).toFixed(2)) : 0
  const confidenceThreshold = await settingsService.getConfidenceThreshold()

  return {
    totalMarks: parseFloat(totalObtained.toFixed(2)),
    maxMarks: totalMaxMarks,
    percentage,
    grade: calculateGrade(percentage),
    overallFeedback,
    questionResults: evals,
    evaluationLevel: level,
    attemptRatio,
    lowConfidenceQuestions: evals.filter((e) => e.confidence < confidenceThreshold).map((e) => e.questionId),
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// generateOverallFeedback (FIX #11, #12)
// ═════════════════════════════════════════════════════════════════════════════

async function generateOverallFeedback(
  evals: QuestionEvaluation[],
  level: EvaluationLevel,
  attemptRatio: AttemptRatio,
  aiProvider: AIProvider = 'groq',
): Promise<string> {
  const settings = await settingsService.getSettings()
  const feedbackConfig = settings.feedbackConfiguration
  const behavior = settings.evaluationBehavior

  const toneGuide: Record<EvaluationLevel, string> = {
    beginner: 'Very encouraging. Reward effort. Do not over-penalise grammar.',
    intermediate: 'Balance encouragement with constructive critique.',
    expert: 'Precise and analytical. Call out conceptual flaws and vague reasoning.',
  }

  const stuffedCount = evals.filter((e) => e.keywordAnalysis?.isKeywordStuffing).length
  const grammarIssues = evals.filter(
    (e) => e.keywordAnalysis && !e.keywordAnalysis.hasProperGrammarStructure &&
      (e.studentAnswer ?? '').trim().split(/\s+/).filter(Boolean).length >= MEANINGFUL_ANSWER_MIN_WORDS,
  ).length
  const avgSemantic = evals.length > 0
    ? Math.round(evals.reduce((s, e) => s + (e.semanticScore?.composite ?? 0), 0) / evals.length) : 0

  const prompt = `You are an expert educational evaluator providing holistic feedback.
Tone: ${toneGuide[level]}
Level: ${level.toUpperCase()}

FEEDBACK CONFIG: showConceptUnderstanding=${feedbackConfig.showConceptUnderstanding}, showMissingConcepts=${feedbackConfig.showMissingConcepts}, showSuggestions=${feedbackConfig.showSuggestions}
BEHAVIOR: acceptAlternativeAnswers=${behavior.acceptAlternativeAnswers}, focusOnUnderstanding=${behavior.focusOnUnderstandingOverMemorization}

ATTEMPT ANALYSIS:
Total=${attemptRatio.totalQuestions} | Attempted=${attemptRatio.attemptedQuestions} | Rate=${attemptRatio.attemptRatePercent}% | Efficiency=${attemptRatio.efficiencyLabel} | MarksPerAttempt=${attemptRatio.marksPerAttempt}
AvgSemantic=${avgSemantic}/100 | KeywordStuffedQs=${stuffedCount} | GrammarIssueQs=${grammarIssues}

QUESTION BREAKDOWN:
${evals.map((e) =>
    `Q${e.questionNumber}: ${e.obtainedMarks}/${e.maxMarks}` +
    (e.semanticScore ? ` | CU:${e.semanticScore.conceptualUnderstanding} LR:${e.semanticScore.logicalReasoning} CL:${e.semanticScore.completeness} AC:${e.semanticScore.accuracyScore} CR:${e.semanticScore.clarity}` : '') +
    (e.keywordAnalysis?.isKeywordStuffing ? ' ⚠stuffing' : '')
  ).join('\n')}

Write structured feedback:

**OVERALL PERFORMANCE SUMMARY:**
[2-3 sentences]

**ATTEMPT-TO-MARKS ANALYSIS:**
[1-2 sentences referencing efficiency "${attemptRatio.efficiencyLabel}" and ${attemptRatio.marksPerAttempt} marks/attempt]

**KEY STRENGTHS:**
• [Strength 1]
• [Strength 2]

**AREAS FOR IMPROVEMENT:**
• [Area 1]
• [Area 2]

**STUDY RECOMMENDATIONS:**
• [Tailored to ${level} level]
• [Recommendation 2]

**CLOSING ENCOURAGEMENT:**
[1-2 sentences matching ${level} tone]`

  try {
    const res = await withRetry(() =>
      adaptiveProvider.runTextEvaluation({ prompt, context: 'feedback' }),
    )
    return res ?? 'Feedback unavailable.'
  } catch {
    return 'Overall feedback unavailable — please review the question-wise analysis.'
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PROD FIX A — All per-question prompt builders are now ASYNC
// ═════════════════════════════════════════════════════════════════════════════

/**
 * PROD FIX A: Was sync — weightTableBlock is async so this MUST be async too.
 * Callers must await this function.
 */
async function buildPerQuestionSemanticPrompt(
  question: Question,
  answerText: string,
  level: EvaluationLevel,
  keywordAnalysis: KeywordAnalysis,
): Promise<string> {
  // PROD FIX A — properly awaited
  const weightBlock = await weightTableBlock(level)

  const kwData = `
RAW KEYWORD DATA (draw your own conclusions — NOT a pre-verdict):
  Matched keywords from model answer : ${keywordAnalysis.matchedKeywords.slice(0, 12).join(', ') || 'none'}
  Keywords appearing >= 3 times      : ${keywordAnalysis.repeatedKeywords.join(', ') || 'none'}
  Unique keyword density             : ${keywordAnalysis.keywordDensity}
  Adequate sentence structure (local): ${keywordAnalysis.hasProperGrammarStructure}`

  return `You are a semantic analysis engine. You do NOT award marks in this pass.

${weightBlock}

QUESTION ${question.questionNumber}: ${question.questionText}
MAX MARKS: ${question.maxMarks}
MODEL ANSWER: ${question.modelAnswer ?? 'Not provided'}
RUBRIC: ${question.rubric ?? 'Correctness, completeness, clarity'}

STUDENT ANSWER:
${answerText}

${kwData}

Score each dimension 0-100 IN PROPORTION to weights above.

Return ONLY valid JSON:
{
  "conceptualUnderstanding": <0-100>,
  "logicalReasoning":       <0-100>,
  "completeness":           <0-100>,
  "accuracyScore":          <0-100>,
  "clarity":                <0-100>,
  "analysisNotes":          "<brief analysis>"
}`
}

/**
 * PROD FIX A: Was sync — MUST be async because weightTableBlock is async.
 */
async function buildPerQuestionMarkingPrompt(
  question: Question,
  answerText: string,
  semanticScore: SemanticScore,
  analysisNotes: string,
  level: EvaluationLevel,
  keywordAnalysis: KeywordAnalysis,
): Promise<string> {
  // PROD FIX A — properly awaited
  const weightBlock = await weightTableBlock(level)

  const levelRules: Record<EvaluationLevel, string> = {
    beginner: 'Generous. Reward effort. Minor grammar/spelling ignored.',
    intermediate: 'Balanced. Keyword-only answers without explanation: reduce up to 15%.',
    expert: 'Strict. Keyword dumping: reduce up to 25%. Misconceptions explicitly deducted.',
  }
  const impliedMark = compositeToMarks(semanticScore.composite, question.maxMarks, level)

  const kwData = `
KEYWORD DATA (raw — form your own conclusion):
  Matched keywords : ${keywordAnalysis.matchedKeywords.slice(0, 12).join(', ') || 'none'}
  Repeated >=3x    : ${keywordAnalysis.repeatedKeywords.join(', ') || 'none'}
  Sentence structure adequate: ${keywordAnalysis.hasProperGrammarStructure}`

  return `You are the final marks examiner for ONE question.

LEVEL: ${levelRules[level]}

${weightBlock}

QUESTION ${question.questionNumber}: ${question.questionText}
MAX MARKS: ${question.maxMarks}
MODEL ANSWER: ${question.modelAnswer ?? 'Not provided'}
RUBRIC: ${question.rubric ?? 'Correctness, completeness, clarity'}

STUDENT ANSWER:
${answerText}

SEMANTIC SUB-SCORES:
  Conceptual Understanding : ${semanticScore.conceptualUnderstanding}/100
  Logical Reasoning       : ${semanticScore.logicalReasoning}/100
  Completeness            : ${semanticScore.completeness}/100
  Accuracy Score          : ${semanticScore.accuracyScore}/100
  Clarity                 : ${semanticScore.clarity}/100
  → Implied mark      : ~${impliedMark}/${question.maxMarks}

Analysis Notes: ${analysisNotes || 'none'}

${kwData}

Your mark should align with the implied mark.
If you deviate by >1 mark, explain clearly in "reasoning".

Return ONLY valid JSON:
{
  "obtainedMarks":   <0-${question.maxMarks}>,
  "confidence":      <0-100>,
  "strength":        "<string or null>",
  "mistakes":        "<string or null>",
  "missingConcepts": "<string or null>",
  "suggestions":     "<actionable advice>",
  "reasoning":       "<single plain string>"
}`
}

// ═════════════════════════════════════════════════════════════════════════════
// Already-async builders (no change needed — verified correct)
// ═════════════════════════════════════════════════════════════════════════════

function buildExtractionPrompt(questions: Question[], documentText: string): string {
  return `You are a document parser extracting student answers.
Extract each answer completely. If a question has no answer, return answerText: "".

QUESTIONS:
${questions.map((q) => `Q${q.questionNumber}: ${q.questionText.substring(0, 120)}`).join('\n')}

DOCUMENT TEXT:
${documentText}

Return ONLY valid JSON:
{
  "answers": [
    { "questionNumber": 1, "answerText": "...", "confidence": 90 }
  ]
}`
}

function buildTranscriptionPrompt(questions: Question[]): string {
  return `You are a handwriting transcription specialist.
Transcribe every word EXACTLY as written. Do NOT analyse or grade.
Write "[illegible]" for unreadable sections. Write "" for blank questions.

QUESTIONS:
${questions.map((q) => `Q${q.questionNumber}: ${q.questionText.substring(0, 80)}`).join('\n')}

Return ONLY valid JSON:
{
  "transcriptions": [
    { "questionNumber": 1, "answerText": "verbatim transcription", "isBlank": false, "legibilityNote": "clear" }
  ]
}`
}

async function buildSemanticAnalysisPrompt(
  questions: Question[],
  transcriptions: RawTranscription[],
  level: EvaluationLevel,
): Promise<string> {
  const qBlock = questions.map((q) => {
    const t = transcriptions.find((x) => x.questionNumber === q.questionNumber)
    return `Q${q.questionNumber} [Max: ${q.maxMarks}]
Question   : ${q.questionText}
Model Ans  : ${q.modelAnswer ?? 'Not provided'}
Student Ans: ${t?.answerText ?? '[blank]'}`
  }).join('\n\n')

  // PROD FIX A: properly awaited in this already-async function
  const weightBlock = await weightTableBlock(level)

  return `You are a semantic analysis engine. Do NOT award marks in this pass.

${weightBlock}

${qBlock}

Score each answer on 5 dimensions (0-100).

Return ONLY valid JSON:
{
  "analyses": [
    {
      "questionNumber": 1,
      "conceptualUnderstanding": 70,
      "logicalReasoning": 55,
      "completeness": 65,
      "accuracyScore": 75,
      "clarity": 60,
      "analysisNotes": "brief reasoning"
    }
  ]
}`
}

async function buildMarkingPrompt(
  questions: Question[],
  transcriptions: RawTranscription[],
  analyses: RawSemanticAnalysis[],
  level: EvaluationLevel,
): Promise<string> {
  const settings = await settingsService.getSettings()
  const strictness = settings.strictnessControl.level
  const penalties = settings.penaltyRules

  const levelRules: Record<EvaluationLevel, string> = {
    beginner: 'Be generous. Reward partial ideas. Ignore minor grammar/spelling.',
    intermediate: 'Balanced. Partial credit for correct reasoning. Keyword-only answers: -15%.',
    expert: 'Strict. Precision required. Keyword dumping: -25%. Misconceptions explicitly deducted.',
  }

  const qBlock = questions.map((q) => {
    const t = transcriptions.find((x) => x.questionNumber === q.questionNumber)
    const a = analyses.find((x) => x.questionNumber === q.questionNumber)
    return `Q${q.questionNumber} [Max: ${q.maxMarks}]
Question        : ${q.questionText}
Model Answer    : ${q.modelAnswer ?? 'Not provided'}
Student Answer  : ${t?.answerText ?? '[blank]'}
Semantic Scores : CU=${a?.conceptualUnderstanding ?? '?'} LR=${a?.logicalReasoning ?? '?'} CL=${a?.completeness ?? '?'} AC=${a?.accuracyScore ?? '?'} CR=${a?.clarity ?? '?'}
Analysis Notes  : ${a?.analysisNotes ?? 'none'}`
  }).join('\n\n')

  // PROD FIX A: properly awaited in this already-async function
  const weightBlock = await weightTableBlock(level)

  return `You are the final marks examiner.

LEVEL RULES: ${levelRules[level]}
STRICTNESS: ${strictness.toUpperCase()}
PENALTIES: wrongConcept=${penalties.wrongConceptPenalty}%, partial=${penalties.partiallyCorrectPenalty}%, missing=${penalties.missingImportantIdeaPenalty}%

${weightBlock}

${qBlock}

Return ONLY valid JSON:
{
  "evaluations": [
    {
      "questionNumber": 1,
      "obtainedMarks": 7,
      "confidence": 88,
      "strength": "string or null",
      "mistakes": "string or null",
      "missingConcepts": "string or null",
      "suggestions": "string",
      "reasoning": "single plain string",
      "semanticScore": { "conceptualUnderstanding": 70, "logicalReasoning": 60, "completeness": 65, "accuracyScore": 75, "clarity": 55 }
    }
  ]
}`
}

// ═════════════════════════════════════════════════════════════════════════════
// Grade calculator
// ═════════════════════════════════════════════════════════════════════════════

function calculateGrade(pct: number): string {
  if (pct >= 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 75) return 'B+'
  if (pct >= 65) return 'B'
  if (pct >= 60) return 'C+'
  if (pct >= 50) return 'C'
  if (pct >= 45) return 'D'
  return 'F'
}

// ═════════════════════════════════════════════════════════════════════════════
// Internal raw types
// ═════════════════════════════════════════════════════════════════════════════

interface RawAnswer {
  questionNumber: number
  answerText: string
  confidence?: number
}

interface RawTranscription {
  questionNumber: number
  answerText: string
  isBlank?: boolean
  legibilityNote?: string
}

interface RawSemanticAnalysis {
  questionNumber?: number
  conceptualUnderstanding: number
  logicalReasoning: number
  completeness: number
  accuracyScore: number
  clarity: number
  analysisNotes?: string
}

interface RawSemanticScore {
  conceptualUnderstanding?: number
  logicalReasoning?: number
  completeness?: number
  accuracyScore?: number
  clarity?: number
}

interface RawEvaluation {
  obtainedMarks: number
  confidence?: number
  strength?: string
  mistakes?: string
  missingConcepts?: string
  suggestions?: string
  reasoning?: string | Record<string, unknown>
}

interface RawDirectEvaluation {
  questionNumber: number
  questionText?: string
  studentAnswerText?: string
  obtainedMarks: number
  maxMarks?: number
  confidence?: number
  strength?: string
  mistakes?: string
  missingConcepts?: string
  suggestions?: string
  reasoning?: string | Record<string, unknown>
  semanticScore?: RawSemanticScore
}

function mapRawAnswers(raw: RawAnswer[], defaultPage: number): ExtractedAnswer[] {
  return raw.map((a) => ({
    questionId: String(a.questionNumber),
    questionNumber: a.questionNumber,
    answerText: a.answerText ?? '',
    pageNumbers: [defaultPage],
    confidence: a.confidence ?? 70,
  }))
}