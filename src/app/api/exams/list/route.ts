import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── GET /api/exams/list ──────────────────────────────────────────────────────
//
// Query params (all optional):
//   ?search=string        — filter by title or subject (case-insensitive)
//   ?sort=createdAt|title|subject|questionCount|totalMarks  (default: createdAt)
//   ?dir=asc|desc         (default: desc)
//   ?page=number          (default: 1, min: 1)
//   ?limit=number         (default: 50, max: 200)
//
// Response:
//   { exams: ExamSummary[], total: number, page: number, totalPages: number }

type SortableField = 'createdAt' | 'updatedAt' | 'title' | 'subject'

const ALLOWED_SORT_FIELDS = new Set<SortableField>([
  'createdAt',
  'updatedAt',
  'title',
  'subject',
])

const DEFAULT_LIMIT = 50
const MAX_LIMIT     = 200

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    // ── Parse & validate query params ──────────────────
    const search = searchParams.get('search')?.trim() ?? ''

    const rawSort = searchParams.get('sort') ?? 'createdAt'
    const sortField: SortableField = ALLOWED_SORT_FIELDS.has(rawSort as SortableField)
      ? (rawSort as SortableField)
      : 'createdAt'

    const rawDir = searchParams.get('dir') ?? 'desc'
    const sortDir: 'asc' | 'desc' = rawDir === 'asc' ? 'asc' : 'desc'

    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10) || 1)
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
    const skip  = (page - 1) * limit

    // ── Build where clause ─────────────────────────────
    const where = search
      ? {
          OR: [
            { title:   { contains: search, mode: 'insensitive' as const } },
            { subject: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined

    // ── Fetch in parallel ──────────────────────────────
    const [exams, total] = await Promise.all([
      db.exam.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip,
        take: limit,
        include: {
          questions: {
            select: { maxMarks: true },
          },
          _count: {
            select: { questions: true },
          },
        },
      }),
      db.exam.count({ where }),
    ])

    // ── Shape response ─────────────────────────────────
    const examList = exams.map((exam) => ({
      id:            exam.id,
      title:         exam.title,
      subject:       exam.subject ?? '',
      questionCount: exam._count.questions,
      totalMarks:    exam.questions.reduce(
        (sum: number, q: { maxMarks: number }) => sum + q.maxMarks,
        0
      ),
      createdAt:     exam.createdAt,
      updatedAt:     exam.updatedAt,
    }))

    return NextResponse.json({
      exams:      examList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })

  } catch (error) {
    console.error('[GET /api/exams/list]', error)
    return NextResponse.json(
      { error: 'Failed to fetch exams.' },
      { status: 500 }
    )
  }
}