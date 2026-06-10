// app/api/evaluations/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VALID_STATUSES = ['pending_review', 'approved', 'rejected', 'needs_revision']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: evaluationId } = await params
    const body = await request.json()
    const { status, comments, reviewerName } = body

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if evaluation exists
    const existing = await prisma.evaluation.findUnique({ where: { id: evaluationId } })
    if (!existing) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 })
    }

    // Update evaluation — store review metadata in available fields
    const evaluation = await prisma.evaluation.update({
      where: { id: evaluationId },
      data: {
        status,
        // Store review comments and reviewer info if your schema supports it.
        // If not, add these fields to your Prisma schema:
        //   reviewComments String?
        //   reviewedAt     DateTime?
        //   reviewedByName String?
      }
    })

    return NextResponse.json({
      success: true,
      evaluation,
      message: `Evaluation status updated to "${status}"`
    })

  } catch (error) {
    console.error('Error updating evaluation status:', error)
    return NextResponse.json({ error: 'Failed to update evaluation status' }, { status: 500 })
  }
}