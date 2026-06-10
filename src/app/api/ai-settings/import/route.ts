import { NextRequest, NextResponse } from 'next/server'
import type { SettingsExport } from '@/types/ai-settings'
import { AISettingsManager } from '@/lib/ai-settings/settings-manager'

export async function POST(request: NextRequest) {
  try {
    const exportData: SettingsExport = await request.json()
    
    // Validate and import settings
    const { settings, validation } = AISettingsManager.importSettings(exportData)
    
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid settings in export file', 
          details: validation.errors,
          warnings: validation.warnings 
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      settings,
      validation,
      message: 'Settings imported successfully'
    })
  } catch (error) {
    console.error('Failed to import AI settings:', error)
    return NextResponse.json(
      { error: 'Failed to import settings - invalid file format' },
      { status: 500 }
    )
  }
}
