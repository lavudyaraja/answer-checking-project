'use client'

import { useState, useEffect, useCallback } from 'react'
import { AISettingsManager } from '@/lib/ai-settings/settings-manager'
import { DEFAULT_AI_SETTINGS, SETTINGS_PRESETS } from '@/lib/ai-settings/default-settings'
import type { AIEvaluationSettings, SettingsValidationResult } from '@/types/ai-settings'

import { SettingsHeader } from '@/components/ai-settings/settings-header'
import { SettingsOverview } from '@/components/ai-settings/settings-overview'
import { BehaviorTab } from '@/components/ai-settings/tabs/behavior-tab'
import { SemanticTab, PenaltyTab } from '@/components/ai-settings/tabs/semantic-penalty-tab'
import { ConstraintTab, SubjectTab } from '@/components/ai-settings/tabs/constraint-subject-tab'
import { AdvancedTab, SystemTab } from '@/components/ai-settings/tabs/advanced-system-tab'

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'behavior',   label: 'Behavior'   },
  { id: 'semantic',   label: 'Semantic'   },
  { id: 'penalties',  label: 'Penalties'  },
  { id: 'constraints',label: 'Constraints'},
  { id: 'subjects',   label: 'Subjects'   },
  { id: 'advanced',   label: 'Advanced'   },
  { id: 'system',     label: 'System'     },
] as const

type TabId = typeof TABS[number]['id']
type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error'

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AISettingsPage() {
  const [settings, setSettings]     = useState<AIEvaluationSettings>(DEFAULT_AI_SETTINGS)
  const [validation, setValidation] = useState<SettingsValidationResult>({ isValid: true, errors: [], warnings: [], score: 100 })
  const [activeTab, setActiveTab]   = useState<TabId>('behavior')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [isLoading, setIsLoading]   = useState(false)

  // ─── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/ai-settings')
        if (res.ok) {
          const data = await res.json()
          setSettings(data)
          setSaveStatus('saved')
        }
      } catch {
        /* silently fall back to defaults */
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // ─── Update ────────────────────────────────────────────────────────────────

  const handleChange = useCallback((updates: Partial<AIEvaluationSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates, updatedAt: new Date() }
      setValidation(AISettingsManager.validateSettings(next))
      return next
    })
    setSaveStatus('unsaved')
  }, [])

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/ai-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      setSaveStatus(res.ok ? 'saved' : 'error')
    } catch {
      setSaveStatus('error')
    }
  }

  // ─── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setSettings(DEFAULT_AI_SETTINGS)
    setValidation(AISettingsManager.validateSettings(DEFAULT_AI_SETTINGS))
    setSaveStatus('unsaved')
  }

  // ─── Preset ────────────────────────────────────────────────────────────────

  const handleLoadPreset = (id: string) => {
    const preset = SETTINGS_PRESETS.find(p => p.id === id)
    if (!preset) return
    const merged = AISettingsManager.mergeWithDefaults(preset.settings)
    setSettings(merged)
    setValidation(AISettingsManager.validateSettings(merged))
    setSaveStatus('unsaved')
  }

  // ─── Import ────────────────────────────────────────────────────────────────

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string)
        const { settings: imported, validation: v } = AISettingsManager.importSettings(data)
        setSettings(imported)
        setValidation(v)
        setSaveStatus('unsaved')
      } catch {
        /* handle parse error silently */
      }
    }
    reader.readAsText(file)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <SettingsHeader
          settings={settings}
          validation={validation}
          saveStatus={saveStatus}
          onSave={handleSave}
          onReset={handleReset}
          onLoadPreset={handleLoadPreset}
          onImport={handleImport}
          isLoading={isLoading}
        />

        {/* Overview cards */}
        <div className="mb-6">
          <SettingsOverview settings={settings} validation={validation} />
        </div>

        {/* Tab nav */}
        <div className="flex items-center gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="pb-16">
          {activeTab === 'behavior'    && <BehaviorTab    settings={settings} onChange={handleChange} />}
          {activeTab === 'semantic'    && <SemanticTab    settings={settings} onChange={handleChange} />}
          {activeTab === 'penalties'   && <PenaltyTab     settings={settings} onChange={handleChange} />}
          {activeTab === 'constraints' && <ConstraintTab  settings={settings} onChange={handleChange} />}
          {activeTab === 'subjects'    && <SubjectTab     settings={settings} onChange={handleChange} />}
          {activeTab === 'advanced'    && <AdvancedTab    settings={settings} onChange={handleChange} />}
          {activeTab === 'system'      && <SystemTab      settings={settings} onChange={handleChange} />}
        </div>

      </div>
    </div>
  )
}