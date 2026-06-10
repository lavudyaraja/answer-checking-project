'use client'

import { TrendingUp, DollarSign, SlidersHorizontal, ShieldCheck, AlertTriangle, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AISettingsManager } from '@/lib/ai-settings/settings-manager'
import type { AIEvaluationSettings, SettingsValidationResult } from '@/types/ai-settings'
import { cn } from '@/lib/utils'

interface SettingsOverviewProps {
  settings: AIEvaluationSettings
  validation: SettingsValidationResult
}

export function SettingsOverview({ settings, validation }: SettingsOverviewProps) {
  const cost = AISettingsManager.estimateCostPerEvaluation(settings)
  const health = AISettingsManager.getHealthScore(settings)
  const healthMeta = AISettingsManager.getHealthLabel(health)

  const kpis = [
    {
      label: 'Settings Health',
      value: `${health}%`,
      sub: healthMeta.label,
      icon: <TrendingUp className="h-4 w-4" />,
      accent: healthMeta.color,
      bar: health,
    },
    {
      label: 'Est. Cost / Eval',
      value: `$${cost.cost}`,
      sub: `~${cost.tokens.toLocaleString()} tokens`,
      icon: <DollarSign className="h-4 w-4" />,
      accent: '#6366F1',
      bar: null,
    },
    {
      label: 'Strictness Mode',
      value: settings.strictnessControl.level.charAt(0).toUpperCase() + settings.strictnessControl.level.slice(1),
      sub: settings.strictnessControl.difficultyAware ? 'Difficulty-aware' : 'Fixed',
      icon: <SlidersHorizontal className="h-4 w-4" />,
      accent: settings.strictnessControl.level === 'strict' ? '#EF4444'
             : settings.strictnessControl.level === 'lenient' ? '#22C55E'
             : '#F59E0B',
      bar: null,
    },
    {
      label: 'Confidence Threshold',
      value: `${settings.confidenceSettings.threshold}%`,
      sub: settings.confidenceSettings.autoHumanReview ? 'Auto-review enabled' : 'No auto-review',
      icon: <ShieldCheck className="h-4 w-4" />,
      accent: '#3B82F6',
      bar: settings.confidenceSettings.threshold,
    },
  ]

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(kpi => (
          <div
            key={kpi.label}
            className="border border-slate-200 rounded-xl bg-white p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                {kpi.label}
              </span>
              <span className="p-1.5 rounded-lg bg-slate-50 text-slate-500">
                {kpi.icon}
              </span>
            </div>
            <div>
              <div
                className="text-2xl font-bold tracking-tight"
                style={{ color: kpi.accent }}
              >
                {kpi.value}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{kpi.sub}</div>
            </div>
            {kpi.bar !== null && (
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${kpi.bar}%`, background: kpi.accent }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Provider + mode summary strip */}
      <div className="border border-slate-200 rounded-xl bg-white px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
        <SummaryChip label="Provider" value={settings.systemControls.aiProvider} />
        <div className="h-4 w-px bg-slate-200" />
        <SummaryChip label="Cost mode" value={settings.systemControls.costVsAccuracy} />
        <div className="h-4 w-px bg-slate-200" />
        <SummaryChip label="Multi-pass" value={settings.evaluationMode.multiPassSemantic ? 'On' : 'Off'} />
        <div className="h-4 w-px bg-slate-200" />
        <SummaryChip label="Multi-model" value={settings.evaluationMode.multiModelAgreement ? 'On' : 'Off'} />
        <div className="h-4 w-px bg-slate-200" />
        <SummaryChip label="Deep analysis" value={settings.evaluationMode.deepAnalysisMode ? 'On' : 'Off'} />
        <div className="h-4 w-px bg-slate-200" />
        <SummaryChip label="Feedback tone" value={settings.feedbackConfiguration.feedbackTone} />
      </div>

      {/* Validation issues */}
      {validation.errors.length > 0 && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-sm text-red-700 space-y-1">
            {validation.errors.map((e, i) => <div key={i}>• {e}</div>)}
          </AlertDescription>
        </Alert>
      )}

      {validation.warnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm text-amber-700 space-y-1">
            {validation.warnings.map((w, i) => <div key={i}>• {w}</div>)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-slate-500">
      {label}:{' '}
      <span className="font-medium text-slate-800 capitalize">{value}</span>
    </span>
  )
}