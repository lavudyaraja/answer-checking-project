import { NextRequest, NextResponse } from 'next/server'
import type { SettingsExport } from '@/types/ai-settings'
import { AISettingsManager } from '@/lib/ai-settings/settings-manager'
import { DEFAULT_AI_SETTINGS } from '@/lib/ai-settings/default-settings'

export async function POST(request: NextRequest) {
  try {
    const { settingsId, exportedBy } = await request.json()
    
    // In a real implementation, you would fetch settings from database
    // For now, we'll use default settings
    const settings = DEFAULT_AI_SETTINGS
    
    const exportData = AISettingsManager.exportSettings(settings, exportedBy || 'anonymous')
    
    return NextResponse.json(exportData)
  } catch (error) {
    console.error('Failed to export AI settings:', error)
    return NextResponse.json(
      { error: 'Failed to export settings' },
      { status: 500 }
    )
  }
}
