import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── DELETE /api/exams/[id] ───────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params

    const exam = await db.exam.findUnique({ where: { id: examId } })
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
    }

    const evaluationCount = await db.evaluation.count({ where: { examId } })
    if (evaluationCount > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete exam with existing evaluations',
          details: `This exam has ${evaluationCount} evaluation${evaluationCount !== 1 ? 's' : ''}. Delete those first or archive the exam instead.`,
        },
        { status: 400 }
      )
    }

    // Delete child records first
    await db.$transaction([
      db.question.deleteMany({ where: { examId } }),
      db.document.deleteMany({ where: { examId } }),
      db.exam.delete({ where: { id: examId } }),
    ])

    return NextResponse.json({ success: true, message: 'Exam deleted.' })
  } catch (error) {
    console.error('[DELETE /api/exams/:id]', error)
    return NextResponse.json({ error: 'Failed to delete exam.' }, { status: 500 })
  }
}

// ─── PUT /api/exams/[id] ──────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params
    const body = await request.json()

    const exam = await db.exam.findUnique({ where: { id: examId } })
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
    }

    const { title, description, subject, questions } = body

    // Validate required fields
    if (title !== undefined && !String(title).trim()) {
      return NextResponse.json({ error: 'Exam title cannot be empty.' }, { status: 422 })
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = String(title).trim()
    if (description !== undefined) updateData.description = String(description).trim()
    if (subject !== undefined) updateData.subject = String(subject).trim()

    // Run in a transaction for atomicity
    const [updatedExam] = await db.$transaction([
      db.exam.update({ where: { id: examId }, data: updateData }),
      ...(Array.isArray(questions)
        ? [
            db.question.deleteMany({ where: { examId } }),
            ...(questions.length > 0
              ? [
                  db.question.createMany({
                    data: questions.map((q: any) => ({
                      examId,
                      questionNumber: q.questionNumber ?? q.number ?? 0,
                      questionText: String(q.questionText ?? q.text ?? '').trim(),
                      maxMarks: Number(q.maxMarks ?? q.marks ?? 0),
                      modelAnswer: String(q.modelAnswer ?? '').trim(),
                      rubric: String(q.rubric ?? '').trim(),
                    })),
                    skipDuplicates: true,
                  }),
                ]
              : []),
          ]
        : []),
    ])

    return NextResponse.json({
      success: true,
      exam: updatedExam,
      message: 'Exam updated successfully.',
    })
  } catch (error) {
    console.error('[PUT /api/exams/:id]', error)
    return NextResponse.json({ error: 'Failed to update exam.' }, { status: 500 })
  }
}

// ─── GET /api/exams/[id] ──────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params

    const exam = await db.exam.findUnique({
      where: { id: examId },
      include: {
        questions: { orderBy: { questionNumber: 'asc' } },
        documents: true,
      },
    })

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
    }

    // Shape response for the frontend
    return NextResponse.json({
      id: exam.id,
      title: exam.title,
      subject: exam.subject ?? '',
      description: exam.description ?? '',
      instructions: exam.description ?? '', // alias
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
      questions: exam.questions.map(q => ({
        id: q.id,
        number: q.questionNumber,
        text: q.questionText,
        modelAnswer: q.modelAnswer ?? '',
        rubric: q.rubric ?? '',
        marks: q.maxMarks,
        keywords: [], // not stored in DB — extend schema if needed
        expanded: true,
      })),
      documents: exam.documents.map(d => ({
        id: d.id,
        fileName: d.fileName ?? '',
        fileType: d.fileType ?? '',
      })),
    })
  } catch (error) {
    console.error('[GET /api/exams/:id]', error)
    return NextResponse.json({ error: 'Failed to fetch exam.' }, { status: 500 })
  }
}