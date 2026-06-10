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

    // First try to get from memory storage (for active evaluations)
    const task = evaluationStorage.getTask(evaluationId)

    if (task) {
      return NextResponse.json(task.status)
    }

    // If not in memory, try database (for completed evaluations)
    try {
      const dbEvaluation = await db.evaluation.findUnique({
        where: { id: evaluationId },
        select: {
          status: true,
          evaluatedAt: true
        }
      })

      if (dbEvaluation) {
        // Map database status to expected format
        const progress = dbEvaluation.status === 'completed' ? 100 : 
                        dbEvaluation.status === 'failed' ? 0 : 50
        const statusText = dbEvaluation.status === 'completed' ? 'Complete' :
                          dbEvaluation.status === 'failed' ? 'Failed' : 'Processing'

        return NextResponse.json({
          progress,
          status: statusText,
          completed: dbEvaluation.status === 'completed' || dbEvaluation.status === 'failed',
          activeAgent: 'Complete'
        })
      }
    } catch (dbError) {
      console.warn('Database fetch failed:', dbError)
    }

    return NextResponse.json(
      { error: 'Evaluation not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Error in status API:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
