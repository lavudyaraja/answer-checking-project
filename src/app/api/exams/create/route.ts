import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exams/create
// ─────────────────────────────────────────────────────────────────────────────
// FIX: Replaced $transaction (which caused P2028 timeout) with explicit
//      sequential creates + manual rollback on failure.
//      This avoids holding a long-lived interactive transaction open while
//      doing file I/O and large inserts.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let examId: string | null = null

  try {
    const formData = await request.formData()

    // ── Parse fields ───────────────────────────────────────────────────────
    const title        = (formData.get('title')        as string | null)?.trim() ?? ''
    const subject      = (formData.get('subject')      as string | null)?.trim() ?? ''
    const instructions = (formData.get('instructions') as string | null)?.trim() ?? ''
    const questionsJson = formData.get('questions') as string | null

    const rawDuration = Number(formData.get('duration'))
    const duration    = isNaN(rawDuration) ? 0 : rawDuration

    if (!title) {
      return NextResponse.json({ error: 'Exam title is required' }, { status: 400 })
    }

    // ── Parse questions JSON ───────────────────────────────────────────────
    let parsedQuestions: ParsedQuestion[] = []

    if (questionsJson) {
      try {
        const raw = JSON.parse(questionsJson)
        parsedQuestions = Array.isArray(raw) ? raw : []
      } catch {
        return NextResponse.json({ error: 'Invalid questions JSON' }, { status: 400 })
      }
    }

    // ── Step 1: Create the exam record ─────────────────────────────────────
    const exam = await db.exam.create({
      data: {
        title,
        description: instructions,
        subject,
        // If your Prisma schema has a `duration` field, uncomment:
        // duration,
      },
    })
    examId = exam.id   // track ID so we can clean up on failure

    // ── Step 2: Bulk-insert questions ──────────────────────────────────────
    if (parsedQuestions.length > 0) {
      await db.question.createMany({
        data: parsedQuestions.map((q) => ({
          examId: exam.id,
          questionNumber: q.questionNumber ?? q.number ?? 0,
          questionText:   q.questionText   ?? q.text   ?? '',
          maxMarks:       q.maxMarks        ?? q.marks  ?? 0,
          modelAnswer:    q.modelAnswer     ?? '',
          rubric:         q.rubric          ?? '',
        })),
        skipDuplicates: true,
      })
    }

    // ── Step 3: Store document metadata (never store base64 in DB) ─────────
    const questionsPaper = formData.get('questionsPaper') as File | null
    const answerModel    = formData.get('answerModel')    as File | null
    const docFile        = questionsPaper ?? answerModel

    if (docFile) {
      await db.document.create({
        data: {
          examId:    exam.id,
          fileName:  docFile.name,
          // In production replace with a real cloud storage URL (S3 / R2)
          fileUrl:   `/uploads/${exam.id}/${docFile.name}`,
          fileType:  docFile.type,
          pageCount: 1,
        },
      })
    }

    return NextResponse.json({
      success: true,
      examId: exam.id,
      message: 'Exam created successfully',
    })

  } catch (error) {
    console.error('Error creating exam:', error)

    // ── Manual rollback: delete the exam if questions/document insert failed ─
    if (examId) {
      try {
        await db.exam.delete({ where: { id: examId } })
        console.info(`Rolled back exam ${examId} after failed creation.`)
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr)
      }
    }

    // Prisma transaction-start timeout (P2028) — kept for reference even though
    // we no longer use $transaction here, but leaving the guard in case it
    // surfaces from nested Prisma internals.
    if (error instanceof Error && error.message.includes('P2028')) {
      return NextResponse.json(
        {
          error: 'Database is busy. Please try again in a moment.',
          details: 'The database connection pool is under load. Wait a few seconds and retry.',
          retry: true,
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to create exam',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────
interface ParsedQuestion {
  number?: number
  questionNumber?: number
  text?: string
  questionText?: string
  marks?: number
  maxMarks?: number
  modelAnswer?: string
  rubric?: string
}