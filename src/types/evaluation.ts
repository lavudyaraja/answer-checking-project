export interface Question {
  id: string            // Database primary key
  questionNumber: number // Integer sequence: 1, 2, 3...
  questionText: string
  maxMarks: number
  modelAnswer?: string
  rubric?: string
}

export interface QuestionEvaluation {
  questionId: string    // References Question.id (database primary key)
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
  semanticScore?: any     // Added for evaluation-service
  keywordAnalysis?: any   // Added for evaluation-service
  evaluationLevel?: string // Added for evaluation-service
}

export interface EvaluationResult {
  totalMarks: number
  maxMarks: number
  percentage: number
  grade: string
  overallFeedback: string
  questionResults: QuestionEvaluation[]
  lowConfidenceQuestions: string[]
  evaluationLevel?: string
  attemptRatio?: any
  subject?: string
  difficulty?: string
}

export interface EvaluationStatus {
  progress: number
  status: string
  completed: boolean
  activeAgent?: string
  subject?: string
}

export interface ExtractedAnswer {
  questionId: string
  questionNumber: number
  answerText: string
  pageNumbers: number[]
  confidence: number
}
