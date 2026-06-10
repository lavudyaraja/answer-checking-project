import type { AIEvaluationSettings } from '@/types/ai-settings'

/**
 * Default AI Evaluation Settings — v2
 */
export const DEFAULT_AI_SETTINGS: AIEvaluationSettings = {
  id: 'default',
  name: 'Default Semantic Evaluation',
  description: 'Balanced semantic evaluation focused on understanding over keywords',
  isActive: true,
  tags: ['semantic', 'balanced', 'default'],
  createdAt: new Date(),
  updatedAt: new Date(),

  evaluationBehavior: {
    allowPartialMarking: true,
    penalizeConceptualMisunderstanding: true,
    acceptAlternativeAnswers: true,
    ignoreGrammarMistakes: true,
    rewardLogicalReasoning: true,
    allowHandwritingInterpretation: true,
    focusOnUnderstandingOverMemorization: true,
    requireExampleInLongAnswers: false,
    detectOffTopicResponses: true,
    penalizeCircularReasoning: false,
  },

  semanticWeights: {
    conceptualUnderstanding: 35,
    logicalReasoning: 25,
    completeness: 20,
    accuracy: 15,
    clarity: 5,
  },

  strictnessControl: {
    level: 'moderate',
    difficultyAware: true,
    adaptiveStrictness: false,
    minimumPassThreshold: 40,
  },

  penaltyRules: {
    wrongConceptPenalty: 80,
    partiallyCorrectPenalty: 40,
    missingImportantIdeaPenalty: 30,
    extraIrrelevantContentPenalty: 10,
    logicalInconsistencyPenalty: 25,
    contradictionPenalty: 50,
    offTopicPenalty: 60,
    plagiarismPenalty: 100,
  },

  aiBehaviorConstraints: {
    evaluateMeaningNotWording: true,
    avoidKeywordMatching: true,
    dontAssumeMissingConcepts: true,
    reduceConfidenceIfUnclear: true,
    neverFullMarksIfCoreMissing: true,
    acceptValidAlternatives: true,
    focusOnUnderstandingOverMemorization: true,
    crossReferenceWithModelAnswer: true,
    detectCopyPaste: true,
    enforceAnswerLengthBounds: false,
  },

  semanticMatching: {
    conceptLevelMatching: true,
    sentenceLevelMeaning: true,
    contextUnderstanding: true,
    synonymParaphraseRecognition: true,
    multiConceptDetection: true,
    relationshipUnderstanding: true,
    crossLanguageSupport: false,
    technicalTermTolerance: true,
    hierarchicalConceptMatching: false,
  },

  confidenceSettings: {
    threshold: 60,
    handwritingClarityImpact: true,
    conceptAmbiguityImpact: true,
    autoHumanReview: true,
    adjustMarksBasedOnConfidence: true,
    lowConfidenceLabel: 'Needs Review',
    confidenceDecayRate: 20,
  },

  subjectSpecific: {
    mathematics: {
      conceptAndSteps: true,
      notJustFinalAnswer: true,
      unitOfMeasurementRequired: false,
      formulaRecognition: true,
      stepByStepBreakdown: false,
      alternativeMethodAcceptance: false,
      partialCreditLogic: false,
      mathematicalNotationCheck: false,
    },
    theory: {
      depthOfExplanation: true,
      citationsEncouraged: false,
      criticalThinkingAssessment: false,
      conceptualConnections: false,
      argumentStructureAnalysis: false,
      evidenceBasedReasoning: false,
    },
    coding: {
      logicCorrectness: true,
      notSyntaxOnly: true,
      edgeCaseHandling: false,
      timeComplexityAwareness: false,
      codeReadabilityEvaluation: false,
      algorithmEfficiencyCheck: false,
      designPatternRecognition: false,
      errorHandlingAssessment: false,
    },
    science: {
      conceptAndReasoning: true,
      examples: true,
      experimentalMethodology: false,
      hypothesisTesting: false,
      dataInterpretationSkills: false,
      scientificAccuracyCheck: false,
      laboratorySafetyAwareness: false,
    },
    diagrams: {
      interpretationAndExplanation: true,
      labelAccuracy: true,
      scaleAndProportionCheck: false,
      diagrammaticFlowAnalysis: false,
      visualCommunicationQuality: false,
      technicalDrawingStandards: false,
    },
    language: {
      grammarRequired: false,
      vocabularyRichness: false,
      coherenceAndCohesion: true,
      rhetoricalDevicesAssessment: false,
      argumentativeStructureCheck: false,
      contextualAppropriateness: false,
      stylisticAnalysis: false,
    },
    history: {
      chronologicalUnderstanding: true,
      causeEffectAnalysis: true,
      sourceEvaluation: false,
      contextualAnalysis: true,
      historiographyAwareness: false,
      primarySourceAnalysis: false,
      comparativeHistoricalAnalysis: false,
      historicalInterpretationSkills: false,
    },
    geography: {
      spatialReasoning: true,
      mapInterpretation: true,
      geographicalConcepts: true,
      caseStudyAnalysis: false,
      fieldworkApplication: false,
      gisAnalysisSkills: false,
      environmentalImpactAssessment: false,
      regionalPlanningAnalysis: false,
    },
    economics: {
      economicPrinciples: true,
      dataAnalysis: true,
      modelApplication: false,
      policyEvaluation: false,
      marketAnalysisSkills: false,
      econometricInterpretation: false,
      behavioralEconomicsUnderstanding: false,
      riskAssessmentCapability: false,
    },
    arts: {
      creativityExpression: true,
      techniqueMastery: true,
      compositionBalance: false,
      criticalAppreciation: true,
      historicalContextUnderstanding: false,
      mediumSpecificSkills: false,
      conceptualDepthEvaluation: false,
      portfolioCoherence: false,
    },
  },

  evaluationMode: {
    multiPassSemantic: true,
    multiModelAgreement: false,
    reevaluationAmbiguous: true,
    deepAnalysisMode: false,
    streamingFeedback: false,
    batchEvaluationMode: false,
    comparativeEvaluation: false,
  },

  feedbackConfiguration: {
    showConceptUnderstanding: true,
    showMissingConcepts: true,
    showIncorrectReasoning: true,
    showSuggestions: true,
    showPersonalizedGuidance: true,
    showScoreBreakdown: true,
    showStrengthsFirst: true,
    feedbackLanguage: 'en',
    feedbackTone: 'encouraging',
    maxFeedbackLength: 200,
  },

  humanControl: {
    manualOverrideEnabled: true,
    teacherReviewLowConfidence: true,
    reevaluationRequestSystem: true,
    transparentReasoning: true,
    auditTrailEnabled: true,
    teacherAnnotations: false,
    gradeAppealWorkflow: false,
  },

  fairnessReliability: {
    avoidHandwritingBias: true,
    evaluateSimpleLanguage: true,
    consistentMarking: true,
    antiCopyDetection: true,
    languageBiasReduction: false,
    genderNeutralEvaluation: false,
    socioeconomicFairness: false,
  },

  systemControls: {
    aiProvider: 'both',
    costVsAccuracy: 'balanced',
    retryOnFailure: true,
    loggingEnabled: true,
    debugMode: false,
    rateLimitPerMinute: 60,
    timeoutSeconds: 30,
    cachingEnabled: true,
    webhookOnComplete: false,
  },
}

// ─── Presets ─────────────────────────────────────────────────────────────────

export const STRICT_PRESET: Partial<AIEvaluationSettings> = {
  name: 'Strict Evaluation',
  description: 'High standards for professional or board examinations',
  tags: ['strict', 'exam', 'professional'],
  strictnessControl: { level: 'strict', difficultyAware: true, adaptiveStrictness: false, minimumPassThreshold: 50 },
  semanticWeights: { conceptualUnderstanding: 40, logicalReasoning: 30, completeness: 20, accuracy: 10, clarity: 0 },
  penaltyRules: {
    wrongConceptPenalty: 100, partiallyCorrectPenalty: 60, missingImportantIdeaPenalty: 50,
    extraIrrelevantContentPenalty: 15, logicalInconsistencyPenalty: 40, contradictionPenalty: 70,
    offTopicPenalty: 80, plagiarismPenalty: 100,
  },
  confidenceSettings: {
    threshold: 80, handwritingClarityImpact: true, conceptAmbiguityImpact: true,
    autoHumanReview: true, adjustMarksBasedOnConfidence: true,
    lowConfidenceLabel: 'Manual Review Required', confidenceDecayRate: 30,
  },
}

export const LENIENT_PRESET: Partial<AIEvaluationSettings> = {
  name: 'Lenient Evaluation',
  description: 'Encouraging evaluation designed for early learners',
  tags: ['lenient', 'learning', 'encouraging'],
  strictnessControl: { level: 'lenient', difficultyAware: false, adaptiveStrictness: true, minimumPassThreshold: 30 },
  semanticWeights: { conceptualUnderstanding: 30, logicalReasoning: 20, completeness: 25, accuracy: 15, clarity: 10 },
  penaltyRules: {
    wrongConceptPenalty: 60, partiallyCorrectPenalty: 20, missingImportantIdeaPenalty: 20,
    extraIrrelevantContentPenalty: 5, logicalInconsistencyPenalty: 15, contradictionPenalty: 30,
    offTopicPenalty: 30, plagiarismPenalty: 80,
  },
  confidenceSettings: {
    threshold: 40, handwritingClarityImpact: false, conceptAmbiguityImpact: false,
    autoHumanReview: false, adjustMarksBasedOnConfidence: false,
    lowConfidenceLabel: 'Check When Possible', confidenceDecayRate: 10,
  },
}

export const COST_OPTIMIZED_PRESET: Partial<AIEvaluationSettings> = {
  name: 'Cost Optimized',
  description: 'Efficient evaluation minimizing API spend',
  tags: ['cost', 'fast', 'optimized'],
  systemControls: {
    aiProvider: 'groq', costVsAccuracy: 'cost', retryOnFailure: true,
    loggingEnabled: false, debugMode: false, rateLimitPerMinute: 120,
    timeoutSeconds: 15, cachingEnabled: true, webhookOnComplete: false,
  },
  evaluationMode: {
    multiPassSemantic: false, multiModelAgreement: false, reevaluationAmbiguous: false,
    deepAnalysisMode: false, streamingFeedback: false, batchEvaluationMode: true, comparativeEvaluation: false,
  },
}

export const HIGH_ACCURACY_PRESET: Partial<AIEvaluationSettings> = {
  name: 'High Accuracy',
  description: 'Maximum accuracy for critical evaluations',
  tags: ['accuracy', 'critical', 'deep'],
  systemControls: {
    aiProvider: 'claude', costVsAccuracy: 'accuracy', retryOnFailure: true,
    loggingEnabled: true, debugMode: true, rateLimitPerMinute: 20,
    timeoutSeconds: 60, cachingEnabled: false, webhookOnComplete: false,
  },
  evaluationMode: {
    multiPassSemantic: true, multiModelAgreement: true, reevaluationAmbiguous: true,
    deepAnalysisMode: true, streamingFeedback: true, batchEvaluationMode: false, comparativeEvaluation: true,
  },
}

export const SETTINGS_PRESETS = [
  { id: 'default',  name: 'Default Semantic',  color: '#6366F1', settings: DEFAULT_AI_SETTINGS },
  { id: 'strict',   name: 'Strict Evaluation', color: '#EF4444', settings: { ...DEFAULT_AI_SETTINGS, ...STRICT_PRESET } as AIEvaluationSettings },
  { id: 'lenient',  name: 'Lenient Evaluation',color: '#22C55E', settings: { ...DEFAULT_AI_SETTINGS, ...LENIENT_PRESET } as AIEvaluationSettings },
  { id: 'cost',     name: 'Cost Optimized',    color: '#F59E0B', settings: { ...DEFAULT_AI_SETTINGS, ...COST_OPTIMIZED_PRESET } as AIEvaluationSettings },
  { id: 'accuracy', name: 'High Accuracy',     color: '#3B82F6', settings: { ...DEFAULT_AI_SETTINGS, ...HIGH_ACCURACY_PRESET } as AIEvaluationSettings },
]