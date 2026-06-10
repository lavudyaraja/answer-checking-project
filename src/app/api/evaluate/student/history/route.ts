import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── GET /api/evaluate/student/history ────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const params  = request.nextUrl.searchParams
    const examId      = params.get('examId')
    const studentName = params.get('studentName')
    const rollNumber  = params.get('rollNumber')
    const grade       = params.get('grade')        // A | B | C | D | F
    const dateFrom    = params.get('dateFrom')     // ISO date string
    const dateTo      = params.get('dateTo')       // ISO date string
    const limit       = Math.min(parseInt(params.get('limit') ?? '100', 10), 200)
    const offset      = parseInt(params.get('offset') ?? '0', 10)
    const sortBy      = params.get('sortBy') ?? 'evaluatedAt'   // evaluatedAt | percentage | grade | studentName
    const sortDir     = params.get('sortDir') === 'asc' ? 'asc' : 'desc'

    // ── Build where clause ─────────────────────────────────────────────
    const where: Record<string, any> = {}
    if (examId)      where.examId      = examId
    if (rollNumber)  where.rollNumber  = { contains: rollNumber, mode: 'insensitive' }
    if (studentName) where.studentName = { contains: studentName, mode: 'insensitive' }

    // Grade filter — grade column stores values like "A+", "B", "C-"
    // We filter on the first character matching the requested category
    if (grade && ['A', 'B', 'C', 'D', 'F'].includes(grade.toUpperCase())) {
      where.grade = { startsWith: grade.toUpperCase() }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.evaluatedAt = {}
      if (dateFrom) where.evaluatedAt.gte = new Date(dateFrom)
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        where.evaluatedAt.lte = end
      }
    }

    // ── Sort ───────────────────────────────────────────────────────────
    const ORDER_MAP: Record<string, string> = {
      evaluatedAt: 'evaluatedAt',
      percentage:  'percentage',
      grade:       'grade',
      studentName: 'studentName',
    }
    const orderBy = { [ORDER_MAP[sortBy] ?? 'evaluatedAt']: sortDir }

    // ── Query ──────────────────────────────────────────────────────────
    const [evaluations, total] = await Promise.all([
      db.evaluation.findMany({
        where,
        include: {
          questionEvaluations: {
            include: {
              question: {
                select: {
                  questionNumber: true,
                  questionText: true,
                  maxMarks: true,
                  modelAnswer: true,
                },
              },
            },
            orderBy: { question: { questionNumber: 'asc' } },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      db.evaluation.count({ where }),
    ])

    // ── Enrich with exam data ──────────────────────────────────────────
    const examIds = [...new Set(evaluations.map(e => e.examId).filter(Boolean))] as string[]
    const exams = examIds.length
      ? await db.exam.findMany({
          where: { id: { in: examIds } },
          select: { id: true, title: true, subject: true, createdAt: true },
        })
      : []
    const examMap = Object.fromEntries(exams.map(ex => [ex.id, ex]))

    // ── Format ─────────────────────────────────────────────────────────
    const formatted = evaluations.map(ev => {
      const exam = ev.examId ? examMap[ev.examId] : null
      return {
        id:            ev.id,
        examId:        ev.examId,
        examTitle:     exam?.title  ?? null,
        subject:       exam?.subject ?? null,
        date:          exam?.createdAt ?? null,
        studentName:   ev.studentName,
        rollNumber:    (ev as any).rollNumber ?? null,
        totalMarks:    ev.totalMarks,
        maxMarks:      ev.maxMarks,
        percentage:    ev.percentage,
        grade:         ev.grade,
        overallFeedback: (ev as any).overallFeedback ?? null,
        status:        ev.status,
        evaluatedAt:   ev.evaluatedAt,
        createdAt:     ev.evaluatedAt,
        questionCount: ev.questionEvaluations.length,
        questionResults: ev.questionEvaluations.map(qe => ({
          questionNumber: qe.question.questionNumber,
          questionText:   qe.question.questionText,
          obtainedMarks:  qe.obtainedMarks,
          maxMarks:       qe.maxMarks,
          modelAnswer:    qe.question.modelAnswer,
          reasoning:      qe.reasoning,
          strength:       qe.strength,
          mistakes:       qe.mistakes,
          missingConcepts: qe.missingConcepts,
          suggestions:    qe.suggestions,
          pageNumbers:    qe.pageNumbers,
          studentAnswerImage: qe.studentAnswerImage,
          confidence:     qe.confidence,
        })),
      }
    })

    // ── Aggregate stats (cheap — over the full filtered set) ───────────
    const allForStats = await db.evaluation.findMany({
      where,
      select: { percentage: true, grade: true },
    })

    const scores    = allForStats.map(e => e.percentage)
    const avgScore  = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const highScore = scores.length ? Math.max(...scores) : 0
    const lowScore  = scores.length ? Math.min(...scores) : 0

    const gradeDist: Record<string, number> = {}
    allForStats.forEach(e => {
      const g = e.grade ?? null
      if (!g) return
      const cat = g.charAt(0).toUpperCase()
      gradeDist[cat] = (gradeDist[cat] ?? 0) + 1
    })

    return NextResponse.json({
      evaluations: formatted,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats: {
        total,
        averageScore: Math.round(avgScore * 10) / 10,
        highestScore: Math.round(highScore * 10) / 10,
        lowestScore:  Math.round(lowScore * 10) / 10,
        gradeDistribution: gradeDist,
      },
    })

  } catch (error) {
    console.error('[history] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch evaluation history' },
      { status: 500 }
    )
  }
}