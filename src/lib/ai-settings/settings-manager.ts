import type {
  AIEvaluationSettings,
  SettingsValidationResult,
  SettingsExport,
  SettingsDiff,
} from '@/types/ai-settings'
import { DEFAULT_AI_SETTINGS } from './default-settings'

/**
 * AI Settings Manager — v2
 * Validation, merging, diffing, exporting, health scoring
 */
export class AISettingsManager {

  // ─── Validation ─────────────────────────────────────────────────────────────

  static validateSettings(settings: Partial<AIEvaluationSettings>): SettingsValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    if (settings.semanticWeights) {
      const total = Object.values(settings.semanticWeights).reduce((s, w) => s + w, 0)
      if (total !== 100) {
        errors.push(`Semantic weights must sum to 100% — current: ${total}%`)
        score -= 20
      }
    }

    if (settings.penaltyRules) {
      Object.entries(settings.penaltyRules).forEach(([key, value]) => {
        if (value < 0 || value > 100) {
          errors.push(`Penalty "${key}" must be 0–100 — current: ${value}`)
          score -= 5
        }
      })
    }

    if (settings.confidenceSettings?.threshold !== undefined) {
      const t = settings.confidenceSettings.threshold
      if (t < 0 || t > 100) { errors.push(`Confidence threshold must be 0–100 — current: ${t}`); score -= 10 }
      if (t > 85) { warnings.push('Confidence threshold >85 will trigger frequent human reviews'); score -= 5 }
      if (t < 25) { warnings.push('Confidence threshold <25 may allow poor-quality evaluations'); score -= 5 }
    }

    if (settings.systemControls?.rateLimitPerMinute !== undefined) {
      const r = settings.systemControls.rateLimitPerMinute
      if (r < 1 || r > 1000) { errors.push(`Rate limit must be 1–1000 — current: ${r}`); score -= 5 }
    }

    if (settings.systemControls?.timeoutSeconds !== undefined) {
      const t = settings.systemControls.timeoutSeconds
      if (t < 5 || t > 300) { errors.push(`Timeout must be 5–300 seconds — current: ${t}`); score -= 5 }
    }

    if (settings.feedbackConfiguration?.maxFeedbackLength !== undefined) {
      const l = settings.feedbackConfiguration.maxFeedbackLength
      if (l < 20 || l > 2000) { warnings.push(`Feedback length ${l} seems unusual (20–2000 words is typical)`) }
    }

    const required: Array<keyof AIEvaluationSettings> = [
      'evaluationBehavior', 'semanticWeights', 'strictnessControl',
      'penaltyRules', 'aiBehaviorConstraints', 'semanticMatching',
    ]
    required.forEach(f => {
      if (!settings[f]) { errors.push(`Required group missing: ${f}`); score -= 10 }
    })

    if (
      settings.evaluationMode?.multiModelAgreement &&
      settings.systemControls?.aiProvider !== 'both'
    ) {
      warnings.push('Multi-model agreement requires AI provider set to "Both"')
      score -= 5
    }

    if (
      settings.strictnessControl?.level === 'strict' &&
      settings.strictnessControl?.adaptiveStrictness
    ) {
      warnings.push('Adaptive strictness on strict mode may produce inconsistent results')
    }

    return { isValid: errors.length === 0, errors, warnings, score: Math.max(0, score) }
  }

  // ─── Merge ───────────────────────────────────────────────────────────────────

  static mergeWithDefaults(userSettings: Partial<AIEvaluationSettings>): AIEvaluationSettings {
    const merged: AIEvaluationSettings = {
      ...DEFAULT_AI_SETTINGS,
      ...userSettings,
      id: userSettings.id || DEFAULT_AI_SETTINGS.id,
      updatedAt: new Date(),
    }

    const deepMergeKeys: Array<keyof AIEvaluationSettings> = [
      'evaluationBehavior', 'semanticWeights', 'strictnessControl', 'penaltyRules',
      'aiBehaviorConstraints', 'semanticMatching', 'confidenceSettings',
      'evaluationMode', 'feedbackConfiguration', 'humanControl',
      'fairnessReliability', 'systemControls',
    ]

    deepMergeKeys.forEach(key => {
      if (userSettings[key]) {
        (merged as unknown as Record<string, unknown>)[key as string] = {
          ...(DEFAULT_AI_SETTINGS[key] as object),
          ...(userSettings[key] as object),
        }
      }
    })

    if (userSettings.subjectSpecific) {
      merged.subjectSpecific = {
        mathematics: {
          ...DEFAULT_AI_SETTINGS.subjectSpecific.mathematics,
          ...userSettings.subjectSpecific.mathematics,
        },
        theory: {
          ...DEFAULT_AI_SETTINGS.subjectSpecific.theory,
          ...userSettings.subjectSpecific.theory,
        },
        coding: {
          ...DEFAULT_AI_SETTINGS.subjectSpecific.coding,
          ...userSettings.subjectSpecific.coding,
        },
        science: {
          ...DEFAULT_AI_SETTINGS.subjectSpecific.science,
          ...userSettings.subjectSpecific.science,
        },
        diagrams: {
          ...DEFAULT_AI_SETTINGS.subjectSpecific.diagrams,
          ...userSettings.subjectSpecific.diagrams,
        },
        language: {
          ...DEFAULT_AI_SETTINGS.subjectSpecific.language,
          ...userSettings.subjectSpecific.language,
        },
        history: {
          ...DEFAULT_AI_SETTINGS.subjectSpecific.history,
          ...userSettings.subjectSpecific.history,
        },
        geography: {
          ...DEFAULT_AI_SETTINGS.subjectSpecific.geography,
          ...userSettings.subjectSpecific.geography,
        },
        economics: {
          ...DEFAULT_AI_SETTINGS.subjectSpecific.economics,
          ...userSettings.subjectSpecific.economics,
        },
        arts: {
          ...DEFAULT_AI_SETTINGS.subjectSpecific.arts,
          ...userSettings.subjectSpecific.arts,
        },
      }
    }

    return merged
  }

  // ─── Diff ────────────────────────────────────────────────────────────────────

  static diffSettings(
    original: AIEvaluationSettings,
    updated: AIEvaluationSettings,
    path = '',
  ): SettingsDiff[] {
    const diffs: SettingsDiff[] = []

    function walk(a: unknown, b: unknown, currentPath: string) {
      if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
        if (a !== b) {
          diffs.push({
            key: currentPath.split('.').pop() ?? currentPath,
            path: currentPath,
            oldValue: a,
            newValue: b,
            type: a === undefined ? 'added' : b === undefined ? 'removed' : 'changed',
          })
        }
        return
      }
      const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
      keys.forEach(k => walk(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        currentPath ? `${currentPath}.${k}` : k,
      ))
    }

    walk(original, updated, path)
    return diffs
  }

  // ─── Export ──────────────────────────────────────────────────────────────────

  static exportSettings(settings: AIEvaluationSettings, exportedBy: string): SettingsExport {
    const data = JSON.stringify(settings)
    const checksum = btoa(data.length.toString()).slice(0, 12)
    return {
      version: '2.0.0',
      format: 'json',
      settings,
      exportedAt: new Date(),
      exportedBy,
      checksum,
    }
  }

  static importSettings(exportData: SettingsExport) {
    const validation = this.validateSettings(exportData.settings)
    const settings = this.mergeWithDefaults(exportData.settings)
    return { settings, validation }
  }

  static exportAsCSV(settings: AIEvaluationSettings): string {
    const rows = [['Group', 'Setting', 'Value']]
    const flatten = (obj: Record<string, unknown>, group: string) => {
      Object.entries(obj).forEach(([k, v]) => {
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          flatten(v as Record<string, unknown>, `${group}.${k}`)
        } else {
          rows.push([group, k, String(v)])
        }
      })
    }
    const exportable: Record<string, unknown> = settings as unknown as Record<string, unknown>
    Object.entries(exportable).forEach(([group, val]) => {
      if (typeof val === 'object' && val !== null) {
        flatten(val as Record<string, unknown>, group)
      } else {
        rows.push([group, group, String(val)])
      }
    })
    return rows.map(r => r.join(',')).join('\n')
  }

  // ─── Clone ───────────────────────────────────────────────────────────────────

  static cloneSettings(settings: AIEvaluationSettings, newName: string): AIEvaluationSettings {
    return {
      ...JSON.parse(JSON.stringify(settings)),
      id: `clone_${Date.now()}`,
      name: newName,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  // ─── Summaries ───────────────────────────────────────────────────────────────

  static getSettingsSummary(settings: AIEvaluationSettings): string {
    return [
      `Mode: ${settings.strictnessControl.level}`,
      `Provider: ${settings.systemControls.aiProvider}`,
      `Confidence: ${settings.confidenceSettings.threshold}%`,
      `Multi-pass: ${settings.evaluationMode.multiPassSemantic ? 'On' : 'Off'}`,
    ].join(' · ')
  }

  static estimateCostPerEvaluation(settings: AIEvaluationSettings): { tokens: number; cost: number } {
    let tokens = 1000
    if (settings.evaluationMode.multiPassSemantic) tokens *= 3
    if (settings.evaluationMode.multiModelAgreement) tokens *= 2
    if (settings.evaluationMode.deepAnalysisMode) tokens *= 1.5

    const rates: Record<string, number> = { claude: 0.000015, groq: 0.0000005, both: 0.00000775 }
    let cost = tokens * (rates[settings.systemControls.aiProvider] ?? rates.both)
    if (settings.systemControls.costVsAccuracy === 'cost') cost *= 0.7
    if (settings.systemControls.costVsAccuracy === 'accuracy') cost *= 1.5

    return { tokens: Math.round(tokens), cost: Math.round(cost * 10000) / 10000 }
  }

  static getHealthScore(settings: AIEvaluationSettings): number {
    let score = 50
    if (settings.aiBehaviorConstraints.evaluateMeaningNotWording) score += 8
    if (settings.aiBehaviorConstraints.avoidKeywordMatching) score += 8
    if (settings.semanticMatching.conceptLevelMatching) score += 8
    if (settings.semanticMatching.contextUnderstanding) score += 8
    if (settings.fairnessReliability.avoidHandwritingBias) score += 4
    if (settings.fairnessReliability.consistentMarking) score += 4
    if (settings.humanControl.auditTrailEnabled) score += 4
    if (settings.humanControl.transparentReasoning) score += 4
    if (settings.strictnessControl.level === 'strict' && settings.confidenceSettings.threshold > 85) score -= 10
    if (settings.strictnessControl.level === 'lenient' && settings.confidenceSettings.threshold < 25) score -= 10
    if (settings.evaluationMode.multiModelAgreement && settings.systemControls.aiProvider !== 'both') score -= 8
    return Math.min(100, Math.max(0, score))
  }

  static getHealthLabel(score: number): { label: string; color: string } {
    if (score >= 85) return { label: 'Excellent', color: '#22C55E' }
    if (score >= 70) return { label: 'Good', color: '#84CC16' }
    if (score >= 50) return { label: 'Fair', color: '#F59E0B' }
    return { label: 'Needs Attention', color: '#EF4444' }
  }
}