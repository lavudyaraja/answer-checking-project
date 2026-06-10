/**
 * AI Evaluation Configuration Types — v2
 * Semantic-based with advanced features
 */

export interface EvaluationBehaviorSettings {
  allowPartialMarking: boolean
  penalizeConceptualMisunderstanding: boolean
  acceptAlternativeAnswers: boolean
  ignoreGrammarMistakes: boolean
  rewardLogicalReasoning: boolean
  allowHandwritingInterpretation: boolean
  focusOnUnderstandingOverMemorization: boolean
  requireExampleInLongAnswers: boolean
  detectOffTopicResponses: boolean
  penalizeCircularReasoning: boolean
}

export interface SemanticWeightDistribution {
  conceptualUnderstanding: number
  logicalReasoning: number
  completeness: number
  accuracy: number
  clarity: number
}

export type StrictnessLevel = 'strict' | 'moderate' | 'lenient'
export type DifficultyAwareStrictness = boolean

export interface StrictnessControl {
  level: StrictnessLevel
  difficultyAware: DifficultyAwareStrictness
  adaptiveStrictness: boolean         // NEW: auto-adjust based on class performance
  minimumPassThreshold: number        // NEW: minimum score to pass (0–100)
}

export interface SemanticPenaltyRules {
  wrongConceptPenalty: number
  partiallyCorrectPenalty: number
  missingImportantIdeaPenalty: number
  extraIrrelevantContentPenalty: number
  logicalInconsistencyPenalty: number
  contradictionPenalty: number
  offTopicPenalty: number             // NEW
  plagiarismPenalty: number           // NEW
}

export interface AIBehaviorConstraints {
  evaluateMeaningNotWording: boolean
  avoidKeywordMatching: boolean
  dontAssumeMissingConcepts: boolean
  reduceConfidenceIfUnclear: boolean
  neverFullMarksIfCoreMissing: boolean
  acceptValidAlternatives: boolean
  focusOnUnderstandingOverMemorization: boolean
  crossReferenceWithModelAnswer: boolean   // NEW
  detectCopyPaste: boolean                 // NEW
  enforceAnswerLengthBounds: boolean       // NEW
}

export interface SemanticMatchingStrategy {
  conceptLevelMatching: boolean
  sentenceLevelMeaning: boolean
  contextUnderstanding: boolean
  synonymParaphraseRecognition: boolean
  multiConceptDetection: boolean
  relationshipUnderstanding: boolean
  crossLanguageSupport: boolean            // NEW
  technicalTermTolerance: boolean          // NEW
  hierarchicalConceptMatching: boolean     // NEW
}

export interface ConfidenceSettings {
  threshold: number
  handwritingClarityImpact: boolean
  conceptAmbiguityImpact: boolean
  autoHumanReview: boolean
  adjustMarksBasedOnConfidence: boolean
  lowConfidenceLabel: string               // NEW: label for flagged answers
  confidenceDecayRate: number              // NEW: 0–100, how fast conf drops
}

export interface SubjectSpecificSettings {
  mathematics: {
    conceptAndSteps: boolean
    notJustFinalAnswer: boolean
    unitOfMeasurementRequired: boolean     // NEW
    formulaRecognition: boolean            // NEW
    stepByStepBreakdown: boolean           // ADVANCED
    alternativeMethodAcceptance: boolean   // ADVANCED
    partialCreditLogic: boolean            // ADVANCED
    mathematicalNotationCheck: boolean     // ADVANCED
  }
  theory: {
    depthOfExplanation: boolean
    citationsEncouraged: boolean           // NEW
    criticalThinkingAssessment: boolean    // ADVANCED
    conceptualConnections: boolean          // ADVANCED
    argumentStructureAnalysis: boolean      // ADVANCED
    evidenceBasedReasoning: boolean        // ADVANCED
  }
  coding: {
    logicCorrectness: boolean
    notSyntaxOnly: boolean
    edgeCaseHandling: boolean              // NEW
    timeComplexityAwareness: boolean       // NEW
    codeReadabilityEvaluation: boolean     // ADVANCED
    algorithmEfficiencyCheck: boolean      // ADVANCED
    designPatternRecognition: boolean      // ADVANCED
    errorHandlingAssessment: boolean       // ADVANCED
  }
  science: {
    conceptAndReasoning: boolean
    examples: boolean
    experimentalMethodology: boolean       // NEW
    hypothesisTesting: boolean             // ADVANCED
    dataInterpretationSkills: boolean      // ADVANCED
    scientificAccuracyCheck: boolean       // ADVANCED
    laboratorySafetyAwareness: boolean     // ADVANCED
  }
  diagrams: {
    interpretationAndExplanation: boolean
    labelAccuracy: boolean                 // NEW
    scaleAndProportionCheck: boolean       // ADVANCED
    diagrammaticFlowAnalysis: boolean      // ADVANCED
    visualCommunicationQuality: boolean    // ADVANCED
    technicalDrawingStandards: boolean     // ADVANCED
  }
  language: {                              // NEW subject
    grammarRequired: boolean
    vocabularyRichness: boolean
    coherenceAndCohesion: boolean
    rhetoricalDevicesAssessment: boolean    // ADVANCED
    argumentativeStructureCheck: boolean   // ADVANCED
    contextualAppropriateness: boolean     // ADVANCED
    stylisticAnalysis: boolean             // ADVANCED
  }
  history: {                              // NEW subject
    chronologicalUnderstanding: boolean
    causeEffectAnalysis: boolean
    sourceEvaluation: boolean
    contextualAnalysis: boolean
    historiographyAwareness: boolean      // ADVANCED
    primarySourceAnalysis: boolean        // ADVANCED
    comparativeHistoricalAnalysis: boolean // ADVANCED
    historicalInterpretationSkills: boolean // ADVANCED
  }
  geography: {                            // NEW subject
    spatialReasoning: boolean
    mapInterpretation: boolean
    geographicalConcepts: boolean
    caseStudyAnalysis: boolean
    fieldworkApplication: boolean          // ADVANCED
    gisAnalysisSkills: boolean             // ADVANCED
    environmentalImpactAssessment: boolean // ADVANCED
    regionalPlanningAnalysis: boolean     // ADVANCED
  }
  economics: {                            // NEW subject
    economicPrinciples: boolean
    dataAnalysis: boolean
    modelApplication: boolean
    policyEvaluation: boolean
    marketAnalysisSkills: boolean          // ADVANCED
    econometricInterpretation: boolean     // ADVANCED
    behavioralEconomicsUnderstanding: boolean // ADVANCED
    riskAssessmentCapability: boolean      // ADVANCED
  }
  arts: {                                 // NEW subject
    creativityExpression: boolean
    techniqueMastery: boolean
    compositionBalance: boolean
    criticalAppreciation: boolean
    historicalContextUnderstanding: boolean // ADVANCED
    mediumSpecificSkills: boolean          // ADVANCED
    conceptualDepthEvaluation: boolean     // ADVANCED
    portfolioCoherence: boolean            // ADVANCED
  }
}

export interface EvaluationMode {
  multiPassSemantic: boolean
  multiModelAgreement: boolean
  reevaluationAmbiguous: boolean
  deepAnalysisMode: boolean
  streamingFeedback: boolean               // NEW
  batchEvaluationMode: boolean             // NEW
  comparativeEvaluation: boolean           // NEW: compare against class avg
}

export interface FeedbackConfiguration {
  showConceptUnderstanding: boolean
  showMissingConcepts: boolean
  showIncorrectReasoning: boolean
  showSuggestions: boolean
  showPersonalizedGuidance: boolean
  showScoreBreakdown: boolean              // NEW
  showStrengthsFirst: boolean              // NEW
  feedbackLanguage: string                 // NEW: 'en' | 'hi' | 'auto'
  feedbackTone: 'encouraging' | 'neutral' | 'critical'  // NEW
  maxFeedbackLength: number                // NEW: in words
}

export interface HumanControlSettings {
  manualOverrideEnabled: boolean
  teacherReviewLowConfidence: boolean
  reevaluationRequestSystem: boolean
  transparentReasoning: boolean
  auditTrailEnabled: boolean               // NEW
  teacherAnnotations: boolean              // NEW
  gradeAppealWorkflow: boolean             // NEW
}

export interface FairnessReliabilitySettings {
  avoidHandwritingBias: boolean
  evaluateSimpleLanguage: boolean
  consistentMarking: boolean
  antiCopyDetection: boolean
  languageBiasReduction: boolean          // NEW
  genderNeutralEvaluation: boolean        // NEW
  socioeconomicFairness: boolean          // NEW
}

export interface SystemLevelControls {
  aiProvider: 'claude' | 'groq' | 'both'
  costVsAccuracy: 'cost' | 'balanced' | 'accuracy'
  retryOnFailure: boolean
  loggingEnabled: boolean
  debugMode: boolean
  rateLimitPerMinute: number              // NEW
  timeoutSeconds: number                  // NEW
  cachingEnabled: boolean                 // NEW
  webhookOnComplete: boolean              // NEW
}

// ─── NEW: Settings Profile / Versioning ─────────────────────────────────────

export interface SettingsVersion {
  version: number
  timestamp: Date
  changedBy: string
  changeSummary: string
  snapshot: Partial<AIEvaluationSettings>
}

export interface SettingsProfile {
  id: string
  name: string
  description: string
  color: string
  isDefault: boolean
  settings: AIEvaluationSettings
  createdAt: Date
  usageCount: number
}

// ─── NEW: A/B Test Config ────────────────────────────────────────────────────

export interface ABTestConfig {
  enabled: boolean
  profileA: string   // profile ID
  profileB: string   // profile ID
  splitPercent: number  // 0–100 for profile A
  startDate: Date
  endDate?: Date
  metric: 'accuracy' | 'cost' | 'speed' | 'human_review_rate'
}

// ─── NEW: Analytics ─────────────────────────────────────────────────────────

export interface SettingsAnalytics {
  totalEvaluations: number
  avgConfidence: number
  humanReviewRate: number
  avgCostPerEval: number
  topPenaltyTriggered: string
  lastEvalAt: Date
}

// ─── Main Settings Type ──────────────────────────────────────────────────────

export interface AIEvaluationSettings {
  id: string
  name: string
  description?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  tags?: string[]                          // NEW
  versionHistory?: SettingsVersion[]       // NEW

  // Core Settings Groups
  evaluationBehavior: EvaluationBehaviorSettings
  semanticWeights: SemanticWeightDistribution
  strictnessControl: StrictnessControl
  penaltyRules: SemanticPenaltyRules
  aiBehaviorConstraints: AIBehaviorConstraints
  semanticMatching: SemanticMatchingStrategy
  confidenceSettings: ConfidenceSettings
  subjectSpecific: SubjectSpecificSettings
  evaluationMode: EvaluationMode
  feedbackConfiguration: FeedbackConfiguration
  humanControl: HumanControlSettings
  fairnessReliability: FairnessReliabilitySettings
  systemControls: SystemLevelControls
}

// ─── Utility Types ───────────────────────────────────────────────────────────

export interface SettingsValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  score: number  // 0–100 health score
}

export interface SettingsExport {
  version: string
  format: 'json' | 'yaml'
  settings: AIEvaluationSettings
  exportedAt: Date
  exportedBy: string
  checksum: string
}

export interface SettingsDiff {
  key: string
  path: string
  oldValue: unknown
  newValue: unknown
  type: 'added' | 'removed' | 'changed'
}