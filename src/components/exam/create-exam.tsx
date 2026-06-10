/**
 * src/components/create-exam.tsx
 *
 * Create-exam wizard with:
 *  ✦ Auto-crop feedback (token savings badge) for image uploads
 *  ✦ Image thumbnail preview before extraction
 *  ✦ Expand / Collapse all questions
 *  ✦ Total marks calculator in Questions header
 *  ✦ Per-question status chips (Answer ✓, Rubric ✓, keyword count)
 *  ✦ Inline spinner inside Extract buttons
 *  ✦ Smooth entrance animations on Agent banner
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { MathRenderer } from '@/components/ui/math-renderer'
import {
  FileText, Upload, Plus, Trash2, ChevronDown, ChevronUp, X,
  BookOpen, Clock, BrainCircuit, CheckCircle2, AlertCircle, Sparkles,
  ChevronsDownUp, ChevronsUpDown, Scissors, Award, BarChart3,
  Zap, ImageIcon,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ExamData {
  title: string
  subject: string
  duration: number | ''
  instructions: string
  questionsPaper: File | null
  answerModel: File | null
}

export interface Question {
  id: string
  questionNumber: number
  text: string
  modelAnswer: string
  rubric?: string
  marks: number | ''
  keywords: string[]
  expanded: boolean
}

interface AnswerKeyEntry {
  questionNumber?: number
  matchedText?: string
  modelAnswer?: string
  rubric?: string
  maxMarks?: number
  keywords?: string[]
}

interface ImageOptimizationMeta {
  originalKB: number
  processedKB: number
  savedPercent: number
  dimensions: string
  wasCropped: boolean
}

type Notice = {
  type: 'success' | 'error'
  message: string
  imageOpt?: ImageOptimizationMeta
}

interface DetectedSubject {
  subject: string
  subjectLabel: string
  agentName: string
  agentEmoji: string
}

interface CreateExamProps {
  examData: ExamData
  questions: Question[]
  onExamDataChange: (delta: Partial<ExamData>) => void
  onQuestionsChange: (questions: Question[]) => void
  onCreateExam: () => void
  isCreating?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'text/plain',
]

function getFileTypeLabel(file: File): { label: string; color: string } {
  if (file.type === 'application/pdf') return { label: 'PDF',   color: 'text-red-600 bg-red-50 border-red-200' }
  if (file.type.startsWith('image/'))  return { label: 'Image', color: 'text-blue-600 bg-blue-50 border-blue-200' }
  if (file.type === 'text/plain')      return { label: 'Text',  color: 'text-gray-600 bg-gray-50 border-gray-200' }
  return { label: 'File', color: 'text-gray-600 bg-gray-50 border-gray-200' }
}

/** Creates a revokable object-URL preview for an image File */
function useImagePreview(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setUrl(null); return }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return url
}

/** Sum all numeric marks across questions */
function totalMarks(questions: Question[]): number {
  return questions.reduce(
    (acc, q) => acc + (typeof q.marks === 'number' ? q.marks : 0),
    0,
  )
}

/** Answer-key matching – exact → semantic → undefined */
function findBestMatch(q: Question, incoming: AnswerKeyEntry[]): AnswerKeyEntry | undefined {
  const exact = incoming.find(a => a.questionNumber === q.questionNumber)
  if (exact) return exact

  if (q.text) {
    const qText = q.text.toLowerCase()
    const semantic = incoming.find(a => {
      const mt = (a.matchedText ?? '').trim().toLowerCase()
      if (mt.length < 10) return false
      return qText.includes(mt) || mt.includes(qText.substring(0, Math.min(60, qText.length)))
    })
    if (semantic) return semantic
  }
  return undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function CreateExam({
  examData,
  questions,
  onExamDataChange,
  onQuestionsChange,
  onCreateExam,
  isCreating = false,
}: CreateExamProps) {
  const [questionsPaperDrag,    setQuestionsPaperDrag]    = useState(false)
  const [answerModelDrag,       setAnswerModelDrag]       = useState(false)
  const [keywordInputs,         setKeywordInputs]         = useState<Record<string, string>>({})
  const [isExtracting,          setIsExtracting]          = useState(false)
  const [isExtractingAnswers,   setIsExtractingAnswers]   = useState(false)
  const [extractionNotice,      setExtractionNotice]      = useState<Notice | null>(null)
  const [answerKeyNotice,       setAnswerKeyNotice]       = useState<Notice | null>(null)
  const [detectedSubject,       setDetectedSubject]       = useState<DetectedSubject | null>(null)

  // Image thumbnails (revoked automatically on file change)
  const questionImagePreview = useImagePreview(examData.questionsPaper)
  const answerImagePreview   = useImagePreview(examData.answerModel)

  const busy = isExtracting || isExtractingAnswers || isCreating

  // ── File validation ───────────────────────────────────────────────────────
  const acceptFile = (file: File) => VALID_TYPES.includes(file.type)

  // ── AI question extraction ────────────────────────────────────────────────
  const extractQuestionsWithAI = async () => {
    if (!examData.questionsPaper) return
    setIsExtracting(true)
    setExtractionNotice(null)

    try {
      const form = new FormData()
      form.append('file', examData.questionsPaper)

      const res  = await fetch('/api/extracted/extract-questions', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.questions?.length > 0) {
        onQuestionsChange(data.questions)

        if (data.subject) {
          setDetectedSubject({
            subject:      data.subject,
            subjectLabel: data.subjectLabel ?? data.subject,
            agentName:    data.agentName    ?? 'Expert Agent',
            agentEmoji:   data.agentEmoji   ?? '📚',
          })
          if (!examData.subject) onExamDataChange({ subject: data.subjectLabel ?? data.subject })
        }

        setExtractionNotice({
          type:     'success',
          message:  `${data.questions.length} question${data.questions.length !== 1 ? 's' : ''} extracted.`,
          imageOpt: data.imageOptimization,
        })
      } else {
        setExtractionNotice({
          type:    'error',
          message: data.error ?? 'No questions found. Try a clearer document.',
        })
      }
    } catch {
      setExtractionNotice({ type: 'error', message: 'Network error. Check your connection.' })
    } finally {
      setIsExtracting(false)
    }
  }

  // ── AI answer key extraction ──────────────────────────────────────────────
  const extractAnswerKeyWithAI = async () => {
    if (!examData.answerModel) return
    setIsExtractingAnswers(true)
    setAnswerKeyNotice(null)

    try {
      const form = new FormData()
      form.append('file', examData.answerModel)

      if (questions.length > 0) {
        form.append(
          'questions',
          JSON.stringify(
            questions.map(q => ({ questionNumber: q.questionNumber, text: q.text })),
          ),
        )
      }
      if (detectedSubject) form.append('subject', detectedSubject.subject)

      const res  = await fetch('/api/extracted/extract-answer-key', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.answers?.length > 0) {
        const incoming = data.answers as AnswerKeyEntry[]

        if (questions.length > 0) {
          onQuestionsChange(
            questions.map(q => {
              const match = findBestMatch(q, incoming)
              if (!match) return q
              return {
                ...q,
                modelAnswer: match.modelAnswer || q.modelAnswer,
                rubric:      match.rubric      || q.rubric || '',
                marks:       match.maxMarks !== undefined ? match.maxMarks : q.marks,
                keywords:    match.keywords?.length
                  ? [...new Set([...q.keywords, ...match.keywords])]
                  : q.keywords,
              }
            }),
          )
        } else {
          onQuestionsChange(
            incoming.map((a, i) => ({
              id:             crypto.randomUUID(),
              questionNumber: a.questionNumber ?? i + 1,
              text:           '',
              modelAnswer:    a.modelAnswer ?? '',
              rubric:         a.rubric ?? '',
              marks:          a.maxMarks !== undefined ? a.maxMarks : 10,
              keywords:       a.keywords ?? [],
              expanded:       true,
            })),
          )
        }

        setAnswerKeyNotice({
          type:     'success',
          message:  `${detectedSubject?.agentEmoji || '✨'} ${detectedSubject?.agentName || 'Expert Agent'} matched ${incoming.length} answer${incoming.length !== 1 ? 's' : ''}.`,
          imageOpt: data.imageOptimization,
        })
      } else {
        setAnswerKeyNotice({
          type:    'error',
          message: data.error ?? 'No answers found. Try a clearer document.',
        })
      }
    } catch {
      setAnswerKeyNotice({ type: 'error', message: 'Network error. Check your connection.' })
    } finally {
      setIsExtractingAnswers(false)
    }
  }

  // ── Question CRUD ─────────────────────────────────────────────────────────
  const addQuestion = () => {
    const nextNum = questions.length + 1
    onQuestionsChange([
      ...questions,
      {
        id:             crypto.randomUUID(),
        questionNumber: nextNum,
        text:           '',
        modelAnswer:    '',
        rubric:         '',
        marks:          5,
        keywords:       [],
        expanded:       true,
      },
    ])
  }

  const removeQuestion = (id: string) =>
    onQuestionsChange(
      questions.filter(q => q.id !== id).map((q, i) => ({ ...q, questionNumber: i + 1 })),
    )

  const toggleQuestion = (id: string) =>
    onQuestionsChange(questions.map(q => q.id === id ? { ...q, expanded: !q.expanded } : q))

  const updateQuestion = (id: string, field: keyof Question, value: unknown) =>
    onQuestionsChange(questions.map(q => q.id === id ? { ...q, [field]: value } : q))

  const expandAll   = () => onQuestionsChange(questions.map(q => ({ ...q, expanded: true })))
  const collapseAll = () => onQuestionsChange(questions.map(q => ({ ...q, expanded: false })))

  // ── Keywords ──────────────────────────────────────────────────────────────
  const addKeyword = (qId: string, raw: string) => {
    const kw = raw.trim()
    if (!kw) return
    const q = questions.find(q => q.id === qId)
    if (q && !q.keywords.includes(kw)) updateQuestion(qId, 'keywords', [...q.keywords, kw])
  }

  const removeKeyword = (qId: string, kw: string) => {
    const q = questions.find(q => q.id === qId)
    if (q) updateQuestion(qId, 'keywords', q.keywords.filter(k => k !== kw))
  }

  const handleKeywordKeyDown = (qId: string, e: React.KeyboardEvent, val: string) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addKeyword(qId, val)
      setKeywordInputs(prev => ({ ...prev, [qId]: '' }))
    } else if (e.key === 'Backspace' && !val) {
      const q = questions.find(q => q.id === qId)
      if (q?.keywords.length) updateQuestion(qId, 'keywords', q.keywords.slice(0, -1))
    }
  }

  // Derived stats
  const total     = totalMarks(questions)
  const answered  = questions.filter(q => q.modelAnswer).length
  const hasRubric = questions.filter(q => q.rubric).length

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground">
        <span>Exams</span>
        <span className="mx-2">/</span>
        <span className="font-medium text-foreground">Create New Exam</span>
      </div>

      {/* Agent Banner */}
      {detectedSubject && (
        <div className="flex items-center gap-4 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 px-5 py-4 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-violet-100 text-xl flex-shrink-0">
            {detectedSubject.agentEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-violet-900">
                {detectedSubject.subjectLabel} Detected!
              </p>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-700 bg-violet-100 border border-violet-200 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 bg-violet-500 rounded-full animate-pulse" />
                {detectedSubject.agentName} is ON
              </span>
            </div>
            <p className="text-xs text-violet-600 mt-0.5">
              This exam will be graded by the {detectedSubject.agentName} — specialised in {detectedSubject.subjectLabel} evaluation.
            </p>
          </div>
          <button
            onClick={() => setDetectedSubject(null)}
            className="text-violet-400 hover:text-violet-600 flex-shrink-0 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold">Create New Exam</h1>
        <p className="text-muted-foreground mt-1">
          Set up an exam with questions, answer keys, and evaluation criteria.
        </p>
      </div>

      {/* Meta fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="examTitle">
            Exam Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="examTitle"
            placeholder="Enter exam title"
            value={examData.title}
            onChange={e => onExamDataChange({ title: e.target.value })}
            className="mt-1"
            disabled={busy}
          />
        </div>
        <div>
          <Label htmlFor="subject">
            <BookOpen className="w-3.5 h-3.5 inline mr-1" />
            Subject
          </Label>
          <Input
            id="subject"
            placeholder="e.g. Mathematics"
            value={examData.subject}
            onChange={e => onExamDataChange({ subject: e.target.value })}
            className="mt-1"
            disabled={busy}
          />
        </div>
        <div>
          <Label htmlFor="duration">
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            Duration (minutes)
          </Label>
          <Input
            id="duration"
            type="number"
            min={0}
            placeholder="e.g. 90"
            value={examData.duration === '' ? '' : examData.duration}
            onChange={e => {
              const v = e.target.value
              onExamDataChange({ duration: v === '' ? '' : (parseInt(v, 10) || 0) })
            }}
            className="mt-1"
            disabled={busy}
          />
        </div>
      </div>

      {/* Upload cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Questions Paper */}
        <Card>
          <CardHeader className="text-center pb-3">
            <CardTitle className="text-amber-700">Questions Paper</CardTitle>
            <CardDescription className="text-amber-600">
              Upload the question paper — up to 5 pages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!examData.questionsPaper ? (
              <DropZone
                color="amber"
                label="Upload Questions Paper"
                maxPages={5}
                isDragging={questionsPaperDrag}
                onDragEnter={() => setQuestionsPaperDrag(true)}
                onDragLeave={() => setQuestionsPaperDrag(false)}
                onFile={f => {
                  if (acceptFile(f)) {
                    onExamDataChange({ questionsPaper: f })
                    setExtractionNotice(null)
                  }
                }}
              />
            ) : (
              <div className="space-y-3">
                <FileRow
                  file={examData.questionsPaper}
                  imagePreview={questionImagePreview}
                  isScanning={isExtracting}
                  onRemove={() => {
                    onExamDataChange({ questionsPaper: null })
                    setExtractionNotice(null)
                  }}
                />

                {/* Auto-crop hint for images */}
                {examData.questionsPaper.type.startsWith('image/') && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                    <Scissors className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      Blank borders will be <strong>auto-cropped</strong> server-side before extraction — fewer tokens, sharper results.
                    </span>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={extractQuestionsWithAI}
                  disabled={busy}
                  className="w-full border-amber-400 text-amber-700 hover:bg-amber-50 gap-2"
                >
                  <BrainCircuit className="w-4 h-4" />
                  {isExtracting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                      Extracting questions…
                    </span>
                  ) : 'Extract Questions with AI'}
                </Button>

                {extractionNotice && <ExtractionNotice notice={extractionNotice} />}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Answer Model */}
        <Card>
          <CardHeader className="text-center pb-3">
            <CardTitle className="text-sky-700">Answer Model</CardTitle>
            <CardDescription className="text-sky-600">
              Upload the answer key — up to 30 pages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!examData.answerModel ? (
              <DropZone
                color="sky"
                label="Upload Answer Model"
                maxPages={30}
                isDragging={answerModelDrag}
                onDragEnter={() => setAnswerModelDrag(true)}
                onDragLeave={() => setAnswerModelDrag(false)}
                onFile={f => {
                  if (acceptFile(f)) {
                    onExamDataChange({ answerModel: f })
                    setAnswerKeyNotice(null)
                  }
                }}
              />
            ) : (
              <div className="space-y-3">
                <FileRow
                  file={examData.answerModel}
                  imagePreview={answerImagePreview}
                  isScanning={isExtractingAnswers}
                  onRemove={() => {
                    onExamDataChange({ answerModel: null })
                    setAnswerKeyNotice(null)
                  }}
                />

                {examData.answerModel.type.startsWith('image/') && (
                  <div className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-700">
                    <Scissors className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      Blank borders will be <strong>auto-cropped</strong> server-side before extraction.
                    </span>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={extractAnswerKeyWithAI}
                  disabled={busy}
                  className="w-full border-sky-400 text-sky-700 hover:bg-sky-50 gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isExtractingAnswers ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                      {detectedSubject?.agentName || 'Expert Agent'} extracting…
                    </span>
                  ) : 'Extract Answer Key with AI'}
                </Button>

                {questions.length === 0 && !isExtractingAnswers && (
                  <p className="text-xs text-muted-foreground text-center">
                    💡 Extract questions first for better answer matching.
                  </p>
                )}

                {answerKeyNotice && <ExtractionNotice notice={answerKeyNotice} />}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Exam Instructions</CardTitle>
          <CardDescription>Guidelines shown to students</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g. Answer all questions. Show your working for partial credit."
            value={examData.instructions}
            onChange={e => onExamDataChange({ instructions: e.target.value })}
            rows={4}
            className="resize-none"
            disabled={busy}
          />
        </CardContent>
      </Card>

      {/* Questions section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle>Questions</CardTitle>
              <Badge variant="outline">
                {questions.length} {questions.length === 1 ? 'Question' : 'Questions'}
              </Badge>

              {/* Live stats */}
              {questions.length > 0 && (
                <>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <Award className="w-3 h-3" />
                    {total} total marks
                  </span>
                  {answered > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      {answered}/{questions.length} answered
                    </span>
                  )}
                  {hasRubric > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                      <BarChart3 className="w-3 h-3" />
                      {hasRubric} with rubric
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Expand / Collapse all */}
            {questions.length > 1 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={expandAll}
                  className="h-7 px-2 text-xs text-muted-foreground"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5 mr-1" />
                  Expand all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={collapseAll}
                  className="h-7 px-2 text-xs text-muted-foreground"
                >
                  <ChevronsDownUp className="w-3.5 h-3.5 mr-1" />
                  Collapse all
                </Button>
              </div>
            )}
          </div>
          <CardDescription>
            Add questions with model answers and keywords for AI evaluation
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {questions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="font-medium">No questions added yet</p>
              <p className="text-sm mt-1">Extract from a file above or click "Add Question"</p>
            </div>
          ) : (
            questions.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                keywordInput={keywordInputs[q.id] ?? ''}
                onToggle={() => toggleQuestion(q.id)}
                onRemove={() => removeQuestion(q.id)}
                onUpdate={(field, value) => updateQuestion(q.id, field, value)}
                onKeywordChange={v => setKeywordInputs(prev => ({ ...prev, [q.id]: v }))}
                onKeywordKeyDown={e => handleKeywordKeyDown(q.id, e, keywordInputs[q.id] ?? '')}
                onAddKeyword={kw => addKeyword(q.id, kw)}
                onRemoveKeyword={kw => removeKeyword(q.id, kw)}
              />
            ))
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full border-2 border-dashed"
            onClick={addQuestion}
            disabled={busy}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Question
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onCreateExam}
          disabled={!examData.title || busy}
          className="min-w-[130px]"
        >
          {isCreating ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Creating…
            </span>
          ) : 'Create Exam'}
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// QuestionCard
// ─────────────────────────────────────────────────────────────────────────────

interface QuestionCardProps {
  q: Question
  keywordInput: string
  onToggle: () => void
  onRemove: () => void
  onUpdate: (field: keyof Question, value: unknown) => void
  onKeywordChange: (v: string) => void
  onKeywordKeyDown: (e: React.KeyboardEvent) => void
  onAddKeyword: (kw: string) => void
  onRemoveKeyword: (kw: string) => void
}

function QuestionCard({
  q,
  keywordInput,
  onToggle,
  onRemove,
  onUpdate,
  onKeywordChange,
  onKeywordKeyDown,
  onAddKeyword,
  onRemoveKeyword,
}: QuestionCardProps) {
  const marksNum = typeof q.marks === 'number' ? q.marks : 0
  const marksColor =
    marksNum >= 15 ? 'text-red-600 bg-red-50 border-red-200' :
    marksNum >= 8  ? 'text-amber-600 bg-amber-50 border-amber-200' :
                     'text-emerald-600 bg-emerald-50 border-emerald-200'

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      {/* Header row */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Badge variant="outline" className="flex-shrink-0 font-mono text-xs">
            Q{q.questionNumber}
          </Badge>

          {/* Marks colour badge */}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${marksColor}`}>
            {q.marks !== '' ? `${q.marks}M` : '–M'}
          </span>

          <div className="text-sm font-medium truncate flex-1">
            {q.text
              ? <MathRenderer className="inline">{q.text}</MathRenderer>
              : <span className="text-muted-foreground italic text-xs">No question text yet…</span>
            }
          </div>

          {/* Status chips – hidden on mobile to avoid overflow */}
          <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
            {q.modelAnswer && (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                ✓ Answer
              </span>
            )}
            {q.rubric && (
              <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                ✓ Rubric
              </span>
            )}
            {q.keywords.length > 0 && (
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                {q.keywords.length} kw
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
            {q.expanded
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </Button>
        </div>
      </div>

      {/* Expanded body */}
      {q.expanded && (
        <div className="px-4 pb-4 border-t pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Question text */}
            <div>
              <Label
                htmlFor={`qt-${q.id}`}
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Question Text
              </Label>
              <Textarea
                id={`qt-${q.id}`}
                placeholder="Enter the question…"
                value={q.text}
                onChange={e => onUpdate('text', e.target.value)}
                rows={4}
                className="mt-1 resize-none text-sm"
              />
            </div>

            {/* Model Answer */}
            <div>
              <Label
                htmlFor={`ma-${q.id}`}
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Model Answer
              </Label>
              <Textarea
                id={`ma-${q.id}`}
                placeholder="Enter the model answer…"
                value={q.modelAnswer}
                onChange={e => onUpdate('modelAnswer', e.target.value)}
                rows={4}
                className="mt-1 resize-y max-h-[200px] text-sm"
              />
            </div>
          </div>

          {/* Grading Rubric */}
          <div>
            <Label
              htmlFor={`rb-${q.id}`}
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Grading Rubric{' '}
              <span className="font-normal normal-case text-muted-foreground/60">(optional)</span>
            </Label>
            <Textarea
              id={`rb-${q.id}`}
              placeholder="e.g. 2 marks for correct formula. 3 for working. Deduct 1 for missing units."
              value={q.rubric ?? ''}
              onChange={e => onUpdate('rubric', e.target.value)}
              rows={2}
              className="mt-1 resize-none text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Marks */}
            <div>
              <Label
                htmlFor={`mk-${q.id}`}
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Marks
              </Label>
              <Input
                id={`mk-${q.id}`}
                type="number"
                min={0}
                placeholder="e.g. 10"
                value={q.marks === '' ? '' : q.marks}
                onChange={e => {
                  const v = e.target.value
                  onUpdate('marks', v === '' ? '' : parseInt(v, 10))
                }}
                className="mt-1 text-sm"
              />
            </div>

            {/* Keywords */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Keywords
              </Label>
              <div className="mt-1 p-2 border rounded-md focus-within:ring-1 focus-within:ring-ring min-h-[38px]">
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {q.keywords.map((kw, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="bg-blue-50 text-blue-800 border border-blue-200 text-xs gap-1"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => onRemoveKeyword(kw)}
                        className="hover:bg-blue-200 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Add keyword (Enter or comma)"
                  className="w-full text-xs outline-none bg-transparent placeholder:text-muted-foreground"
                  value={keywordInput}
                  onChange={e => onKeywordChange(e.target.value)}
                  onKeyDown={onKeywordKeyDown}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Enter or comma to add · Backspace removes last
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DropZone
// ─────────────────────────────────────────────────────────────────────────────

type DropZoneColor = 'amber' | 'sky'

function DropZone({
  color, label, maxPages, isDragging, onDragEnter, onDragLeave, onFile,
}: {
  color: DropZoneColor
  label: string
  maxPages: number
  isDragging: boolean
  onDragEnter: () => void
  onDragLeave: () => void
  onFile: (f: File) => void
}) {
  const palette = {
    amber: {
      border: isDragging ? 'border-amber-500 bg-amber-50' : 'border-amber-300 hover:border-amber-400',
      icon:   'text-amber-500',
      btn:    'border-amber-400 text-amber-700 hover:bg-amber-50',
    },
    sky: {
      border: isDragging ? 'border-sky-500 bg-sky-50' : 'border-sky-300 hover:border-sky-400',
      icon:   'text-sky-500',
      btn:    'border-sky-400 text-sky-700 hover:bg-sky-50',
    },
  }[color]

  const openPicker = () => {
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = '.pdf,.png,.jpg,.jpeg,.webp,.txt'
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (f) onFile(f)
    }
    input.click()
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${palette.border}`}
      onDragOver={e  => { e.preventDefault(); onDragEnter() }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDragLeave(); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}
      onClick={openPicker}
    >
      <FileText className={`w-12 h-12 mx-auto mb-4 ${palette.icon}`} />
      <Button
        type="button"
        variant="outline"
        className={`mb-4 ${palette.btn}`}
        onClick={e => { e.stopPropagation(); openPicker() }}
      >
        <Upload className="w-4 h-4 mr-2" />
        {label}
      </Button>
      <p className="text-sm text-muted-foreground mb-2">or drag &amp; drop</p>
      <p className="text-xs text-muted-foreground mb-2">Up to {maxPages} pages</p>
      <div className="flex flex-wrap justify-center gap-2">
        {['PDF', 'PNG', 'JPG', 'WEBP', 'TXT'].map(ext => (
          <Badge key={ext} variant="outline" className="text-xs">{ext}</Badge>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FileRow  –  shows thumbnail for images, file icon for PDFs/text
// ─────────────────────────────────────────────────────────────────────────────

function FileRow({
  file,
  imagePreview,
  onRemove,
  isScanning = false,
}: {
  file: File
  imagePreview: string | null
  onRemove: () => void
  isScanning?: boolean
}) {
  const typeInfo = getFileTypeLabel(file)

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Thumbnail for images, icon for others */}
        {imagePreview ? (
          <div className="relative">
            <div className={`w-12 h-12 rounded-lg overflow-hidden border flex-shrink-0 bg-white ${
              isScanning 
                ? 'border-blue-400 animate-pulse' 
                : 'border-green-300'
            }`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              
              {/* Scanning overlay effect */}
              {isScanning && (
                <div className="absolute inset-0 bg-blue-400/20 animate-pulse">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-blue-500 rounded-full animate-ping" />
                  </div>
                </div>
              )}
            </div>
            
            {/* Scanning indicator dot */}
            {isScanning && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            )}
          </div>
        ) : (
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            {file.type === 'application/pdf'
              ? <FileText className="w-5 h-5 text-red-500" />
              : <FileText className="w-5 h-5 text-green-600" />
            }
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-green-900 text-sm truncate max-w-[140px]">
              {file.name}
            </p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-green-600">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            {imagePreview && !isScanning && (
              <span className="text-xs text-amber-600 font-medium">→ will be auto-cropped</span>
            )}
            {isScanning && (
              <span className="text-xs text-blue-600 font-medium animate-pulse">Scanning...</span>
            )}
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-destructive hover:bg-destructive/10 h-7 w-7 p-0 flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ExtractionNotice  –  success / error + optional token-savings badge
// ─────────────────────────────────────────────────────────────────────────────

function ExtractionNotice({ notice }: { notice: Notice }) {
  const ok = notice.type === 'success'
  
  // Calculate scan quality score based on image optimization
  const scanQuality = notice.imageOpt ? Math.min(95, 85 + (notice.imageOpt.savedPercent * 0.3)) : 85
  const scanQualityLabel = scanQuality >= 90 ? 'EXCELLENT' : scanQuality >= 80 ? 'GOOD' : 'FAIR'
  const scanQualityColor = scanQuality >= 90 ? 'text-emerald-700' : scanQuality >= 80 ? 'text-blue-700' : 'text-amber-700'
  
  return (
    <div
      className={`rounded-lg border px-3 py-3 text-xs space-y-2 ${
        ok
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-destructive/5 border-destructive/20 text-destructive'
      }`}
    >
      {/* Main status message */}
      <div className="flex items-start gap-2">
        {ok
          ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          : <AlertCircle  className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />}
        <span className="font-medium">{notice.message}</span>
      </div>

      {/* Scan Quality Index - similar to TomatoGuard Health Index */}
      {ok && notice.imageOpt && (
        <div className="flex items-center justify-between pt-1 border-t border-emerald-200">
          <span className="text-emerald-700 font-semibold">SCAN QUALITY</span>
          <div className="flex items-center gap-2">
            <div className="w-12 h-2 bg-emerald-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  scanQuality >= 90 ? 'bg-emerald-500' : 
                  scanQuality >= 80 ? 'bg-blue-500' : 'bg-amber-500'
                }`}
                style={{ width: `${scanQuality}%` }}
              />
            </div>
            <span className={`font-bold ${scanQualityColor}`}>
              {Math.round(scanQuality)}% ({scanQualityLabel})
            </span>
          </div>
        </div>
      )}

      {/* Detailed scan results */}
      {ok && notice.imageOpt && (
        <div className="space-y-1.5">
          {/* Crop status */}
          <div className="flex items-center gap-2">
            <Scissors className="w-3 h-3 text-amber-500 flex-shrink-0" />
            <span className="text-emerald-700">
              {notice.imageOpt.wasCropped 
                ? `Borders removed: ${notice.imageOpt.originalKB} KB → ${notice.imageOpt.processedKB} KB (saved ${notice.imageOpt.savedPercent}%)`
                : `No cropping needed: ${notice.imageOpt.processedKB} KB`
              }
            </span>
          </div>
          
          {/* Dimensions */}
          <div className="flex items-center gap-2">
            <ImageIcon className="w-3 h-3 text-blue-500 flex-shrink-0" />
            <span className="text-emerald-700">
              Resolution: {notice.imageOpt.dimensions}px
            </span>
          </div>
        </div>
      )}
    </div>
  )
}