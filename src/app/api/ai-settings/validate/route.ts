import { NextRequest, NextResponse } from 'next/server'
import type { AIEvaluationSettings, SettingsValidationResult } from '@/types/ai-settings'
import { AISettingsManager } from '@/lib/ai-settings/settings-manager'

export async function POST(request: NextRequest) {
  try {
    const settings: Partial<AIEvaluationSettings> = await request.json()
    
    // Validate settings
    const validation = AISettingsManager.validateSettings(settings)
    
    // Additional validation for specific scenarios
    const warnings: string[] = [...validation.warnings]
    
    // Check for potentially problematic combinations
    if (settings.strictnessControl?.level === 'strict' && 
        settings.confidenceSettings?.threshold &&
        settings.confidenceSettings.threshold > 80) {
      warnings.push('Strict mode with high confidence threshold may result in very few automatic approvals')
    }
    
    if (settings.strictnessControl?.level === 'lenient' && 
        settings.confidenceSettings?.threshold &&
        settings.confidenceSettings.threshold < 30) {
      warnings.push('Lenient mode with low confidence threshold may allow low-quality evaluations')
    }
    
    if (settings.systemControls?.aiProvider === 'claude' && 
        settings.systemControls?.costVsAccuracy === 'cost') {
      warnings.push('Claude provider with cost optimization may not provide the best value')
    }
    
    if (settings.semanticWeights) {
      const total = Object.values(settings.semanticWeights).reduce((sum, weight) => sum + weight, 0)
      if (Math.abs(total - 100) > 5) {
        warnings.push(`Semantic weights sum (${total}%) is significantly different from 100%`)
      }
    }
    
    return NextResponse.json({
      ...validation,
      warnings,
      compatibilityScore: settings ? AISettingsManager.getCompatibilityScore(settings as AIEvaluationSettings) : 0,
      costEstimate: settings ? AISettingsManager.estimateCostPerEvaluation(settings as AIEvaluationSettings) : null
    })
  } catch (error) {
    console.error('Failed to validate AI settings:', error)
    return NextResponse.json(
      { error: 'Failed to validate settings', isValid: false, errors: ['Validation service error'] },
      { status: 500 }
    )
  }
}
