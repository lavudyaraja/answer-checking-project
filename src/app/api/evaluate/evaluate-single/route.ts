import { NextRequest, NextResponse } from 'next/server'
import { evaluationStorage } from '@/lib/evaluation-storage'
import { evaluateAnswersSinglePass } from '@/lib/single-pass/evaluation-service-single'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const examId = formData.get('examId') as string
    const studentName = formData.get('studentName') as string
    const rollNumber = formData.get('rollNumber') as string
    const notes = formData.get('notes') as string
    const answerSheet = formData.get('answerSheet') as File
    const aiProviderRaw = formData.get('aiProvider') as string
    const aiProvider = (aiProviderRaw === 'claude' || aiProviderRaw === 'groq') ? aiProviderRaw : 'groq'

    if (!examId || !studentName || !answerSheet) {
      return NextResponse.json(
        { error: 'Missing required fields: examId, studentName, answerSheet' },
        { status: 400 }
      )
    }

    // Generate unique evaluation ID
    const evaluationId = `${answerSheet.name.replace(/\.[^/.]+$/, '')}_${Date.now()}`
    
    // Initialize evaluation status
    evaluationStorage.setTask(evaluationId, {
      fileId: evaluationId,
      status: { progress: 0, status: 'Initializing single-pass evaluation...', completed: false },
      createdAt: new Date()
    })

    // Start evaluation in background
    evaluateSinglePassBackground(evaluationId, {
      examId,
      studentName,
      rollNumber,
      notes,
      answerSheet,
      aiProvider
    })

    return NextResponse.json({
      success: true,
      evaluationId,
      message: 'Single-pass evaluation started'
    })

  } catch (error) {
    console.error('Single-pass evaluation error:', error)
    return NextResponse.json(
      { error: 'Failed to start single-pass evaluation' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const evaluationId = searchParams.get('evaluationId')

  if (!evaluationId) {
    return NextResponse.json(
      { error: 'Evaluation ID is required' },
      { status: 400 }
    )
  }

  const task = evaluationStorage.getTask(evaluationId)
  
  if (!task) {
    return NextResponse.json(
      { error: 'Evaluation not found' },
      { status: 404 }
    )
  }

  if (task.error) {
    return NextResponse.json({
      progress: 0,
      status: 'Failed',
      completed: true,
      error: task.error
    })
  }

  return NextResponse.json({
    progress: task.status.progress,
    status: task.status.status,
    completed: task.status.completed,
    result: task.result
  })
}

async function evaluateSinglePassBackground(
  evaluationId: string,
  data: {
    examId: string
    studentName: string
    rollNumber: string
    notes: string
    answerSheet: File
    aiProvider: string
  }
) {
  try {
    // Update progress
    evaluationStorage.updateStatus(evaluationId, 10, 'Loading exam questions...')

    // Fetch exam questions (you'll need to implement this)
    const questions = await fetchExamQuestions(data.examId)
    
    evaluationStorage.updateStatus(evaluationId, 25, 'Processing answer sheet...')

    // Convert file to buffer
    const arrayBuffer = await data.answerSheet.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    evaluationStorage.updateStatus(evaluationId, 40, 'Starting single-pass evaluation...')

    // Run single-pass evaluation
    const result = await evaluateAnswersSinglePass(
      questions,
      { file: buffer, fileType: data.answerSheet.type },
      (progress, status) => {
        const adjustedProgress = 40 + (progress * 0.6) // Map to 40-100%
        evaluationStorage.updateStatus(evaluationId, adjustedProgress, status)
      },
      'intermediate' as const,
      data.aiProvider as 'claude' | 'groq'
    )

    // Store results
    evaluationStorage.setResult(evaluationId, {
      ...result,
      totalMarks: result.totalMarks,
      maxMarks: result.maxMarks,
      percentage: result.percentage,
      grade: result.grade,
      overallFeedback: result.overallFeedback,
      questionResults: result.questionResults,
      lowConfidenceQuestions: result.lowConfidenceQuestions || []
    })

  } catch (error) {
    console.error('Single-pass evaluation failed:', error)
    evaluationStorage.setError(evaluationId, 
      error instanceof Error ? error.message : 'Unknown error occurred'
    )
  }
}

async function fetchExamQuestions(examId: string) {
  // Fetch exam with questions from database (same as existing system)
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: { questions: true },
  })

  if (!exam) {
    throw new Error('Exam not found')
  }

  // Transform database questions to single-pass format
  return exam.questions.map(question => ({
    id: question.id,
    questionNumber: question.questionNumber,
    questionText: question.questionText,
    maxMarks: question.maxMarks,
    modelAnswer: question.modelAnswer || '',
    rubric: question.rubric || ''
  }))
}
