import { NextRequest, NextResponse } from 'next/server'
import { evaluationStorage } from '@/lib/evaluation-storage'

export async function GET(request: NextRequest) {
  try {
    const fileId = request.nextUrl.searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }

    const task = evaluationStorage.getTask(fileId)

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // FIX #15: surface failures — previously a failed task (exists but no result)
    // would return 404 forever because only the `!task` branch handled "not found".
    if (task.error) {
      return NextResponse.json(
        { error: task.error, failed: true },
        { status: 422 }   // Unprocessable — the request was valid but evaluation failed
      )
    }

    // FIX #14: pending state must NOT use the `error` key — clients use that
    // key to detect failures. Use a clear `pending` flag + `message` instead.
    if (!task.result) {
      return NextResponse.json(
        {
          pending: true,
          message: 'Evaluation is still in progress',
          progress: task.status.progress,
          status: task.status.status,
        },
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