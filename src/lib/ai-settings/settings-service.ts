import type { AIEvaluationSettings } from '@/types/ai-settings'
import { DEFAULT_AI_SETTINGS } from './default-settings'

/**
 * AI Settings Service — v2
 * Retrieval, caching, profiles, auto-save
 */
class SettingsService {
  private cache: AIEvaluationSettings | null = null
  private cacheExpiry = 0
  private readonly CACHE_TTL = 5 * 60 * 1000  // 5 min
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null
  private pendingUpdates: Partial<AIEvaluationSettings> | null = null
  readonly AUTO_SAVE_DELAY = 2000  // 2 s debounce

  // ─── Core ────────────────────────────────────────────────────────────────────

  async getSettings(): Promise<AIEvaluationSettings> {
    if (this.cache && Date.now() < this.cacheExpiry) return this.cache

    try {
      const res = await fetch('/api/ai-settings')
      if (!res.ok) return DEFAULT_AI_SETTINGS
      const data: AIEvaluationSettings = await res.json()
      this.cache = data
      this.cacheExpiry = Date.now() + this.CACHE_TTL
      return data
    } catch {
      return DEFAULT_AI_SETTINGS
    }
  }

  async updateSettings(updates: Partial<AIEvaluationSettings>): Promise<AIEvaluationSettings> {
    const res = await fetch('/api/ai-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to update settings')
    const updated: AIEvaluationSettings = await res.json()
    this.cache = updated
    this.cacheExpiry = Date.now() + this.CACHE_TTL
    return updated
  }

  /**
   * Debounced auto-save: accumulates changes and flushes after delay
   */
  scheduleAutoSave(
    updates: Partial<AIEvaluationSettings>,
    onSave?: (s: AIEvaluationSettings) => void,
  ) {
    this.pendingUpdates = { ...(this.pendingUpdates ?? {}), ...updates }
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer)
    this.autoSaveTimer = setTimeout(async () => {
      if (!this.pendingUpdates) return
      try {
        const saved = await this.updateSettings(this.pendingUpdates)
        this.pendingUpdates = null
        onSave?.(saved)
      } catch (e) {
        console.error('[SettingsService] Auto-save failed:', e)
      }
    }, this.AUTO_SAVE_DELAY)
  }

  clearCache() {
    this.cache = null
    this.cacheExpiry = 0
  }

  // ─── Derived helpers ─────────────────────────────────────────────────────────

  async getProviderConfig() {
    const s = await this.getSettings()
    return {
      provider: s.systemControls.aiProvider,
      costMode: s.systemControls.costVsAccuracy,
      temperature: this.getTemperature(s),
      maxTokens: this.getMaxTokens(s),
    }
  }

  getTemperature(
    settings: AIEvaluationSettings,
    context: 'evaluation' | 'feedback' | 'extraction' = 'evaluation',
  ): number {
    if (context === 'feedback') return 0.3
    if (context === 'extraction') return 0
    return 0
  }

  getMaxTokens(settings: AIEvaluationSettings): number {
    let base = 4000
    const { costVsAccuracy } = settings.systemControls
    if (costVsAccuracy === 'cost') base = Math.floor(base * 0.6)
    if (costVsAccuracy === 'accuracy') base = Math.floor(base * 1.25)
    return base
  }

  async getSemanticWeights() { return (await this.getSettings()).semanticWeights }
  async getPenaltyRules()    { return (await this.getSettings()).penaltyRules }
  async getConfidenceThreshold() { return (await this.getSettings()).confidenceSettings.threshold }
  async getStrictnessLevel() { return (await this.getSettings()).strictnessControl.level }
  async getEvaluationBehavior() { return (await this.getSettings()).evaluationBehavior }
  async getBehaviorConstraints() { return (await this.getSettings()).aiBehaviorConstraints }
  async getSubjectSettings() { return (await this.getSettings()).subjectSpecific }

  async shouldTriggerHumanReview(confidence: number) {
    const s = await this.getSettings()
    return confidence < s.confidenceSettings.threshold && s.confidenceSettings.autoHumanReview
  }

  // ─── Profiles ────────────────────────────────────────────────────────────────

  async getProfiles(): Promise<Array<{ id: string; name: string; description?: string }>> {
    try {
      const res = await fetch('/api/ai-settings/profiles')
      if (!res.ok) return []
      return res.json()
    } catch { return [] }
  }

  async saveProfile(name: string, settings: AIEvaluationSettings): Promise<void> {
    await fetch('/api/ai-settings/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, settings }),
    })
  }

  async deleteProfile(id: string): Promise<void> {
    await fetch(`/api/ai-settings/profiles/${id}`, { method: 'DELETE' })
  }
}

export const settingsService = new SettingsService()