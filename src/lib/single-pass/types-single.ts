import type { AIProvider } from '../ai/ai-provider'

// Reuse existing types from original evaluation service
export interface Question {
  id: string
  questionNumber: number
  questionText: string
  maxMarks: number
  modelAnswer?: string
  rubric?: string
}

export interface QuestionEvaluation {
  questionNumber: number
  questionText: string
  obtainedMarks: number
  maxMarks: number
  confidence: number
  strength?: string
  mistakes?: string
  missingConcepts?: string
  suggestions?: string
  reasoning: string
  studentAnswer?: string
  modelAnswer?: string
  pageNumbers?: string
  studentAnswerImage?: string
  semanticScore?: SemanticScore
  keywordAnalysis?: KeywordAnalysis
  evaluationLevel?: EvaluationLevel
}

export interface EvaluationResult {
  totalMarks: number
  maxMarks: number
  percentage: number
  grade: string
  overallFeedback: string
  questionResults: QuestionEvaluation[]
  evaluationLevel?: EvaluationLevel
  attemptRatio?: AttemptRatio
  lowConfidenceQuestions: number[]
}

export interface SemanticScore {
  conceptualCoverage: number
  grammarCoherence: number
  keywordRelevance: number
  completeness: number
  accuracyScore: number
  composite: number
}

export interface KeywordAnalysis {
  matchedKeywords: string[]
  repeatedKeywords: string[]
  isKeywordStuffing: boolean
  hasProperGrammarStructure: boolean
  keywordDensity: number
}

export type EvaluationLevel = 'beginner' | 'intermediate' | 'expert'

export interface AttemptRatio {
  attempted: number
  total: number
  ratio: number
}

export interface ExtractedAnswer {
  questionNumber: number
  answerText: string
  pageNumbers: number[]
  confidence: number
}

export type ProgressCallback = (progress: number, status: string) => void
