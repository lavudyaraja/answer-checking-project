'use client'

import { useState, useCallback } from 'react'
import { AIEvaluationSettings, SettingsValidationResult } from '@/types/ai-settings'
import { DEFAULT_AI_SETTINGS } from '@/lib/ai-settings/default-settings'
import { AISettingsManager } from '@/lib/ai-settings/settings-manager'
import { settingsService } from '@/lib/ai-settings/settings-service'
import { SettingsHeader } from './settings-header'
import { SettingsOverview } from './settings-overview'
import { BehaviorTab } from './tabs/behavior-tab'
import { SemanticTab, PenaltyTab } from './tabs/semantic-penalty-tab'
import { ConstraintTab, SubjectTab } from './tabs/constraint-subject-tab'
import { AdvancedTab, SystemTab } from './tabs/advanced-system-tab'

interface AISettingsPageProps {
  initialSettings?: AIEvaluationSettings
  onSave?: (settings: AIEvaluationSettings) => void
}

export function AISettingsPage({ initialSettings, onSave }: AISettingsPageProps) {
  const [settings, setSettings] = useState<AIEvaluationSettings>(initialSettings || getDefaultSettings())
  const [validation, setValidation] = useState<SettingsValidationResult>({ isValid: true, errors: [], warnings: [], score: 100 })
  const [activeTab, setActiveTab] = useState<'behavior' | 'semantic' | 'constraint' | 'subject' | 'advanced'>('behavior')
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const updateSettings = useCallback((updates: Partial<AIEvaluationSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
    setHasUnsavedChanges(true)
    setValidation(AISettingsManager.validateSettings({ ...settings, ...updates }))
  }, [settings])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await settingsService.updateSettings(settings)
      setHasUnsavedChanges(false)
      onSave?.(settings)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSaving(false)
    }
  }, [settings, onSave])

  const handleReset = useCallback(() => {
    setSettings(getDefaultSettings())
    setHasUnsavedChanges(true)
    setValidation(AISettingsManager.validateSettings(getDefaultSettings()))
  }, [])

  const getSaveStatus = (): 'saved' | 'unsaved' | 'saving' | 'error' => {
    if (isSaving) return 'saving'
    if (!hasUnsavedChanges) return 'saved'
    return 'unsaved'
  }

  const handleLoadPreset = useCallback((presetId: string) => {
    // TODO: Implement preset loading
    console.log('Loading preset:', presetId)
  }, [])

  const handleImport = useCallback((file: File) => {
    // TODO: Implement import functionality
    console.log('Importing file:', file.name)
  }, [])

  const tabs = [
    { id: 'behavior', label: 'Behavior', component: BehaviorTab },
    { id: 'semantic', label: 'Semantic', component: SemanticTab },
    { id: 'constraint', label: 'Constraints', component: ConstraintTab },
    { id: 'subject', label: 'Subjects', component: SubjectTab },
    { id: 'advanced', label: 'Advanced', component: AdvancedTab }
  ]

  const ActiveTabComponent = tabs.find(tab => tab.id === activeTab)?.component

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <SettingsHeader
        settings={settings}
        validation={validation}
        saveStatus={getSaveStatus()}
        onSave={handleSave}
        onReset={handleReset}
        onLoadPreset={handleLoadPreset}
        onImport={handleImport}
        isLoading={isSaving}
      />
      
      <SettingsOverview
        settings={settings}
        validation={validation}
      />

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {ActiveTabComponent && (
            <ActiveTabComponent
              settings={settings}
              onChange={updateSettings}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function getDefaultSettings(): AIEvaluationSettings {
  return DEFAULT_AI_SETTINGS
}
