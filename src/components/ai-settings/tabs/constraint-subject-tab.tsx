'use client'

import type { AIEvaluationSettings } from '@/types/ai-settings'
import { useState } from 'react'
import {
  ToggleRow, SectionHeader, SettingsCard, NumberInputRow, SelectRow,
} from '@/components/ai-settings/settings-primitives'

// ─── Constraint Tab ───────────────────────────────────────────────────────────

const CONSTRAINT_META: Record<string, { label: string; description: string; tag?: string }> = {
  evaluateMeaningNotWording:       { label: 'Evaluate Meaning, Not Wording',         description: 'Assess conceptual content rather than exact phrasing' },
  avoidKeywordMatching:            { label: 'Avoid Keyword Matching',                description: 'Do not score based on matching specific keywords' },
  dontAssumeMissingConcepts:       { label: "Don't Assume Missing Concepts",         description: 'Only assess what is explicitly written; do not infer' },
  reduceConfidenceIfUnclear:       { label: 'Reduce Confidence If Unclear',          description: 'Lower the confidence score when the answer is ambiguous' },
  neverFullMarksIfCoreMissing:     { label: 'Never Full Marks If Core Missing',      description: 'Cap marks below 100% if the core concept is absent' },
  acceptValidAlternatives:         { label: 'Accept Valid Alternatives',             description: 'Award full marks for correct alternative explanations' },
  focusOnUnderstandingOverMemorization: { label: 'Prioritize Understanding',         description: 'Reward conceptual understanding over memorized content' },
  crossReferenceWithModelAnswer:   { label: 'Cross-Reference Model Answer',          description: 'Compare student answer against model answer semantically', tag: 'new' },
  detectCopyPaste:                 { label: 'Detect Copy-Paste',                     description: 'Flag answers with suspicious similarity to other submissions', tag: 'new' },
  enforceAnswerLengthBounds:       { label: 'Enforce Answer Length Bounds',          description: 'Penalize answers that are too short or excessively long', tag: 'new' },
}

const MATCHING_META: Record<string, { label: string; description: string; tag?: string }> = {
  conceptLevelMatching:          { label: 'Concept-Level Matching',       description: 'Match at the level of ideas, not individual words' },
  sentenceLevelMeaning:          { label: 'Sentence-Level Meaning',       description: 'Evaluate the meaning of complete sentences' },
  contextUnderstanding:          { label: 'Context Understanding',        description: 'Use surrounding context to interpret individual statements' },
  synonymParaphraseRecognition:  { label: 'Synonym & Paraphrase',         description: 'Recognise synonyms and paraphrased equivalents' },
  multiConceptDetection:         { label: 'Multi-Concept Detection',      description: 'Detect when an answer covers multiple required concepts' },
  relationshipUnderstanding:     { label: 'Relationship Understanding',   description: 'Understand cause-effect and other concept relationships' },
  crossLanguageSupport:          { label: 'Cross-Language Support',       description: 'Handle answers written in a language other than the question', tag: 'new' },
  technicalTermTolerance:        { label: 'Technical Term Tolerance',     description: 'Accept informal descriptions of technical terms', tag: 'new' },
  hierarchicalConceptMatching:   { label: 'Hierarchical Concept Matching',description: 'Match concepts in parent-child hierarchies (e.g., mammals→dogs)', tag: 'new' },
}

interface ConstraintTabProps {
  settings: AIEvaluationSettings
  onChange: (updates: Partial<AIEvaluationSettings>) => void
}

export function ConstraintTab({ settings, onChange }: ConstraintTabProps) {
  const abc = settings.aiBehaviorConstraints
  const sm  = settings.semanticMatching
  const conf = settings.confidenceSettings

  return (
    <div className="space-y-5">

      {/* AI Behavior Constraints */}
      <SettingsCard>
        <SectionHeader
          title="AI Behavior Constraints"
          description="Core rules that govern how the AI interprets and scores answers"
        />
        {Object.entries(abc).map(([key, val]) => {
          const meta = CONSTRAINT_META[key]
          return (
            <ToggleRow
              key={key}
              label={meta?.label ?? key}
              description={meta?.description}
              tag={meta?.tag}
              checked={val as boolean}
              onChange={v => onChange({ aiBehaviorConstraints: { ...abc, [key]: v } })}
            />
          )
        })}
      </SettingsCard>

      {/* Semantic Matching Strategy */}
      <SettingsCard>
        <SectionHeader
          title="Semantic Matching Strategy"
          description="How the AI recognises equivalent concepts in student answers"
        />
        {Object.entries(sm).map(([key, val]) => {
          const meta = MATCHING_META[key]
          return (
            <ToggleRow
              key={key}
              label={meta?.label ?? key}
              description={meta?.description}
              tag={meta?.tag}
              checked={val as boolean}
              onChange={v => onChange({ semanticMatching: { ...sm, [key]: v } })}
            />
          )
        })}
      </SettingsCard>

      {/* Confidence Settings */}
      <SettingsCard>
        <SectionHeader
          title="Confidence Settings"
          description="How the AI handles uncertainty and triggers human review"
        />
        <NumberInputRow
          label="Confidence Threshold"
          description="Evaluations below this confidence % will be flagged for review"
          value={conf.threshold}
          onChange={v => onChange({ confidenceSettings: { ...conf, threshold: v } })}
          min={0} max={100} unit="%"
        />
        <NumberInputRow
          label="Confidence Decay Rate"
          description="Rate at which confidence reduces for ambiguous/unclear answers"
          value={conf.confidenceDecayRate}
          onChange={v => onChange({ confidenceSettings: { ...conf, confidenceDecayRate: v } })}
          min={0} max={100} unit="%"
        />
        <ToggleRow
          label="Handwriting Clarity Impact"
          description="Lower confidence when handwriting is difficult to read"
          checked={conf.handwritingClarityImpact}
          onChange={v => onChange({ confidenceSettings: { ...conf, handwritingClarityImpact: v } })}
        />
        <ToggleRow
          label="Concept Ambiguity Impact"
          description="Lower confidence for conceptually ambiguous answers"
          checked={conf.conceptAmbiguityImpact}
          onChange={v => onChange({ confidenceSettings: { ...conf, conceptAmbiguityImpact: v } })}
        />
        <ToggleRow
          label="Auto Human Review"
          description="Automatically route low-confidence answers for teacher review"
          checked={conf.autoHumanReview}
          onChange={v => onChange({ confidenceSettings: { ...conf, autoHumanReview: v } })}
        />
        <ToggleRow
          label="Adjust Marks Based on Confidence"
          description="Scale marks slightly downward for uncertain evaluations"
          checked={conf.adjustMarksBasedOnConfidence}
          onChange={v => onChange({ confidenceSettings: { ...conf, adjustMarksBasedOnConfidence: v } })}
        />
      </SettingsCard>

    </div>
  )
}

// ─── Subject Tab ──────────────────────────────────────────────────────────────

const SUBJECT_META: Record<string, { label: string; emoji: string; description: string }> = {
  mathematics: { label: 'Mathematics',    emoji: '∑', description: 'Numerical, algebraic, and geometric problems' },
  theory:      { label: 'Theory',         emoji: '📖', description: 'Concept-based written answers' },
  coding:      { label: 'Coding',         emoji: '{}', description: 'Programming and algorithmic problems' },
  science:     { label: 'Science',        emoji: '🔬', description: 'Physics, chemistry, biology questions' },
  diagrams:    { label: 'Diagrams',       emoji: '🗂', description: 'Labelled diagrams and visual answers' },
  language:    { label: 'Language',       emoji: 'Aa', description: 'Grammar, essays, and comprehension' },
  history:     { label: 'History',        emoji: '📚', description: 'Historical events and chronological analysis' },
  geography:   { label: 'Geography',      emoji: '🌍', description: 'Spatial reasoning and geographical concepts' },
  economics:   { label: 'Economics',      emoji: '📊', description: 'Economic principles and data analysis' },
  arts:        { label: 'Arts',           emoji: '🎨', description: 'Creative expression and critical appreciation' },
}

const SUBJECT_FIELD_META: Record<string, Record<string, { label: string; description: string; tag?: string; advanced?: boolean }>> = {
  mathematics: {
    conceptAndSteps:             { label: 'Require Concept + Steps',        description: 'Award marks for method, not just the final answer' },
    notJustFinalAnswer:          { label: 'Not Just Final Answer',           description: 'Penalise if only the answer is given without working' },
    unitOfMeasurementRequired:   { label: 'Unit of Measurement Required',    description: 'Deduct for missing or incorrect units', tag: 'new' },
    formulaRecognition:          { label: 'Formula Recognition',             description: 'Identify and reward correct formula usage', tag: 'new' },
    stepByStepBreakdown:         { label: 'Step-by-Step Breakdown',         description: 'Require detailed explanation of each solving step', advanced: true },
    alternativeMethodAcceptance: { label: 'Alternative Method Acceptance',  description: 'Accept valid non-standard solution methods', advanced: true },
    partialCreditLogic:          { label: 'Partial Credit Logic',           description: 'Award proportional marks for partially correct solutions', advanced: true },
    mathematicalNotationCheck:   { label: 'Mathematical Notation Check',    description: 'Validate proper mathematical symbols and notation', advanced: true },
  },
  theory: {
    depthOfExplanation:          { label: 'Require Depth of Explanation',    description: 'Reward detailed over surface-level answers' },
    citationsEncouraged:         { label: 'Encourage Citations',             description: 'Award bonus for citing relevant sources or examples', tag: 'new' },
    criticalThinkingAssessment: { label: 'Critical Thinking Assessment',    description: 'Evaluate analytical and reasoning capabilities', advanced: true },
    conceptualConnections:       { label: 'Conceptual Connections',          description: 'Check for links between related concepts', advanced: true },
    argumentStructureAnalysis:   { label: 'Argument Structure Analysis',      description: 'Assess logical flow and coherence of arguments', advanced: true },
    evidenceBasedReasoning:      { label: 'Evidence-Based Reasoning',        description: 'Require supporting evidence for claims', advanced: true },
  },
  coding: {
    logicCorrectness:            { label: 'Logic Correctness',               description: 'Evaluate the soundness of the algorithm' },
    notSyntaxOnly:               { label: 'Logic Over Syntax',               description: 'Do not penalise minor syntax errors if logic is correct' },
    edgeCaseHandling:            { label: 'Edge Case Handling',              description: 'Reward code that handles edge cases correctly', tag: 'new' },
    timeComplexityAwareness:     { label: 'Time Complexity Awareness',       description: 'Consider Big-O efficiency in the evaluation', tag: 'new' },
    codeReadabilityEvaluation:    { label: 'Code Readability Evaluation',    description: 'Assess code clarity and maintainability', advanced: true },
    algorithmEfficiencyCheck:     { label: 'Algorithm Efficiency Check',      description: 'Evaluate optimization and performance considerations', advanced: true },
    designPatternRecognition:     { label: 'Design Pattern Recognition',      description: 'Identify and reward appropriate design patterns', advanced: true },
    errorHandlingAssessment:     { label: 'Error Handling Assessment',       description: 'Check for proper exception and error handling', advanced: true },
  },
  science: {
    conceptAndReasoning:         { label: 'Concept + Reasoning',             description: 'Both the concept and its explanation must be present' },
    examples:                    { label: 'Require Examples',                description: 'Reward answers that include real-world examples' },
    experimentalMethodology:     { label: 'Experimental Methodology',        description: 'Check for proper experimental design in lab answers', tag: 'new' },
    hypothesisTesting:            { label: 'Hypothesis Testing',              description: 'Evaluate scientific method application', advanced: true },
    dataInterpretationSkills:     { label: 'Data Interpretation Skills',      description: 'Assess ability to analyze experimental data', advanced: true },
    scientificAccuracyCheck:      { label: 'Scientific Accuracy Check',       description: 'Verify factual correctness of scientific claims', advanced: true },
    laboratorySafetyAwareness:   { label: 'Laboratory Safety Awareness',     description: 'Check for safety protocol knowledge', advanced: true },
  },
  diagrams: {
    interpretationAndExplanation:{ label: 'Interpretation + Explanation',    description: 'Reward students who explain what the diagram shows' },
    labelAccuracy:               { label: 'Label Accuracy',                  description: 'Check for correct and complete labelling', tag: 'new' },
    scaleAndProportionCheck:     { label: 'Scale & Proportion Check',         description: 'Verify accurate scaling and proportions', advanced: true },
    diagrammaticFlowAnalysis:    { label: 'Diagrammatic Flow Analysis',     description: 'Evaluate logical flow in process diagrams', advanced: true },
    visualCommunicationQuality:  { label: 'Visual Communication Quality',    description: 'Assess clarity and effectiveness of visual representation', advanced: true },
    technicalDrawingStandards:   { label: 'Technical Drawing Standards',      description: 'Check adherence to standard drawing conventions', advanced: true },
  },
  language: {
    grammarRequired:             { label: 'Grammar Required',                description: 'Deduct for grammatical errors', tag: 'new' },
    vocabularyRichness:          { label: 'Vocabulary Richness',             description: 'Reward varied and appropriate vocabulary use', tag: 'new' },
    coherenceAndCohesion:        { label: 'Coherence & Cohesion',            description: 'Evaluate logical flow and sentence-to-sentence linking', tag: 'new' },
    rhetoricalDevicesAssessment:  { label: 'Rhetorical Devices Assessment',   description: 'Identify and evaluate literary techniques', advanced: true },
    argumentativeStructureCheck: { label: 'Argumentative Structure Check',    description: 'Assess thesis development and support', advanced: true },
    contextualAppropriateness:   { label: 'Contextual Appropriateness',       description: 'Evaluate language suitability for context', advanced: true },
    stylisticAnalysis:           { label: 'Stylistic Analysis',               description: 'Assess writing style and tone effectiveness', advanced: true },
  },
  history: {
    chronologicalUnderstanding:  { label: 'Chronological Understanding',      description: 'Assess understanding of time sequences and events' },
    causeEffectAnalysis:         { label: 'Cause & Effect Analysis',          description: 'Evaluate understanding of historical causality' },
    sourceEvaluation:            { label: 'Source Evaluation',               description: 'Assess ability to evaluate historical sources' },
    contextualAnalysis:          { label: 'Contextual Analysis',             description: 'Evaluate understanding of historical context' },
    historiographyAwareness:     { label: 'Historiography Awareness',        description: 'Assess understanding of historical interpretation', advanced: true },
    primarySourceAnalysis:       { label: 'Primary Source Analysis',         description: 'Evaluate ability to analyze primary sources', advanced: true },
    comparativeHistoricalAnalysis: { label: 'Comparative Historical Analysis', description: 'Assess comparative historical thinking', advanced: true },
    historicalInterpretationSkills: { label: 'Historical Interpretation Skills', description: 'Evaluate interpretive and analytical skills', advanced: true },
  },
  geography: {
    spatialReasoning:             { label: 'Spatial Reasoning',                description: 'Assess understanding of spatial relationships' },
    mapInterpretation:            { label: 'Map Interpretation',               description: 'Evaluate ability to read and interpret maps' },
    geographicalConcepts:         { label: 'Geographical Concepts',            description: 'Assess understanding of key geographical concepts' },
    caseStudyAnalysis:            { label: 'Case Study Analysis',              description: 'Evaluate ability to analyze geographical case studies' },
    fieldworkApplication:         { label: 'Fieldwork Application',           description: 'Assess practical fieldwork skills', advanced: true },
    gisAnalysisSkills:            { label: 'GIS Analysis Skills',              description: 'Evaluate geographic information system skills', advanced: true },
    environmentalImpactAssessment: { label: 'Environmental Impact Assessment',  description: 'Assess environmental analysis capabilities', advanced: true },
    regionalPlanningAnalysis:     { label: 'Regional Planning Analysis',       description: 'Evaluate planning and development understanding', advanced: true },
  },
  economics: {
    economicPrinciples:           { label: 'Economic Principles',              description: 'Assess understanding of fundamental economic concepts' },
    dataAnalysis:                 { label: 'Data Analysis',                    description: 'Evaluate ability to analyze economic data' },
    modelApplication:             { label: 'Model Application',               description: 'Assess ability to apply economic models' },
    policyEvaluation:             { label: 'Policy Evaluation',               description: 'Evaluate ability to assess economic policies' },
    marketAnalysisSkills:          { label: 'Market Analysis Skills',          description: 'Assess market analysis capabilities', advanced: true },
    econometricInterpretation:     { label: 'Econometric Interpretation',       description: 'Evaluate statistical economic analysis', advanced: true },
    behavioralEconomicsUnderstanding: { label: 'Behavioral Economics Understanding', description: 'Assess behavioral economics concepts', advanced: true },
    riskAssessmentCapability:     { label: 'Risk Assessment Capability',       description: 'Evaluate risk analysis skills', advanced: true },
  },
  arts: {
    creativityExpression:         { label: 'Creativity & Expression',         description: 'Assess creative expression and originality' },
    techniqueMastery:             { label: 'Technique Mastery',               description: 'Evaluate technical skill and execution' },
    compositionBalance:           { label: 'Composition & Balance',           description: 'Assess compositional understanding' },
    criticalAppreciation:         { label: 'Critical Appreciation',           description: 'Evaluate ability to critically analyze art' },
    historicalContextUnderstanding: { label: 'Historical Context Understanding', description: 'Assess understanding of art history context', advanced: true },
    mediumSpecificSkills:         { label: 'Medium-Specific Skills',          description: 'Evaluate skills specific to the art medium', advanced: true },
    conceptualDepthEvaluation:     { label: 'Conceptual Depth Evaluation',     description: 'Assess conceptual depth and meaning', advanced: true },
    portfolioCoherence:           { label: 'Portfolio Coherence',             description: 'Evaluate coherence and consistency of work', advanced: true },
  },
};

interface SubjectTabProps {
  settings: AIEvaluationSettings
  onChange: (updates: Partial<AIEvaluationSettings>) => void
}

export function SubjectTab({ settings, onChange }: SubjectTabProps) {
  const ss = settings.subjectSpecific
  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({})

  const toggleAdvanced = (subject: string) => {
    setShowAdvanced(prev => ({ ...prev, [subject]: !prev[subject] }))
  }

  return (
    <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-2">
      {(Object.keys(SUBJECT_META) as Array<keyof typeof ss>).map(subject => {
        const meta = SUBJECT_META[subject as string]
        const fieldMeta = SUBJECT_FIELD_META[subject as string] ?? {}
        const subjectConfig = ss[subject] as Record<string, boolean>
        const isAdvancedVisible = showAdvanced[subject as string] || false
        
        // Separate basic and advanced fields
        const basicFields = Object.entries(fieldMeta).filter(([_, meta]) => !meta?.advanced)
        const advancedFields = Object.entries(fieldMeta).filter(([_, meta]) => meta?.advanced)

        return (
          <SettingsCard key={subject as string}>
            <SectionHeader
              title={`${meta.emoji}  ${meta.label}`}
              description={meta.description}
            />
            
            {/* Basic Settings */}
            <div className="space-y-3">
              {basicFields.map(([key, fieldMeta]) => {
                const val = subjectConfig[key]
                const fm = fieldMeta
                return (
                  <ToggleRow
                    key={key}
                    label={fm?.label ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                    description={fm?.description}
                    tag={fm?.tag}
                    checked={val}
                    onChange={checked =>
                      onChange({
                        subjectSpecific: {
                          ...ss,
                          [subject]: { ...subjectConfig, [key]: checked },
                        },
                      })
                    }
                  />
                )
              })}
            </div>

            {/* Advanced Settings Toggle */}
            {advancedFields.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => toggleAdvanced(subject as string)}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <span className="transform transition-transform duration-200">
                    {isAdvancedVisible ? '▼' : '▶'}
                  </span>
                  {isAdvancedVisible ? 'Hide' : 'Show'} Advanced Settings ({advancedFields.length})
                </button>
                
                {/* Advanced Settings */}
                {isAdvancedVisible && (
                  <div className="mt-4 space-y-3 pl-4 border-l-2 border-blue-200">
                    {advancedFields.map(([key, fieldMeta]) => {
                      const val = subjectConfig[key]
                      const fm = fieldMeta
                      return (
                        <ToggleRow
                          key={key}
                          label={fm?.label ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                          description={fm?.description}
                          tag={fm?.tag}
                          checked={val}
                          onChange={checked =>
                            onChange({
                              subjectSpecific: {
                                ...ss,
                                [subject]: { ...subjectConfig, [key]: checked },
                              },
                            })
                          }
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </SettingsCard>
        )
      })}
    </div>
  )
}