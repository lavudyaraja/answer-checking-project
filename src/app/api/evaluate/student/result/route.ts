import { NextRequest, NextResponse } from 'next/server'
import { evaluationStorage } from '@/lib/evaluation-storage'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const evaluationId = searchParams.get('evaluationId')

    if (!evaluationId) {
      return NextResponse.json(
        { error: 'Evaluation ID is required' },
        { status: 400 }
      )
    }

    // First try to get from database (persistent storage)
    try {
      const dbEvaluation = await db.evaluation.findUnique({
        where: { id: evaluationId },
        include: {
          questionEvaluations: {
            include: {
              question: true
            }
          }
        }
      })

      console.log('Found evaluation:', dbEvaluation ? 'Yes' : 'No')
      console.log('Question evaluations count:', dbEvaluation?.questionEvaluations?.length || 0)

      if (dbEvaluation) {
        // Fetch exam details separately
        const exam = await db.exam.findUnique({
          where: { id: dbEvaluation.examId! },
          select: { title: true }
        })

        // Format the database result to match expected structure
        const formattedResult = {
          id: dbEvaluation.id,
          totalMarks: dbEvaluation.totalMarks,
          maxMarks: dbEvaluation.maxMarks,
          percentage: dbEvaluation.percentage,
          grade: dbEvaluation.grade,
          overallFeedback: dbEvaluation.overallFeedback,
          questionResults: dbEvaluation.questionEvaluations.map(qe => ({
            questionNumber: qe.question.questionNumber,
            questionText: qe.question.questionText,
            obtainedMarks: qe.obtainedMarks,
            maxMarks: qe.maxMarks,
            confidence: qe.confidence,
            strength: qe.strength,
            mistakes: qe.mistakes,
            missingConcepts: qe.missingConcepts,
            suggestions: qe.suggestions,
            reasoning: qe.reasoning,
            pageNumbers: qe.pageNumbers,
            studentAnswerImage: qe.studentAnswerImage,
            studentAnswer: qe.studentAnswer,
            modelAnswer: qe.question.modelAnswer,
            questionId: qe.question.id,
            id: qe.id,
            // Additional fields that frontend might expect
            semanticScore: (qe as any).semanticScore,
            keywordAnalysis: (qe as any).keywordAnalysis,
            evaluationLevel: (qe as any).evaluationLevel
          })),
          examTitle: exam?.title,
          studentName: dbEvaluation.studentName,
          status: dbEvaluation.status,
          evaluatedAt: dbEvaluation.evaluatedAt
        }

        return NextResponse.json(formattedResult)
      }
    } catch (dbError) {
      console.warn('Database fetch failed, falling back to memory storage:', dbError)
    }

    // Fallback to memory storage for ongoing evaluations
    const task = evaluationStorage.getTask(evaluationId)

    if (!task) {
      return NextResponse.json(
        { error: 'Evaluation not found' },
        { status: 404 }
      )
    }

    if (!task.result) {
      return NextResponse.json(
        { error: 'Result not available yet' },
        { status: 202 }
      )
    }

    return NextResponse.json(task.result)
  } catch (error) {
    console.error('Error in result API:', error)
    return NextResponse.json(
      { error: 'Failed to get result' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const evaluationId = url.pathname.split('/').pop()

    if (!evaluationId || evaluationId === 'result') {
      return NextResponse.json(
        { error: 'Evaluation ID is required' },
        { status: 400 }
      )
    }

    // Delete from database
    try {
      // First delete question evaluations
      await db.questionEvaluation.deleteMany({
        where: { evaluationId: evaluationId }
      })

      // Then delete the main evaluation
      await db.evaluation.delete({
        where: { id: evaluationId }
      })

      return NextResponse.json(
        { message: 'Evaluation result deleted successfully' },
        { status: 200 }
      )
    } catch (dbError) {
      console.error('Database delete failed, falling back to memory storage:', dbError)
      
      // Fallback to memory storage
      evaluationStorage.deleteTask(evaluationId)
      
      return NextResponse.json(
        { message: 'Evaluation result deleted successfully' },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Error deleting evaluation:', error)
    return NextResponse.json(
      { error: 'Failed to delete evaluation result' },
      { status: 500 }
    )
  }
}
