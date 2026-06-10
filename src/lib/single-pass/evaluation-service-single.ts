import sharp from 'sharp'
import type { 
  Question, 
  QuestionEvaluation, 
  EvaluationResult, 
  ProgressCallback,
  SemanticScore,
  KeywordAnalysis,
  EvaluationLevel,
  AttemptRatio
} from './types-single'
import { getSinglePassAIProviderClient } from './claude-single'
import type { AIProvider } from '../ai/ai-provider'

// ═════════════════════════════════════════════════════════════════════════════
// SINGLE-PASS EVALUATION SERVICE
// ═════════════════════════════════════════════════════════════════════════════

export async function evaluateAnswersSinglePass(
  questions: Question[],
  originalFile: { file: File | Buffer; fileType: string },
  onProgress?: ProgressCallback,
  level: EvaluationLevel = 'intermediate',
  aiProvider: AIProvider = 'groq'
): Promise<EvaluationResult> {

  const totalMaxMarks = questions.reduce((s, q) => s + q.maxMarks, 0)

  // ═════════════════════════════════════════════════════════════════════════════
  // IMAGE PATH - Single Pass Processing
  // ═════════════════════════════════════════════════════════════════════════════
  if (originalFile.fileType.startsWith('image/')) {
    onProgress?.(25, `Starting single-pass image grading [${level} level]…`)

    // Convert file to buffer
    const buffer = originalFile.file instanceof Buffer 
      ? originalFile.file 
      : Buffer.from(await (originalFile.file as File).arrayBuffer())
    
    const dataUrl = await createImageDataUrl(buffer, originalFile.fileType)

    onProgress?.(40, `Processing ${questions.length} questions with single-pass AI...`)

    // Single-pass evaluation for all questions
    const results = await Promise.all(
      questions.map(async (question, index) => {
        onProgress?.(40 + (index * 50 / questions.length), `Evaluating question ${question.questionNumber}...`)
        
        return await evaluateWithSinglePass(question, dataUrl, level, aiProvider)
      })
    )

    onProgress?.(90, 'Calculating final results...')

    const evaluationResult = buildEvaluationResult(results, questions, totalMaxMarks, level)
    
    onProgress?.(100, 'Single-pass evaluation complete!')
    
    return evaluationResult
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PDF PATH - Placeholder for future implementation
  // ═════════════════════════════════════════════════════════════════════════════
  throw new Error('PDF processing not yet implemented for single-pass evaluation')
}

// ═════════════════════════════════════════════════════════════════════════════
// CORE SINGLE-PASS EVALUATION FUNCTION
// ═════════════════════════════════════════════════════════════════════════════

async function evaluateWithSinglePass(
  question: Question,
  imageDataUrl: string,
  level: EvaluationLevel,
  aiProvider: AIProvider = 'groq'
): Promise<QuestionEvaluation> {
  const ai = getSinglePassAIProviderClient(aiProvider)
  
  try {
    const result = await ai.runComprehensiveEvaluation({
      questionText: question.questionText,
      maxMarks: question.maxMarks,
      modelAnswer: question.modelAnswer || '',
      imageDataUrl: imageDataUrl,
      temperature: 0,
      maxTokens: 4000
    })

    // Process direct evaluation result (no transcription or semantic analysis)
    const evaluation = result.evaluation || {}

    // Generate basic keyword analysis for compatibility
    const answerText = evaluation.reasoning || ''
    const keywordAnalysis = analyzeKeywords(answerText, question.modelAnswer || '')

    return {
      questionNumber: question.questionNumber,
      questionText: question.questionText,
      obtainedMarks: clamp(evaluation.obtainedMarks || 0, 0, question.maxMarks),
      maxMarks: question.maxMarks,
      confidence: clamp(evaluation.confidence || 80, 0, 100),
      strength: evaluation.strengths?.join('; ') || undefined,
      mistakes: evaluation.mistakes?.join('; ') || undefined,
      missingConcepts: evaluation.missingConcepts?.join('; ') || undefined,
      suggestions: evaluation.suggestions?.join('; ') || undefined,
      reasoning: evaluation.reasoning || 'No reasoning provided',
      studentAnswer: 'Direct evaluation - no transcription',
      modelAnswer: question.modelAnswer || '',
      pageNumbers: '1',
      studentAnswerImage: imageDataUrl,
      semanticScore: {
        conceptualCoverage: clamp(evaluation.confidence || 50, 0, 100),
        grammarCoherence: clamp(evaluation.confidence || 50, 0, 100),
        keywordRelevance: clamp(keywordAnalysis.keywordDensity || 50, 0, 100),
        completeness: clamp(evaluation.confidence || 50, 0, 100),
        accuracyScore: clamp(evaluation.obtainedMarks || 0, 0, question.maxMarks) * 100 / question.maxMarks,
        composite: clamp(evaluation.confidence || 50, 0, 100)
      },
      keywordAnalysis,
      evaluationLevel: level
    }
  } catch (error) {
    console.error('Single-pass evaluation failed for question', question.questionNumber, ':', error)
    
    // Return fallback evaluation
    return {
      questionNumber: question.questionNumber,
      questionText: question.questionText,
      obtainedMarks: 0,
      maxMarks: question.maxMarks,
      confidence: 0,
      reasoning: `Single-pass evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      studentAnswer: '',
      modelAnswer: question.modelAnswer || '',
      pageNumbers: '1',
      studentAnswerImage: imageDataUrl,
      semanticScore: {
        conceptualCoverage: 0,
        grammarCoherence: 0,
        keywordRelevance: 0,
        completeness: 0,
        accuracyScore: 0,
        composite: 0
      },
      keywordAnalysis: {
        matchedKeywords: [],
        repeatedKeywords: [],
        isKeywordStuffing: false,
        hasProperGrammarStructure: false,
        keywordDensity: 0
      },
      evaluationLevel: level
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

async function createImageDataUrl(buffer: Buffer, mimeType: string): Promise<string> {
  // Optimize image for AI processing
  const optimizedBuffer = await sharp(buffer)
    .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer()

  return `data:${mimeType};base64,${optimizedBuffer.toString('base64')}`
}

function analyzeKeywords(answerText: string, modelAnswer: string): KeywordAnalysis {
  const answerWords = answerText.toLowerCase().split(/\s+/).filter(Boolean)
  const modelWords = modelAnswer.toLowerCase().split(/\s+/).filter(Boolean)
  
  const matchedKeywords = modelWords.filter(word => answerWords.includes(word))
  const wordCount = answerWords.length
  
  // Check for keyword stuffing (repetition)
  const wordFrequency: Record<string, number> = {}
  answerWords.forEach(word => {
    wordFrequency[word] = (wordFrequency[word] || 0) + 1
  })
  
  const repeatedKeywords = Object.entries(wordFrequency)
    .filter(([_, count]) => count > 3)
    .map(([word, _]) => word)
  
  const isKeywordStuffing = repeatedKeywords.length > 0 || (matchedKeywords.length / wordCount) > 0.3
  const keywordDensity = wordCount > 0 ? (matchedKeywords.length / wordCount) * 100 : 0
  const hasProperGrammarStructure = answerText.includes('.') && answerText.length > 20

  return {
    matchedKeywords,
    repeatedKeywords,
    isKeywordStuffing,
    hasProperGrammarStructure,
    keywordDensity
  }
}

function buildEvaluationResult(
  results: QuestionEvaluation[],
  questions: Question[],
  totalMaxMarks: number,
  level: EvaluationLevel
): EvaluationResult {
  const totalObtainedMarks = results.reduce((sum, result) => sum + result.obtainedMarks, 0)
  const percentage = totalMaxMarks > 0 ? (totalObtainedMarks / totalMaxMarks) * 100 : 0
  const grade = calculateGrade(percentage)
  
  const attemptedQuestions = results.filter(r => r.studentAnswer && r.studentAnswer.trim().length > 0).length
  const attemptRatio: AttemptRatio = {
    attempted: attemptedQuestions,
    total: questions.length,
    ratio: questions.length > 0 ? attemptedQuestions / questions.length : 0
  }

  const lowConfidenceQuestions = results
    .filter(r => r.confidence < 70)
    .map(r => r.questionNumber)

  const overallFeedback = generateOverallFeedback(results, percentage, attemptRatio)

  return {
    totalMarks: totalObtainedMarks,
    maxMarks: totalMaxMarks,
    percentage: Math.round(percentage * 100) / 100,
    grade,
    overallFeedback,
    questionResults: results,
    evaluationLevel: level,
    attemptRatio,
    lowConfidenceQuestions
  }
}

function calculateGrade(percentage: number): string {
  if (percentage >= 90) return 'A+'
  if (percentage >= 85) return 'A'
  if (percentage >= 80) return 'A-'
  if (percentage >= 75) return 'B+'
  if (percentage >= 70) return 'B'
  if (percentage >= 65) return 'B-'
  if (percentage >= 60) return 'C+'
  if (percentage >= 55) return 'C'
  if (percentage >= 50) return 'C-'
  if (percentage >= 45) return 'D'
  return 'F'
}

function generateOverallFeedback(
  results: QuestionEvaluation[],
  percentage: number,
  attemptRatio: AttemptRatio
): string {
  const strengths = results.flatMap(r => r.strength ? [r.strength] : [])
  const mistakes = results.flatMap(r => r.mistakes ? [r.mistakes] : [])
  
  let feedback = `Overall Performance: ${percentage.toFixed(1)}% (${calculateGrade(percentage)})\n\n`
  
  feedback += `Attempt Ratio: ${attemptRatio.attempted}/${attemptRatio.total} questions attempted\n\n`
  
  if (strengths.length > 0) {
    feedback += `Key Strengths:\n- ${strengths.slice(0, 3).join('\n- ')}\n\n`
  }
  
  if (mistakes.length > 0) {
    feedback += `Areas for Improvement:\n- ${mistakes.slice(0, 3).join('\n- ')}\n\n`
  }
  
  if (percentage >= 75) {
    feedback += 'Excellent performance! Keep up the good work.'
  } else if (percentage >= 60) {
    feedback += 'Good performance with room for improvement. Focus on the suggested areas.'
  } else {
    feedback += 'Additional practice recommended. Consider reviewing fundamental concepts.'
  }
  
  return feedback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ═════════════════════════════════════════════════════════════════════════════
// RETRY LOGIC FOR SINGLE-PASS
// ═════════════════════════════════════════════════════════════════════════════

export async function withRetrySinglePass<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | unknown
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt - 1) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
      
      console.warn(`Single-pass operation failed, retrying (${attempt}/${maxRetries}):`, error)
    }
  }
  
  throw lastError
}
