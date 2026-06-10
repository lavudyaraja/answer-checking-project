import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const evaluationId = searchParams.get('evaluationId')

  if (!evaluationId) {
    return NextResponse.json(
      { error: 'Evaluation ID is required' },
      { status: 400 }
    )
  }

  // Import evaluation storage to get results
  const { evaluationStorage } = await import('@/lib/evaluation-storage')
  
  const task = evaluationStorage.getTask(evaluationId)
  
  if (!task) {
    return NextResponse.json(
      { error: 'Evaluation not found' },
      { status: 404 }
    )
  }

  if (task.error) {
    return NextResponse.json({
      progress: 0,
      status: 'Failed',
      completed: true,
      error: task.error
    })
  }

  return NextResponse.json({
    progress: task.status.progress,
    status: task.status.status,
    completed: task.status.completed,
    result: task.result,
    fileId: evaluationId
  })
}
