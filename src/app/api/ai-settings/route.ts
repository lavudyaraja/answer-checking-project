import { NextRequest, NextResponse } from 'next/server'
import type { AIEvaluationSettings, SettingsValidationResult } from '@/types/ai-settings'
import { DEFAULT_AI_SETTINGS } from '@/lib/ai-settings/default-settings'
import { AISettingsManager } from '@/lib/ai-settings/settings-manager'

// In-memory storage for demo purposes
// In production, this would be stored in a database
let currentSettings: AIEvaluationSettings = DEFAULT_AI_SETTINGS

export async function GET() {
  try {
    return NextResponse.json(currentSettings)
  } catch (error) {
    console.error('Failed to get AI settings:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const settings: AIEvaluationSettings = await request.json()
    
    // Validate settings
    const validation = AISettingsManager.validateSettings(settings)
    
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Invalid settings', details: validation.errors },
        { status: 400 }
      )
    }
    
    // Merge with defaults to ensure all required fields exist
    const mergedSettings = AISettingsManager.mergeWithDefaults(settings)
    
    // Update current settings
    currentSettings = mergedSettings
    
    return NextResponse.json(mergedSettings)
  } catch (error) {
    console.error('Failed to save AI settings:', error)
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const updates: Partial<AIEvaluationSettings> = await request.json()
    
    // Validate updates
    const validation = AISettingsManager.validateSettings(updates)
    
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Invalid settings updates', details: validation.errors },
        { status: 400 }
      )
    }
    
    // Merge with current settings
    const updatedSettings = AISettingsManager.mergeWithDefaults({
      ...currentSettings,
      ...updates,
      updatedAt: new Date()
    })
    
    currentSettings = updatedSettings
    
    return NextResponse.json(updatedSettings)
  } catch (error) {
    console.error('Failed to update AI settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    // Reset to default settings
    currentSettings = DEFAULT_AI_SETTINGS
    
    return NextResponse.json({ message: 'Settings reset to defaults' })
  } catch (error) {
    console.error('Failed to reset AI settings:', error)
    return NextResponse.json(
      { error: 'Failed to reset settings' },
      { status: 500 }
    )
  }
}
