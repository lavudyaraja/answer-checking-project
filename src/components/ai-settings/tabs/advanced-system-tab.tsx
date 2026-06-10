'use client'

import type { AIEvaluationSettings } from '@/types/ai-settings'
import {
  ToggleRow, SectionHeader, SettingsCard,
  NumberInputRow, SelectRow,
} from '@/components/ai-settings/settings-primitives'

// ─── Evaluation Mode + Feedback + Human Control ───────────────────────────────

interface AdvancedTabProps {
  settings: AIEvaluationSettings
  onChange: (updates: Partial<AIEvaluationSettings>) => void
}

export function AdvancedTab({ settings, onChange }: AdvancedTabProps) {
  const em  = settings.evaluationMode
  const fc  = settings.feedbackConfiguration
  const hc  = settings.humanControl
  const fr  = settings.fairnessReliability

  const EVAL_MODE_META: Record<string, { label: string; description: string; tag?: string }> = {
    multiPassSemantic:    { label: 'Multi-Pass Semantic Analysis',  description: 'Evaluate each answer in multiple passes for higher accuracy' },
    multiModelAgreement:  { label: 'Multi-Model Agreement',         description: 'Use both AI providers and agree on a consensus score' },
    reevaluationAmbiguous:{ label: 'Re-evaluate Ambiguous Answers', description: 'Automatically retry evaluation for unclear answers' },
    deepAnalysisMode:     { label: 'Deep Analysis Mode',            description: 'Perform detailed breakdown including sub-concept detection' },
    streamingFeedback:    { label: 'Streaming Feedback',            description: 'Stream feedback to the teacher in real time', tag: 'new' },
    batchEvaluationMode:  { label: 'Batch Evaluation Mode',         description: 'Queue and process many answers together for efficiency', tag: 'new' },
    comparativeEvaluation:{ label: 'Comparative Evaluation',        description: 'Compare each answer against the class average score', tag: 'new' },
  }

  const FEEDBACK_META: Record<string, { label: string; description: string; tag?: string }> = {
    showConceptUnderstanding:  { label: 'Show Concept Understanding',  description: 'Include a score for how well the core concept was understood' },
    showMissingConcepts:       { label: 'Show Missing Concepts',       description: 'List key ideas the student failed to include' },
    showIncorrectReasoning:    { label: 'Show Incorrect Reasoning',    description: 'Highlight flawed or incorrect reasoning steps' },
    showSuggestions:           { label: 'Show Improvement Suggestions',description: 'Provide actionable tips for a better answer' },
    showPersonalizedGuidance:  { label: 'Show Personalised Guidance',  description: 'Tailor feedback to the student\'s knowledge level' },
    showScoreBreakdown:        { label: 'Show Score Breakdown',        description: 'Display dimension-by-dimension score breakdown', tag: 'new' },
    showStrengthsFirst:        { label: 'Show Strengths First',        description: 'Lead feedback with what the student did well', tag: 'new' },
  }

  const HUMAN_META: Record<string, { label: string; description: string; tag?: string }> = {
    manualOverrideEnabled:     { label: 'Manual Override',             description: 'Allow teachers to override any AI-generated score' },
    teacherReviewLowConfidence:{ label: 'Teacher Review (Low Confidence)', description: 'Route low-confidence answers to a teacher dashboard' },
    reevaluationRequestSystem: { label: 'Re-evaluation Requests',     description: 'Allow students to request a second evaluation' },
    transparentReasoning:      { label: 'Transparent Reasoning',       description: 'Show teachers the detailed AI reasoning for every score' },
    auditTrailEnabled:         { label: 'Audit Trail',                 description: 'Log every evaluation action for compliance', tag: 'new' },
    teacherAnnotations:        { label: 'Teacher Annotations',         description: 'Allow teachers to annotate AI feedback inline', tag: 'new' },
    gradeAppealWorkflow:       { label: 'Grade Appeal Workflow',       description: 'Enable a structured appeal process for students', tag: 'new' },
  }

  const FAIRNESS_META: Record<string, { label: string; description: string; tag?: string }> = {
    avoidHandwritingBias:      { label: 'Avoid Handwriting Bias',      description: 'Ensure legibility does not unfairly affect marks' },
    evaluateSimpleLanguage:    { label: 'Evaluate Simple Language',    description: 'Do not penalise simple vocabulary if meaning is correct' },
    consistentMarking:         { label: 'Consistent Marking',          description: 'Apply identical standards across all students' },
    antiCopyDetection:         { label: 'Anti-Copy Detection',         description: 'Detect and flag similar or copied responses' },
    languageBiasReduction:     { label: 'Language Bias Reduction',     description: 'Reduce scoring bias for non-native language speakers', tag: 'new' },
    genderNeutralEvaluation:   { label: 'Gender-Neutral Evaluation',   description: 'Ensure scoring is unaffected by gendered language', tag: 'new' },
    socioeconomicFairness:     { label: 'Socioeconomic Fairness',      description: 'Avoid penalising answers that reflect economic context', tag: 'new' },
  }

  return (
    <div className="space-y-5">

      {/* Evaluation Mode */}
      <SettingsCard>
        <SectionHeader
          title="Evaluation Mode"
          description="Control how many passes and which models the AI uses per evaluation"
        />
        {Object.entries(em).map(([key, val]) => {
          const meta = EVAL_MODE_META[key]
          return (
            <ToggleRow
              key={key}
              label={meta?.label ?? key}
              description={meta?.description}
              tag={meta?.tag}
              checked={val as boolean}
              onChange={v => onChange({ evaluationMode: { ...em, [key]: v } })}
              disabled={
                (key === 'multiModelAgreement' && settings.systemControls.aiProvider !== 'both')
              }
            />
          )
        })}
        {em.multiModelAgreement && settings.systemControls.aiProvider !== 'both' && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
            Multi-model agreement requires AI provider to be set to "Both" in System settings.
          </p>
        )}
      </SettingsCard>

      {/* Feedback */}
      <SettingsCard>
        <SectionHeader
          title="Feedback Configuration"
          description="Customise the content, tone, and language of generated feedback"
        />
        {Object.entries(fc)
          .filter(([k]) => typeof fc[k as keyof typeof fc] === 'boolean')
          .map(([key, val]) => {
            const meta = FEEDBACK_META[key]
            return (
              <ToggleRow
                key={key}
                label={meta?.label ?? key}
                description={meta?.description}
                tag={meta?.tag}
                checked={val as boolean}
                onChange={v => onChange({ feedbackConfiguration: { ...fc, [key]: v } })}
              />
            )
          })}

        <SelectRow
          label="Feedback Tone"
          description="The tone used when writing student feedback"
          value={fc.feedbackTone}
          onChange={v => onChange({ feedbackConfiguration: { ...fc, feedbackTone: v } })}
          options={[
            { value: 'encouraging', label: 'Encouraging' },
            { value: 'neutral',     label: 'Neutral' },
            { value: 'critical',    label: 'Critical' },
          ]}
        />

        <SelectRow
          label="Feedback Language"
          description="Language for generated feedback text"
          value={fc.feedbackLanguage}
          onChange={v => onChange({ feedbackConfiguration: { ...fc, feedbackLanguage: v } })}
          options={[
            { value: 'en',   label: 'English' },
            { value: 'hi',   label: 'Hindi' },
            { value: 'auto', label: 'Auto-detect' },
          ]}
        />

        <NumberInputRow
          label="Max Feedback Length"
          description="Maximum number of words in generated feedback"
          value={fc.maxFeedbackLength}
          onChange={v => onChange({ feedbackConfiguration: { ...fc, maxFeedbackLength: v } })}
          min={20} max={2000} unit="words"
        />
      </SettingsCard>

      {/* Human Control */}
      <SettingsCard>
        <SectionHeader
          title="Human Control & Oversight"
          description="Teacher workflows, overrides, and transparency options"
        />
        {Object.entries(hc).map(([key, val]) => {
          const meta = HUMAN_META[key]
          return (
            <ToggleRow
              key={key}
              label={meta?.label ?? key}
              description={meta?.description}
              tag={meta?.tag}
              checked={val as boolean}
              onChange={v => onChange({ humanControl: { ...hc, [key]: v } })}
            />
          )
        })}
      </SettingsCard>

      {/* Fairness & Reliability */}
      <SettingsCard>
        <SectionHeader
          title="Fairness & Reliability"
          description="Settings to ensure equitable and consistent marking for all students"
        />
        {Object.entries(fr).map(([key, val]) => {
          const meta = FAIRNESS_META[key]
          return (
            <ToggleRow
              key={key}
              label={meta?.label ?? key}
              description={meta?.description}
              tag={meta?.tag}
              checked={val as boolean}
              onChange={v => onChange({ fairnessReliability: { ...fr, [key]: v } })}
            />
          )
        })}
      </SettingsCard>

    </div>
  )
}

// ─── System Tab ───────────────────────────────────────────────────────────────

interface SystemTabProps {
  settings: AIEvaluationSettings
  onChange: (updates: Partial<AIEvaluationSettings>) => void
}

export function SystemTab({ settings, onChange }: SystemTabProps) {
  const sc = settings.systemControls

  return (
    <div className="space-y-5">

      <SettingsCard>
        <SectionHeader
          title="AI Provider"
          description="Select which AI model(s) power the evaluation engine"
        />
        <SelectRow
          label="Provider"
          description="Claude offers higher accuracy; Groq is faster and cheaper"
          value={sc.aiProvider}
          onChange={v => onChange({ systemControls: { ...sc, aiProvider: v } })}
          options={[
            { value: 'claude', label: 'Claude — High accuracy' },
            { value: 'groq',   label: 'Groq — Fast & cost-effective' },
            { value: 'both',   label: 'Both — Balanced (recommended)' },
          ]}
        />
        <SelectRow
          label="Cost vs Accuracy"
          description="Trade-off between evaluation depth and API cost"
          value={sc.costVsAccuracy}
          onChange={v => onChange({ systemControls: { ...sc, costVsAccuracy: v } })}
          options={[
            { value: 'cost',     label: 'Cost-optimised (60% tokens)' },
            { value: 'balanced', label: 'Balanced (100% tokens)' },
            { value: 'accuracy', label: 'Accuracy-first (125% tokens)' },
          ]}
        />
      </SettingsCard>

      <SettingsCard>
        <SectionHeader
          title="Performance & Limits"
          description="Rate limits, timeouts, and infrastructure settings"
        />
        <NumberInputRow
          label="Rate Limit"
          description="Maximum evaluation requests per minute"
          value={sc.rateLimitPerMinute}
          onChange={v => onChange({ systemControls: { ...sc, rateLimitPerMinute: v } })}
          min={1} max={1000} unit="req/min"
        />
        <NumberInputRow
          label="Timeout"
          description="Maximum time to wait for an AI response before failing"
          value={sc.timeoutSeconds}
          onChange={v => onChange({ systemControls: { ...sc, timeoutSeconds: v } })}
          min={5} max={300} unit="sec"
        />
        <ToggleRow
          label="Retry on Failure"
          description="Automatically retry failed evaluations once"
          checked={sc.retryOnFailure}
          onChange={v => onChange({ systemControls: { ...sc, retryOnFailure: v } })}
        />
        <ToggleRow
          label="Response Caching"
          description="Cache identical evaluation requests to reduce cost"
          checked={sc.cachingEnabled}
          onChange={v => onChange({ systemControls: { ...sc, cachingEnabled: v } })}
        />
      </SettingsCard>

      <SettingsCard>
        <SectionHeader
          title="Logging & Debugging"
          description="Observability and developer tools"
        />
        <ToggleRow
          label="Logging Enabled"
          description="Record evaluation inputs, outputs, and scores"
          checked={sc.loggingEnabled}
          onChange={v => onChange({ systemControls: { ...sc, loggingEnabled: v } })}
        />
        <ToggleRow
          label="Debug Mode"
          description="Enable verbose logging and inspection of AI chain-of-thought"
          checked={sc.debugMode}
          onChange={v => onChange({ systemControls: { ...sc, debugMode: v } })}
        />
        <ToggleRow
          label="Webhook on Complete"
          description="Send a POST webhook when each batch evaluation finishes"
          checked={sc.webhookOnComplete}
          onChange={v => onChange({ systemControls: { ...sc, webhookOnComplete: v } })}
        />
      </SettingsCard>

    </div>
  )
}