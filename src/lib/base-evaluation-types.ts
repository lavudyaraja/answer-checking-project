/**
 * Base Evaluation Types
 * 
 * Core types used across all education levels for evaluation.
 */

import type { EvaluationResult } from '@/types/evaluation'
import type { EvaluationLevel, ProgressCallback, SemanticScore, KeywordAnalysis } from './evaluation-service'

// Base question interface
export interface BaseQuestion {
  id: string
  questionNumber: number
  questionText: string
  maxMarks: number
  modelAnswer?: string
}

// Base question evaluation interface
export interface BaseQuestionEvaluation {
  questionNumber: number
  questionText: string
  obtainedMarks: number
  maxMarks: number
  confidence: number
  strength?: string[]
  mistakes?: string[]
  suggestions?: string[]
  reasoning: string
  studentAnswer?: string
  modelAnswer?: string
  pageNumbers?: string
  studentAnswerImage?: string
  semanticScore?: SemanticScore
  keywordAnalysis?: KeywordAnalysis
  evaluationLevel?: EvaluationLevel
}

// Re-export types from evaluation-service
export type { SemanticScore, KeywordAnalysis } from './evaluation-service'

// Mathematics-specific interfaces
export interface MathQuestion extends BaseQuestion {
  questionType: 'algebra' | 'geometry' | 'calculus' | 'statistics' | 'trigonometry' | 'arithmetic'
  requiresGraph?: boolean
  requiresProof?: boolean
  allowedMethods?: string[]
}

export interface MathEvaluation extends BaseQuestionEvaluation {
  questionType: MathQuestion['questionType']
  stepsShown?: string[]
  finalAnswer?: string
  methodologyCorrect?: boolean
  calculationErrors?: string[]
}

// Physics-specific interfaces
export interface PhysicsQuestion extends BaseQuestion {
  topic: 'mechanics' | 'thermodynamics' | 'electromagnetism' | 'optics' | 'quantum' | 'nuclear' | 'waves'
  requiresDiagram?: boolean
  requiresDerivation?: boolean
  experimentalData?: boolean
  unitsRequired?: string[]
  formulas?: string[]
}

export interface PhysicsEvaluation extends BaseQuestionEvaluation {
  topic: PhysicsQuestion['topic']
  formulasUsed?: string[]
  unitsCorrect?: boolean
  diagramAccuracy?: number
  derivationSteps?: string[]
  experimentalMethod?: string[]
  dataAnalysis?: string[]
}

// Chemistry-specific interfaces
export interface ChemistryQuestion extends BaseQuestion {
  topic: 'organic' | 'inorganic' | 'physical' | 'analytical' | 'biochemistry' | 'general'
  requiresEquations?: boolean
  requiresStructures?: boolean
  requiresCalculations?: boolean
  labProcedure?: boolean
  units?: string[]
}

export interface ChemistryEvaluation extends BaseQuestionEvaluation {
  topic: ChemistryQuestion['topic']
  equationsBalanced?: boolean
  structuresCorrect?: boolean
  calculationsAccurate?: boolean
  labProcedureCorrect?: boolean
  nomenclatureCorrect?: boolean
  stoichiometryCorrect?: boolean
  molecularFormulas?: string[]
  reactionMechanism?: string[]
}

// Computer Science-specific interfaces
export interface CodingQuestion extends BaseQuestion {
  language: 'python' | 'javascript' | 'java' | 'cpp' | 'c' | 'csharp' | 'typescript' | 'pseudocode'
  problemType: 'algorithm' | 'data-structure' | 'debugging' | 'optimization' | 'syntax' | 'logic'
  requiresOutput?: boolean
  timeComplexity?: string
  spaceComplexity?: string
  constraints?: string[]
}

export interface CodingEvaluation extends BaseQuestionEvaluation {
  language: CodingQuestion['language']
  problemType: CodingQuestion['problemType']
  syntaxCorrect?: boolean
  logicCorrect?: boolean
  timeComplexityAnalyzed?: string
  spaceComplexityAnalyzed?: string
  codeQuality?: number
  efficiency?: number
  testCasesPassed?: number
  totalTestCases?: number
  edgeCasesHandled?: number
}

// Base evaluation functions that will be implemented by each education level
export interface BaseEvaluator {
  evaluate(
    file: File | Buffer,
    fileType: string,
    questions: BaseQuestion[],
    level: EvaluationLevel,
    onProgress?: ProgressCallback
  ): Promise<EvaluationResult>
}

// ---------------------------------------------------------
// NEW: Multi-Agent Architecture Types
// ---------------------------------------------------------

export type AgentRole = 'COORDINATOR' | 'CS_CODE_EXPERT' | 'SEMANTICAL_EXPERT' | 'SCORING_QA'

// 1. Semantic Analysis Agent Output
export interface SemanticalAgentResult {
  confidence: number
  conceptualDepthScore: number // 0-10
  grammarCoherenceScore: number // 0-10
  keywordRelevanceScore: number // 0-10
  narrativeFlow?: string
  semanticFeedback: string[]
}

// 2. CS & Code Agent Output
export interface CSCodeAgentResult {
  confidence: number
  syntaxCorrect: boolean
  logicCorrect: boolean
  testCasesPassed?: number
  totalTestCases?: number
  timeComplexityAnalyzed?: string
  spaceComplexityAnalyzed?: string
  codeVulnerabilities?: string[]
  technicalFeedback: string[]
}

// 3. Coordinator / Orchestrator Payload
export interface OrchestratorRoutingResult {
  detectedSubject: 'COMPUTER_SCIENCE' | 'HUMANITIES' | 'MATHEMATICS' | 'GENERAL'
  requiredAgents: AgentRole[]
  complexityLevel: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED'
  routingRationale: string
}

// 4. Scoring & Feedback Agent Output
export interface ScoringAgentResult {
  finalObtainedMarks: number
  maxMarks: number
  mergedStrength: string[]
  mergedMistakes: string[]
  mergedSuggestions: string[]
  finalFeedback: string
  readyForDatabase: boolean
}
