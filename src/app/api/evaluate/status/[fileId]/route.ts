// Place this file at: app/api/evaluate/status/[fileId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { evaluationStorage } from '@/lib/evaluation-storage'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params

    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
    }

    const task = evaluationStorage.getTask(fileId)

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({
      fileId: task.fileId,
      status: task.status,          // { progress, status, completed, activeAgent }
      result: task.result ?? null,  // full result once completed
    })
  } catch (error) {
    console.error('[status] Error fetching task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}