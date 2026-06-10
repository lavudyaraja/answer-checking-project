'use client'

import { cn } from '@/lib/utils'
import type { AIEvaluationSettings } from '@/types/ai-settings'
import {
  SliderRow, SectionHeader, SettingsCard, WeightBar,
} from '@/components/ai-settings/settings-primitives'

// ─── Semantic Weights Tab ─────────────────────────────────────────────────────

const WEIGHT_COLORS: Record<string, string> = {
  conceptualUnderstanding: '#6366F1',
  logicalReasoning:        '#3B82F6',
  completeness:            '#22C55E',
  accuracy:                '#F59E0B',
  clarity:                 '#EC4899',
}

const WEIGHT_META: Record<string, { label: string; description: string }> = {
  conceptualUnderstanding: { label: 'Conceptual Understanding', description: 'How well the student grasps the core idea' },
  logicalReasoning:        { label: 'Logical Reasoning',        description: 'Clarity and validity of the reasoning chain' },
  completeness:            { label: 'Completeness',             description: 'Coverage of all expected key points' },
  accuracy:                { label: 'Accuracy',                 description: 'Factual and numerical correctness' },
  clarity:                 { label: 'Clarity',                  description: 'How clearly the response is communicated' },
}

interface SemanticTabProps {
  settings: AIEvaluationSettings
  onChange: (updates: Partial<AIEvaluationSettings>) => void
}

export function SemanticTab({ settings, onChange }: SemanticTabProps) {
  const sw = settings.semanticWeights
  const total = Object.values(sw).reduce((s, v) => s + v, 0)
  const isValid = total === 100

  const setWeight = (key: string, val: number) =>
    onChange({ semanticWeights: { ...sw, [key]: val } })

  return (
    <div className="space-y-5">

      {/* Visual bar */}
      <SettingsCard>
        <SectionHeader
          title="Weight Distribution"
          description="Visual breakdown of how marks are allocated across dimensions"
        />
        <WeightBar weights={sw as unknown as Record<string, number>} colors={WEIGHT_COLORS} />
      </SettingsCard>

      {/* Sliders */}
      <SettingsCard>
        <div className="flex items-center justify-between mb-5">
          <SectionHeader
            title="Semantic Weights"
            description="Adjust the relative importance of each evaluation dimension"
            className="mb-0"
          />
          <span className={cn(
            'text-sm font-semibold tabular-nums px-2.5 py-1 rounded-lg border',
            isValid
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : 'text-red-600 bg-red-50 border-red-200',
          )}>
            Total: {total}%
          </span>
        </div>

        {Object.entries(sw).map(([key, val]) => {
          const meta = WEIGHT_META[key]
          return (
            <SliderRow
              key={key}
              label={meta?.label ?? key}
              description={meta?.description}
              value={val}
              onChange={v => setWeight(key, v)}
              colorFn={() => WEIGHT_COLORS[key] ?? '#94A3B8'}
            />
          )
        })}

        {!isValid && (
          <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            Weights must sum to exactly 100%. Current total: {total}%.
            {total > 100 && ` Reduce by ${total - 100}%.`}
            {total < 100 && ` Increase by ${100 - total}%.`}
          </div>
        )}
      </SettingsCard>

    </div>
  )
}

// ─── Penalty Tab ──────────────────────────────────────────────────────────────

const PENALTY_META: Record<string, { label: string; description: string; tag?: string; severity: 'high' | 'medium' | 'low' }> = {
  wrongConceptPenalty:           { label: 'Wrong Concept',             description: 'Student demonstrates completely incorrect conceptual understanding', severity: 'high' },
  contradictionPenalty:          { label: 'Contradiction',             description: 'Answer contains internally contradictory statements', severity: 'high' },
  plagiarismPenalty:             { label: 'Plagiarism / Copy-Paste',   description: 'Detected copying from another source or student', severity: 'high', tag: 'new' },
  partiallyCorrectPenalty:       { label: 'Partially Correct',         description: 'Core concept present but key details are missing', severity: 'medium' },
  logicalInconsistencyPenalty:   { label: 'Logical Inconsistency',     description: 'Reasoning is flawed or reaches an incorrect conclusion', severity: 'medium' },
  offTopicPenalty:               { label: 'Off-Topic Response',        description: 'Answer does not address the question asked', severity: 'medium', tag: 'new' },
  missingImportantIdeaPenalty:   { label: 'Missing Important Idea',    description: 'A key concept required by the model answer is absent', severity: 'medium' },
  extraIrrelevantContentPenalty: { label: 'Extra Irrelevant Content',  description: 'Unnecessary padding or off-topic filler in the answer', severity: 'low' },
}

const SEVERITY_COLOR = {
  high:   '#EF4444',
  medium: '#F59E0B',
  low:    '#94A3B8',
}

interface PenaltyTabProps {
  settings: AIEvaluationSettings
  onChange: (updates: Partial<AIEvaluationSettings>) => void
}

export function PenaltyTab({ settings, onChange }: PenaltyTabProps) {
  const pr = settings.penaltyRules

  const setPenalty = (key: string, val: number) =>
    onChange({ penaltyRules: { ...pr, [key]: val } })

  const groups = {
    high:   Object.entries(pr).filter(([k]) => PENALTY_META[k]?.severity === 'high'),
    medium: Object.entries(pr).filter(([k]) => PENALTY_META[k]?.severity === 'medium'),
    low:    Object.entries(pr).filter(([k]) => PENALTY_META[k]?.severity === 'low'),
  }

  return (
    <div className="space-y-5">

      {(['high', 'medium', 'low'] as const).map(severity => (
        <SettingsCard key={severity}>
          <SectionHeader
            title={severity === 'high' ? 'Critical Penalties' : severity === 'medium' ? 'Moderate Penalties' : 'Minor Penalties'}
            description={
              severity === 'high'   ? 'Major conceptual errors and academic integrity violations' :
              severity === 'medium' ? 'Reasoning and coverage issues' :
              'Minor content quality issues'
            }
            badge={`${groups[severity].length} rules`}
          />
          {groups[severity].map(([key, val]) => {
            const meta = PENALTY_META[key]
            return (
              <SliderRow
                key={key}
                label={meta?.label ?? key}
                description={meta?.description}
                value={val as number}
                onChange={v => setPenalty(key, v)}
                colorFn={() => SEVERITY_COLOR[severity]}
              />
            )
          })}
        </SettingsCard>
      ))}

      {/* Penalty preview note */}
      <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <strong className="text-slate-600">How penalties work:</strong> A penalty of 80% on a 10-mark question where a wrong
        concept is detected means the student loses up to 8 marks from that dimension's allocation. Penalties compound
        with the semantic weight of each dimension.
      </div>

    </div>
  )
}