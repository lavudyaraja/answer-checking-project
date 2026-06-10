// app/api/evaluations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Maps DB evaluation status to the UI status enum.
 * DB statuses: completed | processing | failed | (any saved review status)
 */
function mapStatus(status: string): 'pending_review' | 'approved' | 'rejected' | 'needs_revision' {
  switch (status) {
    case 'approved':       return 'approved'
    case 'rejected':       return 'rejected'
    case 'needs_revision': return 'needs_revision'
    case 'completed':
    case 'processing':     return 'pending_review'
    case 'failed':         return 'rejected'
    default:               return 'pending_review'
  }
}

export async function GET(request: NextRequest) {
  try {
    const evaluations = await prisma.evaluation.findMany({
      orderBy: { evaluatedAt: 'desc' }
    })

    // Batch-fetch related documents (with exam), exams, and question evaluations
    const documentIds  = evaluations.map(e => e.documentId).filter(Boolean) as string[]
    const examIds      = evaluations.map(e => e.examId).filter(Boolean) as string[]
    const evaluationIds = evaluations.map(e => e.id)

    const [documents, exams, questionEvaluations] = await Promise.all([
      documentIds.length > 0
        ? prisma.document.findMany({
            where: { id: { in: documentIds } },
            include: { exam: { select: { title: true, subject: true } } }
          })
        : Promise.resolve([]),

      examIds.length > 0
        ? prisma.exam.findMany({
            where: { id: { in: examIds } },
            select: { id: true, title: true, subject: true }
          })
        : Promise.resolve([]),

      prisma.questionEvaluation.findMany({
        where: { evaluationId: { in: evaluationIds } },
        select: { evaluationId: true, confidence: true }
      })
    ])

    const transformedEvaluations = evaluations.map(evaluation => {
      const document   = documents.find(d => d.id === evaluation.documentId)
      const examViaDoc = document?.exam
      const examDirect = exams.find(e => e.id === evaluation.examId)
      const exam       = examViaDoc || examDirect

      const studentName = evaluation.studentName
        ? evaluation.studentName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        : 'Unknown Student'

      // Compute average confidence from question evaluations
      const qEvals      = questionEvaluations.filter(qe => qe.evaluationId === evaluation.id)
      const confidences = qEvals.map(qe => qe.confidence).filter(c => c > 0)
      const avgConf     = confidences.length > 0
        ? confidences.reduce((s, c) => s + c, 0) / confidences.length
        : 0

      return {
        id:             evaluation.id,
        studentName,
        rollNumber:     '', // Add to schema if needed
        examTitle:      exam?.title   || 'Unknown Exam',
        subject:        exam?.subject || 'Unknown Subject',
        totalMarks:     evaluation.totalMarks,
        obtainedMarks:  evaluation.totalMarks,
        percentage:     evaluation.percentage,
        grade:          evaluation.grade || 'N/A',
        evaluationDate: evaluation.evaluatedAt.toISOString(),
        status:         mapStatus(evaluation.status),
        aiConfidence:   Math.round(avgConf * 10) / 10,
        reviewerName:   evaluation.evaluatedById ? 'Reviewer' : undefined,
        reviewDate:     evaluation.evaluatedById ? evaluation.evaluatedAt.toISOString() : undefined,
        hasAttachments: !!evaluation.documentId,
      }
    })

    return NextResponse.json({
      evaluations: transformedEvaluations,
      total: transformedEvaluations.length
    })

  } catch (error) {
    console.error('Error fetching evaluations:', error)
    return NextResponse.json({ error: 'Failed to fetch evaluations' }, { status: 500 })
  }
}