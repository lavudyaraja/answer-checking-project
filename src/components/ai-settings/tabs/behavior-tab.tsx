'use client'

import type { AIEvaluationSettings } from '@/types/ai-settings'
import {
  ToggleRow, SliderRow, SelectRow,
  SectionHeader, SettingsCard, NumberInputRow,
} from '@/components/ai-settings/settings-primitives'

interface BehaviorTabProps {
  settings: AIEvaluationSettings
  onChange: (updates: Partial<AIEvaluationSettings>) => void
}

const BEHAVIOR_META: Record<string, { label: string; description: string; tag?: string }> = {
  allowPartialMarking:               { label: 'Allow Partial Marking',              description: 'Award marks for partially correct understanding' },
  penalizeConceptualMisunderstanding:{ label: 'Penalize Conceptual Errors',         description: 'Apply heavier deductions for wrong core concepts' },
  acceptAlternativeAnswers:          { label: 'Accept Alternative Answers',         description: 'Accept correct alternatives phrased differently' },
  ignoreGrammarMistakes:             { label: 'Ignore Grammar Mistakes',            description: 'Overlook grammar errors that do not affect meaning' },
  rewardLogicalReasoning:            { label: 'Reward Logical Reasoning',           description: 'Give extra credit for a clear, logical response flow' },
  allowHandwritingInterpretation:    { label: 'Allow Handwriting Interpretation',   description: 'Use context to interpret unclear handwritten text' },
  focusOnUnderstandingOverMemorization:{ label: 'Prioritize Understanding',         description: 'Reward conceptual grasp over verbatim recall' },
  requireExampleInLongAnswers:       { label: 'Require Examples in Long Answers',   description: 'Deduct if long answers lack supporting examples', tag: 'new' },
  detectOffTopicResponses:           { label: 'Detect Off-Topic Responses',         description: 'Flag answers that deviate from the question', tag: 'new' },
  penalizeCircularReasoning:         { label: 'Penalize Circular Reasoning',        description: 'Reduce marks for arguments that repeat themselves', tag: 'new' },
}

const STRICTNESS_OPTIONS = [
  { value: 'strict' as const,   label: 'Strict — exact concept match required' },
  { value: 'moderate' as const, label: 'Moderate — similar meaning accepted' },
  { value: 'lenient' as const,  label: 'Lenient — partial match allowed' },
]

export function BehaviorTab({ settings, onChange }: BehaviorTabProps) {
  const b = settings.evaluationBehavior
  const sc = settings.strictnessControl

  const setB = (key: string, val: boolean) =>
    onChange({ evaluationBehavior: { ...b, [key]: val } })

  const setSC = (updates: Partial<typeof sc>) =>
    onChange({ strictnessControl: { ...sc, ...updates } })

  return (
    <div className="space-y-5">

      {/* Behavior toggles */}
      <SettingsCard>
        <SectionHeader
          title="Evaluation Behavior"
          description="How the AI interprets and scores student responses"
        />
        <div className="divide-y divide-slate-100">
          {Object.entries(b).map(([key, val]) => {
            const meta = BEHAVIOR_META[key]
            return (
              <ToggleRow
                key={key}
                label={meta?.label ?? key}
                description={meta?.description}
                tag={meta?.tag}
                checked={val}
                onChange={v => setB(key, v)}
              />
            )
          })}
        </div>
      </SettingsCard>

      {/* Strictness */}
      <SettingsCard>
        <SectionHeader
          title="Strictness Control"
          description="Controls how tightly the AI matches answers to the model solution"
        />
        <SelectRow
          label="Strictness Level"
          description="Overall evaluation standard applied to all answers"
          value={sc.level}
          onChange={v => setSC({ level: v })}
          options={STRICTNESS_OPTIONS}
        />
        <ToggleRow
          label="Difficulty-Aware Strictness"
          description="Automatically adjust strictness based on question difficulty level"
          checked={sc.difficultyAware}
          onChange={v => setSC({ difficultyAware: v })}
        />
        <ToggleRow
          label="Adaptive Strictness"
          tag="new"
          description="Tune strictness dynamically based on class average performance"
          checked={sc.adaptiveStrictness}
          onChange={v => setSC({ adaptiveStrictness: v })}
        />
        <NumberInputRow
          label="Minimum Pass Threshold"
          description="Minimum score (%) a student must achieve to pass"
          value={sc.minimumPassThreshold}
          onChange={v => setSC({ minimumPassThreshold: v })}
          min={0}
          max={100}
          unit="%"
        />
      </SettingsCard>

    </div>
  )
}