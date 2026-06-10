import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractAnswersFromDocument } from '@/lib/evaluation-service'
import { evaluationStorage } from '@/lib/evaluation-storage'
import { CoordinatorAgent, SubjectType } from '@/lib/agents/core/coordinator-agent'
import { SubjectExpertAgent } from '@/lib/agents/subjects/subject-expert'
import { ReviewerAgent } from '@/lib/agents/core/reviewer-agent'
import type { AIProvider } from '@/lib/ai/ai-provider'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const examId = formData.get('examId') as string
    const studentName = formData.get('studentName') as string
    const rollNumber = formData.get('rollNumber') as string
    const notes = formData.get('notes') as string
    const answerSheet = formData.get('answerSheet') as File
    const aiProviderRaw = formData.get('aiProvider') as string
    const aiProvider: AIProvider = aiProviderRaw === 'claude' ? 'claude' : 'groq'
    const difficultyRaw = (formData.get('difficulty') as string) ?? 'auto'
    const difficulty = (['beginner', 'intermediate', 'expert', 'auto'] as const).includes(difficultyRaw as any)
      ? (difficultyRaw as 'beginner' | 'intermediate' | 'expert' | 'auto')
      : 'auto'

    // Detailed validation with specific error messages
    const missingFields: string[] = []
    if (!examId) missingFields.push('examId')
    if (!studentName || !studentName.trim()) missingFields.push('studentName')
    if (!answerSheet) missingFields.push('answerSheet')

    if (missingFields.length > 0) {
      console.log('Student API - Missing fields:', missingFields)
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Fetch exam with questions
    const exam = await db.exam.findUnique({
      where: { id: examId },
      include: { questions: true },
    })

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
    }

    // Generate a unique evaluation ID
    const evaluationId = `eval_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    // Initialize the evaluation task in storage
    evaluationStorage.setTask(evaluationId, {
      fileId: evaluationId,
      status: {
        progress: 0,
        status: 'Initializing...',
        completed: false,
      },
      createdAt: new Date(),
    })

    // Kick off evaluation in the background (non-blocking)
    console.log(`Starting background multi-agent evaluation for ID: ${evaluationId}`)
    processEvaluation(evaluationId, exam, answerSheet, studentName, rollNumber, notes, aiProvider, difficulty).catch(
      (error: unknown) => {
        console.error('Background evaluation failed:', error)
        console.error('Error details:', error instanceof Error ? error.stack : error)
        evaluationStorage.updateStatus(
          evaluationId,
          0,
          `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          true
        )
      }
    )

    return NextResponse.json({ evaluationId, message: 'Evaluation started' })
  } catch (error) {
    console.error('Error in evaluate API:', error)
    return NextResponse.json({ error: 'Failed to start evaluation' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Background processing
// ---------------------------------------------------------------------------

async function processEvaluation(
  evaluationId: string,
  exam: any,
  answerSheet: File,
  studentName: string,
  rollNumber: string,
  notes: string,
  aiProvider: AIProvider,
  difficulty: 'beginner' | 'intermediate' | 'expert' | 'auto'
) {
  console.log(`Multi-agent evaluation started for ${evaluationId}`)
  const onProgress = (progress: number, status: string, agent?: string) => {
    evaluationStorage.updateStatus(evaluationId, progress, status)
    if (agent) evaluationStorage.updateAgent(evaluationId, agent)
  }

  try {
    // Prepare questions for multi-agent system
    const questions = exam.questions.map((q: any) => ({
      id: q.id, // Keep the database ID
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      maxMarks: q.maxMarks,
      rubric: q.rubric,
    }))

    // Validate questions
    if (!questions || questions.length === 0) {
      throw new Error('No valid questions found for evaluation')
    }

    // ── Auto-determine difficulty if set to 'auto' ───────────────────────────────
    let actualDifficulty: 'beginner' | 'intermediate' | 'expert'
    if (difficulty === 'auto') {
      try {
        const totalMarks = questions.reduce((sum, q) => sum + (q.maxMarks || 0), 0)
        const avgQuestionLength = questions.length > 0 
          ? questions.reduce((sum, q) => sum + (q.questionText?.length || 0), 0) / questions.length
          : 0
        
        if (totalMarks <= 50 && avgQuestionLength < 200) {
          actualDifficulty = 'beginner'
        } else if (totalMarks <= 100 && avgQuestionLength < 400) {
          actualDifficulty = 'intermediate'
        } else {
          actualDifficulty = 'expert'
        }
        
        onProgress(15, `Auto-balancing: Selected ${actualDifficulty} difficulty`, 'Coordinator')
      } catch (error) {
        console.error('Auto-balancing failed:', error)
        actualDifficulty = 'intermediate'
        onProgress(15, `Auto-balancing failed, using ${actualDifficulty} difficulty`, 'Coordinator')
      }
    } else {
      actualDifficulty = difficulty
    }

    // ── Step 1: Coordinator detects subject ─────────────────────────────────
    onProgress(10, 'Coordinator: Analyzing subject…', 'Coordinator')
    const coordinator = new CoordinatorAgent(aiProvider)
    const coordResult = await coordinator.execute(
      `File: ${answerSheet.name}, Questions (${questions.length}): ${questions.map(q => q.questionText).slice(0, 3).join(' | ')}`
    )

    const subject: SubjectType = coordResult.data?.subject as SubjectType ?? 'other'
    onProgress(20, `Coordinator: Subject detected — ${subject}`, 'Coordinator')

    // ── Step 2: Convert image to base64 ─────────────────────────────────────
    onProgress(25, 'Preparing document for Vision Expert…', 'System')
    const arrayBuffer = await answerSheet.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const imageDataUrl = `data:${answerSheet.type};base64,${base64}`

    // ── Step 3: Determine optimal provider for file type ───────────────────
    let effectiveProvider = aiProvider
    if (answerSheet.type === 'application/pdf' && aiProvider === 'groq') {
      effectiveProvider = 'claude'
      console.log(`Auto-switching to Claude for PDF processing (user selected: ${aiProvider})`)
    }
    
    // ── Step 4: Subject Expert grades each question ─────────────────────────
    const expert = new SubjectExpertAgent(subject, effectiveProvider)
    const rawEvaluations: any[] = []
    const totalQuestions = questions.length

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      
      if (!question) {
        console.warn(`Question at index ${i} is undefined, skipping`)
        continue
      }
      
      const progressBase = 25 + Math.round(((i + 1) / totalQuestions) * 50)
      onProgress(progressBase, `${subject} Expert: Grading Q${question.questionNumber || i + 1} (${i + 1}/${totalQuestions})…`, `${subject}Expert`)

      const result = await expert.execute({
        question,
        imageDataUrl,
        difficulty: actualDifficulty,
      })

      if (result.success && result.data) {
        rawEvaluations.push({
          ...result.data,
          questionId: question.questionId,
          questionNumber: question.questionNumber,
          maxMarks: question.maxMarks,
        })
      } else {
        rawEvaluations.push({
          questionId: question.questionId,
          questionNumber: question.questionNumber,
          maxMarks: question.maxMarks,
          obtainedMarks: 0,
          confidence: 0,
          feedback: result.error ?? 'Evaluation failed',
          error: result.error,
        })
      }
    }

    // ── Step 4: Reviewer audits the results ─────────────────────────────────
    onProgress(80, 'Reviewer Agent: Auditing grading consistency…', 'Reviewer')
    const reviewer = new ReviewerAgent(aiProvider)
    const reviewResult = await reviewer.execute(rawEvaluations)
    const finalEvaluations: any[] = reviewResult.success && reviewResult.data
      ? reviewResult.data.map((rev: any, idx: number) => ({
          ...rev,
          questionId: rev.questionId ?? rawEvaluations[idx]?.questionId,
          questionNumber: rev.questionNumber ?? rawEvaluations[idx]?.questionNumber,
          maxMarks: rev.maxMarks ?? rawEvaluations[idx]?.maxMarks,
        }))
      : rawEvaluations

    // ── Step 5: Build final result ───────────────────────────────────────────
    onProgress(95, 'Compiling final results…', 'System')

    if (!finalEvaluations || finalEvaluations.length === 0) {
      throw new Error('No valid evaluations completed')
    }

    const totalMax = questions.reduce((s, q) => s + (Number(q.maxMarks) || 0), 0)
    const totalObtained = finalEvaluations.reduce(
      (s: number, e: any) => s + (Number(e.obtainedMarks) || 0),
      0
    )
    const percentage = totalMax > 0 ? parseFloat(((totalObtained / totalMax) * 100).toFixed(1)) : 0

    const grade =
      percentage >= 90 ? 'A+' :
      percentage >= 80 ? 'A'  :
      percentage >= 70 ? 'B'  :
      percentage >= 60 ? 'C'  :
      percentage >= 50 ? 'D'  : 'F'

    const result = {
      totalMarks: totalObtained,
      maxMarks: totalMax,
      percentage,
      grade,
      subject,
      difficulty: actualDifficulty,
      overallFeedback: `Evaluated by ${subject} Expert (${actualDifficulty} level). Final audit by Reviewer Agent.`,
      questionResults: finalEvaluations,
      lowConfidenceQuestions: finalEvaluations
        .filter((e: any) => e && (e.confidence ?? 100) < 60)
        .map((e: any) => e.questionId)
        .filter((id: any) => id != null),
    }

    // ── Step 6: Persist Evaluation record ────────────────────────────────────
    console.log('Step 6: Creating evaluation record in database...')
    onProgress(90, 'Saving evaluation results...')

    const evaluation = await db.evaluation.create({
      data: {
        examId: exam.id,
        studentName,
        totalMarks: result.totalMarks,
        maxMarks: result.maxMarks,
        percentage: result.percentage,
        grade: result.grade,
        overallFeedback: result.overallFeedback,
        confidence: 85,
        status: 'completed',
        // documentId and evaluatedById are optional — omitted intentionally
      },
    })
    console.log(`Step 6 complete: Created evaluation with ID: ${evaluation.id}`)

    // ── Step 7: Persist per-question results ─────────────────────────────────
    onProgress(95, 'Saving question-level feedback...')

    console.log('Creating question evaluations...')
    console.log('Available questions:', questions.map(q => ({ id: q.id, questionNumber: q.questionNumber })))
    console.log('Question results:', result.questionResults.map(q => ({ questionNumber: q.questionNumber })))

    const questionEvaluationPromises = result.questionResults.map(async (qResult: any) => {
      const question = questions.find(
        (q: any) => q.questionNumber === qResult.questionNumber
      )

      console.log(`Matching question for result ${qResult.questionNumber}:`, question ? `Found (ID: ${question.id})` : 'Not found')

      if (!question) {
        console.warn(
          `No matching question found for questionNumber: ${qResult.questionNumber}`
        )
        return
      }

      await db.questionEvaluation.create({
        data: {
          evaluationId: evaluation.id,
          questionId: question.id,
          obtainedMarks: qResult.obtainedMarks,
          maxMarks: qResult.maxMarks,
          confidence: qResult.confidence ?? 80,
          strength: qResult.strength ?? null,
          mistakes: qResult.mistakes ?? null,
          missingConcepts: qResult.missingConcepts ?? null,
          suggestions: qResult.suggestions ?? null,

          // ✅ FIX: Prisma expects a String — serialize the reasoning object
          reasoning:
            qResult.reasoning != null
              ? typeof qResult.reasoning === 'string'
                ? qResult.reasoning
                : JSON.stringify(qResult.reasoning)
              : null,

          pageNumbers: qResult.pageNumbers ?? '1',
          studentAnswerImage: qResult.studentAnswerImage ?? null,
          studentAnswer: qResult.studentAnswer ?? null,
        },
      })
    })

    const createdEvaluations = await Promise.all(questionEvaluationPromises.filter(p => p !== undefined))
    console.log(`Created ${createdEvaluations.length} question evaluations out of ${result.questionResults.length} results`)

    // ── Step 5: Store final result for the polling endpoint ──────────────────
    const resultWithMetadata = {
      ...result,
      id: evaluation.id,
      examTitle: exam.title,
      studentName,
      rollNumber,
      subject: exam.subject ?? 'N/A',
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    }

    evaluationStorage.setResult(evaluationId, resultWithMetadata as any)
    evaluationStorage.updateStatus(evaluationId, 100, '✓ Multi-agent evaluation complete', true)
    evaluationStorage.updateAgent(evaluationId, 'Complete')
  } catch (error) {
    console.error('Error in processEvaluation:', error)
    evaluationStorage.updateStatus(
      evaluationId,
      0,
      `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      true
    )
    // Re-throw so the outer `.catch()` can also log it
    throw error
  }
}