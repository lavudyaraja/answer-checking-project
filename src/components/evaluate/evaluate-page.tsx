// Place this file at: components/evaluate/evaluate-page.tsx
// or wherever your evaluate page component lives.
//
// This component is self-contained:
//  – handles exam/question fetching
//  – submits to /api/evaluate
//  – polls /api/evaluate/status/[fileId] for live progress
//  – renders agent steps, progress bar, and final results

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import type { AIProvider } from '@/lib/ai/ai-provider'
import {
  Upload, FileText, ChevronDown, CheckCircle2, X, BookOpen, Clock,
  Activity, FileCheck, AlertTriangle, Award, Brain, Zap, RotateCcw,
  ChevronRight, TrendingUp, Target, Shield, ArrowLeft, RefreshCw,
  CheckCheck, AlertCircle, Info
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Exam {
  id: string
  title: string
  subject: string
  questionCount: number
  totalMarks: number
  duration: number
}

interface Question {
  questionId: string
  questionNumber: number
  questionText: string
  maxMarks: number
  rubric?: string
}

interface QuestionResult {
  questionId: string
  questionNumber: number
  maxMarks: number
  obtainedMarks: number
  feedback?: string
  confidence?: number
  error?: string
}

interface EvaluationResult {
  totalMarks: number
  maxMarks: number
  percentage: number
  grade: string
  subject: string
  difficulty: string
  overallFeedback: string
  questionResults: QuestionResult[]
  lowConfidenceQuestions: string[]
}

interface StatusResponse {
  fileId: string
  status: {
    progress: number
    status: string
    completed: boolean
    activeAgent: string
  }
  result: EvaluationResult | null
}

type Phase = 'setup' | 'processing' | 'results'
type Difficulty = 'beginner' | 'intermediate' | 'expert' | 'auto'

// ─── Agent step definitions ──────────────────────────────────────────────────

const AGENT_STEPS = [
  { key: 'Coordinator', label: 'Coordinator', desc: 'Detecting subject & routing', icon: Brain, progressRange: [0, 25] },
  { key: 'Expert',      label: 'Subject Expert', desc: 'Grading answers with Vision AI', icon: Target, progressRange: [25, 80] },
  { key: 'Reviewer',   label: 'Reviewer',  desc: 'Auditing consistency & marks', icon: Shield, progressRange: [80, 98] },
  { key: 'Complete',   label: 'Complete',  desc: 'Results compiled', icon: CheckCheck, progressRange: [98, 100] },
]

function getAgentStepStatus(step: typeof AGENT_STEPS[number], progress: number, activeAgent?: string) {
  if (progress >= step.progressRange[1]) return 'done'
  if ((activeAgent && activeAgent.includes(step.key)) || (progress >= step.progressRange[0] && progress < step.progressRange[1])) return 'active'
  return 'pending'
}

// ─── Grade helpers ───────────────────────────────────────────────────────────

const GRADE_STYLES: Record<string, string> = {
  'A+': 'bg-emerald-50 border-emerald-200 text-emerald-700',
  'A':  'bg-green-50 border-green-200 text-green-700',
  'B':  'bg-blue-50 border-blue-200 text-blue-700',
  'C':  'bg-amber-50 border-amber-200 text-amber-700',
  'D':  'bg-orange-50 border-orange-200 text-orange-700',
  'F':  'bg-red-50 border-red-200 text-red-700',
}

function gradeColor(grade: string) {
  return GRADE_STYLES[grade] ?? 'bg-gray-50 border-gray-200 text-gray-700'
}

function confidenceLabel(conf?: number) {
  if (conf == null) return null
  if (conf >= 80) return { label: 'High', cls: 'text-green-600 bg-green-50' }
  if (conf >= 60) return { label: 'Medium', cls: 'text-amber-600 bg-amber-50' }
  return { label: 'Low', cls: 'text-red-600 bg-red-50' }
}

// ════════════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════════════

export function EvaluatePage() {
  const { toast } = useToast()
  const router = useRouter()

  // ── Phase ────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('setup')

  // ── Setup state ──────────────────────────────────────────────────────────
  const [exams, setExams] = useState<Exam[]>([])
  const [isLoadingExams, setIsLoadingExams] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [studentName, setStudentName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [answerSheet, setAnswerSheet] = useState<File | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('auto')
  const [dragActive, setDragActive] = useState(false)
  const [aiProvider, setAiProvider] = useState<AIProvider>('groq')

  // ── Processing state ─────────────────────────────────────────────────────
  const [fileId, setFileId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [activeAgent, setActiveAgent] = useState('System')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Results state ────────────────────────────────────────────────────────
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())

  // ── Load AI provider ──────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('aiProvider') as AIProvider | null
      if (stored === 'groq' || stored === 'claude') setAiProvider(stored)
    } catch { /* ignore */ }
  }, [])

  // ── Fetch exams ────────────────────────────────────────────────────────────
  const fetchExams = useCallback(async () => {
    try {
      setFetchError(null)
      setIsLoadingExams(true)
      const res = await fetch('/api/exams/list')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setExams(data.exams ?? [])
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch exams')
      setExams([])
    } finally {
      setIsLoadingExams(false)
    }
  }, [])

  useEffect(() => { fetchExams() }, [fetchExams])

  // ── Fetch questions when exam is selected ─────────────────────────────────
  const selectExam = useCallback(async (exam: Exam | null) => {
    setSelectedExam(exam)
    setQuestions([])
    if (!exam) return
    try {
      const res = await fetch(`/api/exams/${exam.id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const qs: Question[] = (data.questions ?? []).map((q: any, idx: number) => ({
        ...q,
        questionId: q.questionId?.toString().trim() || `q${q.questionNumber ?? idx + 1}`,
        questionNumber: q.questionNumber ?? idx + 1,
      }))
      setQuestions(qs)
    } catch {
      toast({ title: 'Could not load questions', description: 'Questions will still be submitted if stored with the exam.', variant: 'destructive' })
    }
  }, [toast])

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFile = (file: File) => {
    const valid = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!valid.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please upload PDF, JPEG, PNG, or DOCX.', variant: 'destructive' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB allowed.', variant: 'destructive' })
      return
    }
    setAnswerSheet(file)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }

  // ── Polling ───────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const startPolling = useCallback((id: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/evaluate/student/status?evaluationId=${id}`)
        if (!res.ok) return
        const data: StatusResponse = await res.json()

        setProgress(data.status.progress)
        setStatusMsg(data.status.status)
        setActiveAgent(data.status.activeAgent)

        if (data.status.completed) {
          stopPolling()
          if (data.result) {
            // Store result in sessionStorage for the results page
            sessionStorage.setItem('evaluationResult', JSON.stringify(data.result))
            sessionStorage.setItem('evaluationMetadata', JSON.stringify({
              studentName,
              rollNumber,
              examTitle: selectedExam?.title,
              subject: data.result.subject,
              difficulty: data.result.difficulty
            }))
            // Redirect to results page
            router.push('/dashboard/results')
          } else {
            toast({ title: 'Evaluation failed', description: data.status.status, variant: 'destructive' })
            setPhase('setup')
          }
        }
      } catch {
        // silently retry
      }
    }, 1500)
  }, [stopPolling, toast])

  useEffect(() => () => stopPolling(), [stopPolling])

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedExam)      return toast({ title: 'Select an exam', variant: 'destructive' })
    if (!studentName.trim()) return toast({ title: 'Enter student name', variant: 'destructive' })
    if (!rollNumber.trim())  return toast({ title: 'Enter roll number', variant: 'destructive' })
    if (!answerSheet)        return toast({ title: 'Upload answer sheet', variant: 'destructive' })

    const fd = new FormData()
    fd.append('answerSheet', answerSheet)
    fd.append('examId', selectedExam.id)
    fd.append('studentName', studentName)
    fd.append('rollNumber', rollNumber)
    fd.append('notes', notes)
    fd.append('difficulty', difficulty)
    fd.append('aiProvider', aiProvider)

    setPhase('processing')
    setProgress(0)
    setStatusMsg('Submitting to evaluation agents…')
    setActiveAgent('System')

    try {
      const res = await fetch('/api/evaluate/student', { method: 'POST', body: fd })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setFileId(data.evaluationId)
      startPolling(data.evaluationId)
    } catch (err) {
      toast({ title: 'Failed to start evaluation', description: String(err), variant: 'destructive' })
      setPhase('setup')
    }
  }

  const handleReset = () => {
    stopPolling()
    setPhase('setup')
    setResult(null)
    setFileId(null)
    setProgress(0)
    setStatusMsg('')
    setAnswerSheet(null)
    setStudentName('')
    setRollNumber('')
    setNotes('')
    setExpandedQuestions(new Set())
  }

  const toggleQuestion = (id: string) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER — PROCESSING PHASE
  // ════════════════════════════════════════════════════════════════════════

  if (phase === 'processing') {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-6 py-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Evaluation in Progress</h1>
          <p className="text-slate-500 text-sm">
            {selectedExam?.title} · {studentName} · {rollNumber}
          </p>
        </div>

        {/* Overall Progress */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700">Overall Progress</span>
              <span className="text-sm font-bold text-indigo-600">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2.5" />
            <p className="text-sm text-slate-600 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              {statusMsg || 'Starting…'}
            </p>
          </CardContent>
        </Card>

        {/* Agent Steps */}
        <div className="space-y-3">
          {AGENT_STEPS.map((step, idx) => {
            const status = getAgentStepStatus(step, progress, activeAgent)
            const Icon = step.icon
            return (
              <Card
                key={step.key}
                className={`border transition-all duration-300 ${
                  status === 'active'  ? 'border-indigo-300 bg-indigo-50/60 shadow-sm' :
                  status === 'done'    ? 'border-emerald-200 bg-emerald-50/40' :
                                        'border-slate-200 bg-white opacity-50'
                }`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Step number / icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    status === 'done'   ? 'bg-emerald-100' :
                    status === 'active' ? 'bg-indigo-100'  :
                                         'bg-slate-100'
                  }`}>
                    {status === 'done' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : status === 'active' ? (
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-sm font-semibold text-slate-400">{idx + 1}</span>
                    )}
                  </div>

                  {/* Labels */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${
                      status === 'done'   ? 'text-emerald-700' :
                      status === 'active' ? 'text-indigo-700'  :
                                           'text-slate-400'
                    }`}>{step.label}</p>
                    <p className="text-xs text-slate-500 truncate">{step.desc}</p>
                  </div>

                  {/* Right badge */}
                  {status === 'done' && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Done</Badge>
                  )}
                  {status === 'active' && (
                    <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs animate-pulse">Running</Badge>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <p className="text-center text-xs text-slate-400">
          Do not close this tab. Evaluation may take 1–3 minutes.
        </p>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER — RESULTS PHASE
  // ════════════════════════════════════════════════════════════════════════

  if (phase === 'results' && result) {
    const scorePercent = result.percentage
    const lowConfSet = new Set(result.lowConfidenceQuestions)

    return (
      <div className="w-full max-w-3xl mx-auto space-y-6 py-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            New Evaluation
          </button>
          <Badge variant="outline" className="text-xs">
            {result.subject} · {result.difficulty}
          </Badge>
        </div>

        {/* Score Summary Card */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 text-white">
            <p className="text-slate-300 text-sm mb-1">{studentName} · {rollNumber}</p>
            <h2 className="text-lg font-semibold text-white">{selectedExam?.title}</h2>
          </div>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* Score */}
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-900">
                  {result.totalMarks}<span className="text-base font-normal text-slate-400">/{result.maxMarks}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">Total Score</p>
              </div>
              {/* Percentage */}
              <div className="text-center">
                <p className="text-3xl font-bold text-indigo-600">{scorePercent}%</p>
                <p className="text-xs text-slate-500 mt-1">Percentage</p>
              </div>
              {/* Grade */}
              <div className="text-center">
                <span className={`inline-block text-3xl font-bold px-3 py-1 rounded-lg border ${gradeColor(result.grade)}`}>
                  {result.grade}
                </span>
                <p className="text-xs text-slate-500 mt-1">Grade</p>
              </div>
              {/* Questions */}
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-900">{result.questionResults.length}</p>
                <p className="text-xs text-slate-500 mt-1">Questions</p>
              </div>
            </div>

            {/* Score bar */}
            <div className="mt-6">
              <Progress value={scorePercent} className="h-2" />
            </div>

            {/* AI Feedback */}
            {result.overallFeedback && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                  <Info className="w-3 h-3" /> AI Summary
                </p>
                <p className="text-sm text-slate-700">{result.overallFeedback}</p>
              </div>
            )}

            {/* Low confidence warning */}
            {result.lowConfidenceQuestions.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  <strong>{result.lowConfidenceQuestions.length} question(s)</strong> flagged for low AI confidence — manual review recommended.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-question Results */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Question-by-Question Breakdown
          </h3>
          {result.questionResults
            .slice()
            .sort((a, b) => a.questionNumber - b.questionNumber)
            .map((qr) => {
              const isExpanded = expandedQuestions.has(qr.questionId)
              const pct = qr.maxMarks ? Math.round((qr.obtainedMarks / qr.maxMarks) * 100) : 0
              const isLow = lowConfSet.has(qr.questionId)
              const conf = confidenceLabel(qr.confidence)

              return (
                <Card
                  key={qr.questionId}
                  className={`border transition-colors ${isLow ? 'border-amber-200' : 'border-slate-200'}`}
                >
                  <button
                    className="w-full text-left p-4 flex items-center gap-4"
                    onClick={() => toggleQuestion(qr.questionId)}
                  >
                    {/* Q number */}
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-slate-600">Q{qr.questionNumber}</span>
                    </div>

                    {/* Marks bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">
                          {qr.obtainedMarks} / {qr.maxMarks} marks
                        </span>
                        <span className={`text-xs font-semibold ${
                          pct >= 80 ? 'text-emerald-600' :
                          pct >= 50 ? 'text-amber-600'  :
                                      'text-red-600'
                        }`}>{pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 80 ? 'bg-emerald-500' :
                            pct >= 50 ? 'bg-amber-400'   :
                                        'bg-red-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isLow && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                          Review
                        </span>
                      )}
                      {conf && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${conf.cls}`}>
                          {conf.label}
                        </span>
                      )}
                      <ChevronRight
                        className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </button>

                  {/* Expanded feedback */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2 ml-13">
                      {qr.error ? (
                        <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <p className="text-sm text-red-700">{qr.error}</p>
                        </div>
                      ) : qr.feedback ? (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-xs text-slate-400 mb-1">AI Feedback</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{qr.feedback}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 italic">No feedback available.</p>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
        </div>

        {/* Restart */}
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Evaluate Another Student
          </Button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER — SETUP PHASE
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 py-4">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Evaluate Answer Sheet</h1>
        <p className="text-slate-500 text-sm">
          Upload a student's handwritten or typed answer sheet to auto-grade with AI agents.
        </p>
      </div>

      {/* AI Provider pill */}
      <div>
        <Badge
          variant="outline"
          className={
            aiProvider === 'claude'
              ? 'border-violet-200 bg-violet-50 text-violet-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }
        >
          {aiProvider === 'claude' ? (
            <><Brain className="w-3 h-3 mr-1" />Claude (Sonnet 4.6)</>
          ) : (
            <><Zap className="w-3 h-3 mr-1" />Groq (Llama 4 Scout)</>
          )}
        </Badge>
      </div>

      {/* ── Exam Selector ─────────────────────────────────────────────── */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-slate-700">
              Exam <span className="text-red-500">*</span>
            </Label>
            {fetchError && (
              <button onClick={fetchExams} className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            )}
          </div>

          {isLoadingExams ? (
            <div className="flex items-center gap-2 h-10">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-sm text-slate-500">Loading exams…</span>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal text-left">
                  <span className={selectedExam ? 'text-slate-900' : 'text-slate-400'}>
                    {selectedExam ? selectedExam.title : 'Select an exam…'}
                  </span>
                  <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                {exams.length === 0 ? (
                  <DropdownMenuItem disabled>No exams found. Create one first.</DropdownMenuItem>
                ) : (
                  exams.map(exam => (
                    <DropdownMenuItem key={exam.id} onClick={() => selectExam(exam)}>
                      <div>
                        <p className="font-medium">{exam.title}</p>
                        <p className="text-xs text-slate-500">{exam.subject} · {exam.questionCount} Qs · {exam.totalMarks} marks</p>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Exam metadata chips */}
          {selectedExam && (
            <div className="flex flex-wrap gap-2">
              {[
                { icon: BookOpen, text: selectedExam.subject || '—' },
                { icon: FileText, text: `${selectedExam.questionCount} Questions` },
                { icon: Activity, text: `${selectedExam.totalMarks} Marks` },
                { icon: Clock, text: selectedExam.duration ? `${selectedExam.duration} min` : '—' },
              ].map(({ icon: Icon, text }) => (
                <Badge key={text} variant="secondary" className="text-xs gap-1">
                  <Icon className="w-3 h-3" />{text}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Student Info ───────────────────────────────────────────────── */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <Label className="text-sm font-semibold text-slate-700">Student Information</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="studentName" className="text-xs text-slate-500 uppercase tracking-wide">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="studentName"
                placeholder="e.g. Ravi Kumar"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rollNumber" className="text-xs text-slate-500 uppercase tracking-wide">
                Roll Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="rollNumber"
                placeholder="e.g. 2024CS001"
                value={rollNumber}
                onChange={e => setRollNumber(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs text-slate-500 uppercase tracking-wide">
              Notes (Optional)
            </Label>
            <Input
              id="notes"
              placeholder="Any special instructions or context…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Difficulty ─────────────────────────────────────────────────── */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold text-slate-700">Evaluation Difficulty</Label>
            {difficulty === 'auto' && (
              <Badge variant="secondary" className="text-xs">
                <Brain className="h-3 w-3 mr-1" />
                Auto-balanced
              </Badge>
            )}
          </div>
          {difficulty === 'auto' && (
            <p className="text-xs text-slate-500">
              🤖 AI will automatically select the optimal difficulty level based on question complexity and total marks.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {(['auto', 'beginner', 'intermediate', 'expert'] as Difficulty[]).map(lvl => (
              <button
                key={lvl}
                onClick={() => setDifficulty(lvl)}
                className={`py-2.5 px-3 rounded-lg border text-sm font-medium capitalize transition-all ${
                  difficulty === lvl
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {lvl === 'auto' ? '🤖 Auto Balance' : lvl}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── File Upload ────────────────────────────────────────────────── */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <Label className="text-sm font-semibold text-slate-700">
            Answer Sheet <span className="text-red-500">*</span>
          </Label>

          {!answerSheet ? (
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">Drop file here or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">PDF, JPEG, PNG, DOCX — max 10 MB</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-800 truncate">{answerSheet.name}</p>
                <p className="text-xs text-emerald-600">{(answerSheet.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAnswerSheet(null)}
                className="text-red-500 hover:bg-red-50 hover:text-red-600 p-1 h-auto"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Submit Button ─────────────────────────────────────────────── */}
      <Button
        onClick={handleSubmit}
        disabled={!selectedExam || !studentName.trim() || !rollNumber.trim() || !answerSheet}
        className="w-full h-12 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        <TrendingUp className="w-5 h-5 mr-2" />
        Start AI Evaluation
      </Button>
    </div>
  )
}