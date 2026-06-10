import { NextResponse } from 'next/server'
import { SETTINGS_PRESETS } from '@/lib/ai-settings/default-settings'

export async function GET() {
  try {
    return NextResponse.json(SETTINGS_PRESETS)
  } catch (error) {
    console.error('Failed to get AI settings presets:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve presets' },
      { status: 500 }
    )
  }
}
