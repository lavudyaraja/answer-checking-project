import type { AIProvider } from '@/lib/ai/ai-provider'
import { getClaudeProvider } from '@/lib/ai/providers/claude'
import { getGroqProvider } from '@/lib/ai/providers/groq'
import { settingsService } from '@/lib/ai-settings/settings-service'

/**
 * Adaptive AI Provider
 * Selects and uses AI provider based on settings
 */

export interface ProviderConfig {
  provider: 'claude' | 'groq' | 'both'
  temperature: number
  maxTokens: number
  costMode: 'cost' | 'balanced' | 'accuracy'
}

export class AdaptiveProvider {
  private claude = getClaudeProvider()
  private groq = getGroqProvider()

  /**
   * Get the appropriate AI provider based on settings
   */
  async getProvider(override?: AIProvider) {
    if (override) {
      return override === 'claude' ? this.claude : this.groq
    }
    const config = await settingsService.getProviderConfig()

    switch (config.provider) {
      case 'claude':
        return this.claude
      case 'groq':
        return this.groq
      case 'both':
        return this.selectProviderBasedOnContext(config)
      default:
        return this.claude
    }
  }

  /**
   * Select provider based on context and cost mode
   */
  private selectProviderBasedOnContext(config: ProviderConfig): ReturnType<typeof getClaudeProvider> | ReturnType<typeof getGroqProvider> {
    const { costMode } = config

    if (costMode === 'cost') {
      return this.groq // More cost-effective
    } else if (costMode === 'accuracy') {
      return this.claude // Higher accuracy
    } else {
      return this.claude // Balanced default to Claude
    }
  }

  /**
   * Run text evaluation with adaptive provider
   */
  async runTextEvaluation(params: {
    prompt: string
    context?: 'evaluation' | 'feedback' | 'extraction'
    overrideProvider?: AIProvider
  }): Promise<string> {
    const settings = await settingsService.getSettings()
    const provider = await this.getProvider(params.overrideProvider)
    const config = await settingsService.getProviderConfig()

    const temperature = settingsService.getTemperature(settings, params.context || 'evaluation')
    const maxTokens = settingsService.getMaxTokens(settings)

    return provider.runText({
      prompt: params.prompt,
      temperature,
      maxTokens
    })
  }

  /**
   * Run vision evaluation with adaptive provider
   */
  async runVisionEvaluation(params: {
    prompt: string
    imageDataUrl: string
    context?: 'evaluation' | 'feedback' | 'extraction'
    overrideProvider?: AIProvider
  }): Promise<string> {
    const settings = await settingsService.getSettings()
    const provider = await this.getProvider(params.overrideProvider)
    const config = await settingsService.getProviderConfig()

    const temperature = settingsService.getTemperature(settings, params.context || 'evaluation')
    const maxTokens = settingsService.getMaxTokens(settings)

    return provider.runVisionJSON({
      promptText: params.prompt,
      imageDataUrl: params.imageDataUrl,
      temperature,
      maxTokens
    })
  }

  /**
   * Run multi-model evaluation (both providers)
   */
  async runMultiModelEvaluation(params: {
    prompt: string
    imageDataUrl?: string
    context?: 'evaluation' | 'feedback'
  }): Promise<{ claude: string; groq: string; consensus: string }> {
    const settings = await settingsService.getSettings()
    const temperature = settingsService.getTemperature(settings, params.context || 'evaluation')
    const maxTokens = settingsService.getMaxTokens(settings)

    // Run both providers in parallel
    const [claudeResult, groqResult] = await Promise.all([
      params.imageDataUrl
        ? this.claude.runVisionJSON({
          promptText: params.prompt,
          imageDataUrl: params.imageDataUrl,
          temperature,
          maxTokens
        })
        : this.claude.runText({
          prompt: params.prompt,
          temperature,
          maxTokens
        }),
      params.imageDataUrl
        ? this.groq.runVisionJSON({
          promptText: params.prompt,
          imageDataUrl: params.imageDataUrl,
          temperature,
          maxTokens
        })
        : this.groq.runText({
          prompt: params.prompt,
          temperature,
          maxTokens
        })
    ])

    // Simple consensus (could be enhanced)
    const consensus = claudeResult.length > groqResult.length ? claudeResult : groqResult

    return {
      claude: claudeResult,
      groq: groqResult,
      consensus
    }
  }

  /**
   * Get provider info for logging/debugging
   */
  async getProviderInfo(): Promise<{
    selectedProvider: string
    costMode: string
    temperature: number
    maxTokens: number
  }> {
    const config = await settingsService.getProviderConfig()
    const settings = await settingsService.getSettings()

    return {
      selectedProvider: config.provider,
      costMode: config.costMode,
      temperature: settingsService.getTemperature(settings),
      maxTokens: settingsService.getMaxTokens(settings)
    }
  }
}

// Export singleton instance
export const adaptiveProvider = new AdaptiveProvider()
