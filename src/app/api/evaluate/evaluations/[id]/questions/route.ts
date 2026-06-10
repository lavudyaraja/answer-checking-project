// app/api/evaluations/[id]/questions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: evaluationId } = await params

    // Verify the evaluation exists
    const evaluation = await prisma.evaluation.findUnique({ where: { id: evaluationId } })
    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 })
    }

    const questionEvaluations = await prisma.questionEvaluation.findMany({
      where: { evaluationId },
      include: {
        question: {
          select: {
            questionNumber: true,
            questionText:   true,
            maxMarks:       true,
            modelAnswer:    true,
          }
        }
      },
      orderBy: { question: { questionNumber: 'asc' } }
    })

    // Deduplicate by questionId — keep first occurrence
    const seen = new Set<string>()
    const unique = questionEvaluations.filter(qe => {
      if (seen.has(qe.questionId)) return false
      seen.add(qe.questionId)
      return true
    })

    const questions = unique.map(qe => {
      const pct = qe.question.maxMarks > 0
        ? (qe.obtainedMarks / qe.question.maxMarks) * 100
        : 0

      // Derive status from confidence
      const status =
        qe.confidence >= 80 ? 'approved' :
        qe.confidence >= 60 ? 'modified' :
        'flagged'

      return {
        questionId:      qe.questionId,
        questionNumber:  qe.question.questionNumber,
        questionText:    qe.question.questionText || '',
        maxMarks:        qe.question.maxMarks,
        awardedMarks:    qe.obtainedMarks,
        studentAnswer:   qe.studentAnswer  || '',
        modelAnswer:     qe.question.modelAnswer || '',
        // Structured AI feedback fields
        reasoning:       qe.reasoning        || '',
        strength:        qe.strength         || '',
        mistakes:        qe.mistakes         || '',
        missingConcepts: qe.missingConcepts  || '',
        suggestions:     qe.suggestions      || '',
        // Legacy combined field (for backward compat)
        aiFeedback: [
          qe.reasoning && `Reasoning: ${qe.reasoning}`,
          qe.strength  && `Strength: ${qe.strength}`,
          qe.mistakes  && `Mistakes: ${qe.mistakes}`,
          qe.missingConcepts && `Missing Concepts: ${qe.missingConcepts}`,
        ].filter(Boolean).join('\n\n') || '',
        reviewerFeedback: qe.suggestions || '',
        reviewerMarks:    qe.obtainedMarks,
        status,
        confidence:       qe.confidence,
        pageNumbers:      qe.pageNumbers || [],
      }
    })

    return NextResponse.json({ questions, total: questions.length })

  } catch (error) {
    console.error('Error fetching question evaluations:', error)
    return NextResponse.json({ error: 'Failed to fetch question evaluations' }, { status: 500 })
  }
}