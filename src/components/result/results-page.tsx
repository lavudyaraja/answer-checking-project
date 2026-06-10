'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Download, RefreshCw, Users, AlertTriangle,
  Target, Lightbulb, CheckCircle2, XCircle,
  AlertCircle, Eye, Brain, Award, BarChart3,
  Grid3X3, List, ArrowUp, ArrowDown, Minus,
  Activity, ChevronsUpDown, Clock, FileText,
  TrendingUp, TrendingDown, User, BookOpen,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import { ScoreArcDisplay } from './circular-progress-bar'

// ─── Vision Model Text Extraction Helper ───────────────────────────────────────

async function extractTextFromImage(imageDataUrl: string, evaluationId?: string, questionId?: string): Promise<string> {
  try {
    // Use the existing vision language model for text extraction
    const response = await fetch('/api/extracted/extract-student-answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        image: imageDataUrl,
        evaluationId,
        questionId
      }),
    })
    
    if (!response.ok) {
      throw new Error('Text extraction failed')
    }
    
    const result = await response.json()
    return result.text || ''
  } catch (error) {
    console.error('Text extraction error:', error)
    return ''
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionResult {
  questionNumber?: number
  questionText?: string
  obtainedMarks?: number
  maxMarks?: number
  confidence?: number
  strength?: string
  mistakes?: string
  missingConcepts?: string
  suggestions?: string
  reasoning?: string
  studentAnswer?: string
  modelAnswer?: string
  number?: number
  text?: string
  feedback?: string
  keywordsFound?: string[]
  keywordsMissed?: string[]
  studentAnswerImage?: string
  illegibleSections?: string[]
  illegibleParts?: string | null
}

interface OverallResult {
  id?: string
  examTitle?: string
  studentName?: string
  rollNumber?: string
  subject?: string
  totalMarks: number
  maxMarks: number
  percentage: number
  grade: string
  questionCount?: number
  date?: string
  overallFeedback?: string
  questions?: QuestionResult[]
  questionResults?: QuestionResult[]
}

interface ResultsPageProps {
  result: OverallResult
  onReEvaluate: () => void
  onEvaluateAnother: () => void
  onDownloadReport: () => void
}

// ─── Score helpers ─────────────────────────────────────────────────────────────

type ScoreLevel = 'excellent' | 'good' | 'average' | 'below' | 'fail'

function scoreLevel(pct: number): ScoreLevel {
  if (pct >= 85) return 'excellent'
  if (pct >= 70) return 'good'
  if (pct >= 55) return 'average'
  if (pct >= 40) return 'below'
  return 'fail'
}

const SCORE_META: Record<ScoreLevel, {
  text: string; bar: string; badge: string; border: string; dot: string; hex: string
  gradient: string; gradientFrom: string; gradientTo: string
}> = {
  excellent: {
    text: 'text-emerald-700', bar: 'bg-emerald-500',
    badge: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    border: 'border-emerald-200', dot: 'bg-emerald-500',
    hex: '#10b981',
    gradient: 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)',
    gradientFrom: '#d1fae5', gradientTo: '#ecfdf5',
  },
  good: {
    text: 'text-sky-700', bar: 'bg-sky-500',
    badge: 'text-sky-700 bg-sky-50 border-sky-200',
    border: 'border-sky-200', dot: 'bg-sky-500',
    hex: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #bae6fd 0%, #f0f9ff 100%)',
    gradientFrom: '#bae6fd', gradientTo: '#f0f9ff',
  },
  average: {
    text: 'text-amber-700', bar: 'bg-amber-500',
    badge: 'text-amber-700 bg-amber-50 border-amber-200',
    border: 'border-amber-200', dot: 'bg-amber-500',
    hex: '#f59e0b',
    gradient: 'linear-gradient(135deg, #fde68a 0%, #fffbeb 100%)',
    gradientFrom: '#fde68a', gradientTo: '#fffbeb',
  },
  below: {
    text: 'text-orange-700', bar: 'bg-orange-500',
    badge: 'text-orange-700 bg-orange-50 border-orange-200',
    border: 'border-orange-200', dot: 'bg-orange-500',
    hex: '#f97316',
    gradient: 'linear-gradient(135deg, #fed7aa 0%, #fff7ed 100%)',
    gradientFrom: '#fed7aa', gradientTo: '#fff7ed',
  },
  fail: {
    text: 'text-red-700', bar: 'bg-red-500',
    badge: 'text-red-700 bg-red-50 border-red-200',
    border: 'border-red-200', dot: 'bg-red-500',
    hex: '#ef4444',
    gradient: 'linear-gradient(135deg, #fecaca 0%, #fef2f2 100%)',
    gradientFrom: '#fecaca', gradientTo: '#fef2f2',
  },
}

function sm(pct: number) { return SCORE_META[scoreLevel(pct)] }
function fmt(n: number) { return n.toFixed(1) }

// ─── Mini Circle ──────────────────────────────────────────────────────────────

function MiniCircle({ pct, size = 56, stroke = 5, color, children }: {
  pct: number; size?: number; stroke?: number; color: string; children?: React.ReactNode
}) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  )
}

// ─── Mark Chips ───────────────────────────────────────────────────────────────

function MarkChips({ obtained, max, pct }: { obtained: number; max: number; pct: number }) {
  const meta = sm(pct)
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className="w-8 h-8 flex items-center justify-center text-xs font-bold rounded-full border-2 transition-all"
          style={
            i < obtained
              ? { backgroundColor: meta.hex, borderColor: meta.hex, color: '#fff' }
              : { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#cbd5e1' }
          }
        >
          {i + 1}
        </div>
      ))}
    </div>
  )
}

// ─── Criteria Circle Row ──────────────────────────────────────────────────────

function CriteriaCircles({ question, evaluationId }: { question: QuestionResult; evaluationId?: string }) {
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedText, setExtractedText] = useState<string>('')

  const obtained = question.obtainedMarks ?? 0
  const max      = question.maxMarks ?? 10
  const pct      = max > 0 ? (obtained / max) * 100 : 0
  const conf     = question.confidence ?? 70

  const conceptAcc  = Math.round(question.mistakes        ? Math.max(10, pct - 18) : pct)
  const completeness= Math.round(question.missingConcepts  ? Math.max(10, pct - 12) : Math.min(100, pct + 5))
  const clarity     = Math.round(conf > 80                 ? Math.min(100, pct + 8) : pct)
  const relevance   = Math.round(question.strength         ? Math.min(100, pct + 5) : pct)
  const structure   = Math.round(obtained > 0              ? Math.min(100, pct + 3) : 0)

  const handleOCRExtraction = async () => {
    if (!question.studentAnswerImage || isExtracting) return

    setIsExtracting(true)
    try {
      const text = await extractTextFromImage(
        question.studentAnswerImage, 
        evaluationId, 
        question.questionNumber?.toString()
      )
      setExtractedText(text)
    } catch (error) {
      console.error('OCR extraction failed:', error)
    } finally {
      setIsExtracting(false)
    }
  }

  const displayText = question.studentAnswer || extractedText

  const criteria = [
    { label: 'Concept Understanding', weight: 0.35, pct: conceptAcc,   color: '#6366f1', icon: Target },
    { label: 'Completion Level',    weight: 0.25, pct: completeness,  color: '#10b981', icon: CheckCircle2 },
    { label: 'Answer Clarity',      weight: 0.20, pct: clarity,       color: '#0ea5e9', icon: Eye },
    { label: 'Content Relevance',  weight: 0.12, pct: relevance,     color: '#f59e0b', icon: Activity },
    { label: 'Answer Structure',    weight: 0.08, pct: structure,     color: '#ec4899', icon: BarChart3 },
  ]

  return (
    <div className="space-y-5">
      {/* Mark chips */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5" /> Marks — {obtained} of {max} awarded
        </p>
        <MarkChips obtained={obtained} max={max} pct={pct} />
        <p className="mt-2 text-xs text-gray-500">
          {obtained === max ? '🎯 Perfect score' : obtained === 0 ? 'No marks awarded' : `${max - obtained} mark${max - obtained !== 1 ? 's' : ''} deducted`}
        </p>
      </div>

      {/* Circles row */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" /> Grading Criteria
        </p>
        <div className="flex flex-wrap justify-center gap-12">
          {criteria.map((c) => {
            const Icon = c.icon
            const contribution = max * c.weight * (c.pct / 100)
            return (
              <div
                key={c.label}
                className="group relative flex flex-col items-center gap-2 p-3 rounded-2xl border border-gray-100 bg-white transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer"
                style={{ minWidth: 88 }}
              >
                <MiniCircle pct={c.pct} size={64} stroke={6} color={c.color}>
                  <Icon style={{ width: 14, height: 14, color: c.color }} />
                </MiniCircle>
                <div className="text-center">
                  <p className="text-[11px] font-bold text-gray-700 leading-tight">{c.label}</p>
                  <p style={{ color: c.color }} className="text-[10px] font-semibold">{c.pct}%</p>
                  <p className="text-[9px] text-gray-400">{Math.round(c.weight * 100)}% wt · {contribution.toFixed(1)}pt</p>
                  <p className="text-[8px] text-gray-500 mt-1">{c.pct}% correct</p>
                </div>
                
                {/* Hover tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                  <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                    <div className="font-semibold mb-1">{c.label}</div>
                    <div className="space-y-0.5">
                      <div>Score: {c.pct}%</div>
                      <div>Weight: {Math.round(c.weight * 100)}%</div>
                      <div>Points: {contribution.toFixed(1)}pt</div>
                      <div>Contribution: {((contribution / max) * 100).toFixed(1)}%</div>
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Score formula table */}
      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50 rounded-t-2xl">
          <Brain className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Score Calculation</span>
        </div>
        <div className="p-4 space-y-2 text-xs bg-white">
          {criteria.map((c) => {
            const contribution = max * c.weight * (c.pct / 100)
            return (
              <div key={c.label} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <span className="flex-1 text-gray-600">{c.label}</span>
                <MiniCircle pct={c.pct} size={22} stroke={3} color={c.color}>
                  <span style={{ fontSize: 6, fontWeight: 700, color: c.color }}></span>
                </MiniCircle>
                <span className="w-8 text-right font-mono font-semibold text-gray-700">{contribution.toFixed(1)}</span>
              </div>
            )
          })}
          <div className="border-t border-gray-100 pt-2 mt-1 flex justify-between font-bold text-gray-900 text-sm">
            <span>Total Awarded</span>
            <span style={{ color: sm(pct).hex }}>{obtained} / {max}</span>
          </div>
        </div>
      </div>

      {/* Student / Model side by side */}
      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
          <div>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 border-b border-gray-700 rounded-tl-2xl">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">Student Answer</span>
            </div>
            <div className="p-4 bg-white">
              {displayText?.trim() ? (
                <pre className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-sans max-h-52 overflow-y-auto">
                  {displayText.trim()}
                </pre>
              ) : question.studentAnswerImage ? (
                <div className="space-y-3">
                  <img
                    src={question.studentAnswerImage.startsWith('data:') ? question.studentAnswerImage : `data:image/jpeg;base64,${question.studentAnswerImage}`}
                    alt="Student handwritten answer"
                    className="w-full h-auto border border-gray-100 rounded-xl object-contain"
                  />
                  {!displayText && (
                    <div className="text-center">
                      <button
                        onClick={handleOCRExtraction}
                        disabled={isExtracting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {isExtracting ? 'Extracting text...' : 'Extract Text from Image'}
                      </button>
                      <p className="text-xs text-gray-500 mt-2">
                        Click to extract readable text from the handwritten answer
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm italic text-gray-400">No extracted text available.</p>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 rounded-tr-2xl">
              <BookOpen className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Model Answer</span>
            </div>
            <div className="p-4 bg-white">
              {question.modelAnswer?.trim() ? (
                <pre className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-sans max-h-52 overflow-y-auto">
                  {question.modelAnswer.trim()}
                </pre>
              ) : (
                <p className="text-sm italic text-gray-400">No model answer provided.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Reasoning */}
      {question.reasoning && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 rounded-t-2xl">
            <Eye className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">AI Reasoning</span>
          </div>
          <div className="p-4 bg-white">
            <p className="text-sm text-gray-600 leading-relaxed">{question.reasoning}</p>
          </div>
        </div>
      )}

      {/* Confidence circle */}
      <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
        <MiniCircle pct={conf} size={40} stroke={4} color={sm(conf).hex}>
          <span style={{ fontSize: 8, fontWeight: 800, color: sm(conf).hex }}>{conf}</span>
        </MiniCircle>
        <div>
          <p className="text-xs font-semibold text-gray-500">AI Confidence</p>
          <p className="text-[10px] text-gray-400">{conf}% certainty in this evaluation</p>
        </div>
      </div>
    </div>
  )
}

// ─── Feedback Block ───────────────────────────────────────────────────────────

function FeedbackBlock({ icon: Icon, label, content, variant }: {
  icon: React.ElementType; label: string; content: string
  variant: 'strength' | 'mistake' | 'missing' | 'suggestion'
}) {
  const VARIANTS = {
    strength:   { hex: '#10b981', bg: 'linear-gradient(135deg, #d1fae5, #ecfdf5)', border: '#a7f3d0', label: '#065f46', text: '#064e3b' },
    mistake:    { hex: '#ef4444', bg: 'linear-gradient(135deg, #fecaca, #fef2f2)', border: '#fca5a5', label: '#991b1b', text: '#7f1d1d' },
    missing:    { hex: '#f97316', bg: 'linear-gradient(135deg, #fed7aa, #fff7ed)', border: '#fdba74', label: '#9a3412', text: '#7c2d12' },
    suggestion: { hex: '#0ea5e9', bg: 'linear-gradient(135deg, #bae6fd, #f0f9ff)', border: '#7dd3fc', label: '#0c4a6e', text: '#0c4a6e' },
  }
  const s = VARIANTS[variant]
  return (
    <div
      className="rounded-2xl p-3.5 border"
      style={{ background: s.bg, borderColor: s.border }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color: s.hex }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: s.label }}>{label}</span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: s.text }}>{content}</p>
    </div>
  )
}

// ─── Performance Summary ──────────────────────────────────────────────────────

function PerformanceSummary({ questions }: { questions: QuestionResult[] }) {
  const buckets = useMemo(() => {
    const full    = questions.filter(q => (q.obtainedMarks ?? 0) === (q.maxMarks ?? 0) && (q.maxMarks ?? 0) > 0)
    const partial = questions.filter(q => { const r = (q.maxMarks ?? 0) > 0 ? (q.obtainedMarks ?? 0) / (q.maxMarks ?? 0) : 0; return r >= 0.5 && r < 1 })
    const low     = questions.filter(q => { const r = (q.maxMarks ?? 0) > 0 ? (q.obtainedMarks ?? 0) / (q.maxMarks ?? 0) : 0; return r > 0 && r < 0.5 })
    const zero    = questions.filter(q => (q.obtainedMarks ?? 0) === 0)
    return { full, partial, low, zero }
  }, [questions])

  const total = questions.length || 1
  const segments = [
    { key: 'full',    count: buckets.full.length,    label: 'Full Score',  color: '#10b981' },
    { key: 'partial', count: buckets.partial.length, label: 'Partial',     color: '#3b82f6' },
    { key: 'low',     count: buckets.low.length,     label: 'Low Score',   color: '#f59e0b' },
    { key: 'zero',    count: buckets.zero.length,    label: 'Zero Score',  color: '#ef4444' },
  ]

  return (
    <div className="space-y-6">
      {/* Radial Progress Rings */}
      <div className="flex justify-center">
        <div className="relative w-48 h-48">
          {/* Background rings */}
          <svg className="absolute inset-0 w-48 h-48" viewBox="0 0 192 192">
            {segments.map((s, index) => {
              const radius = 70 - (index * 12)
              const circumference = 2 * Math.PI * radius
              const progress = s.count / total
              
              return (
                <g key={s.key}>
                  {/* Background ring */}
                  <circle
                    cx="96"
                    cy="96"
                    r={radius}
                    fill="none"
                    stroke="#f3f4f6"
                    strokeWidth="6"
                  />
                  {/* Progress ring */}
                  <circle
                    cx="96"
                    cy="96"
                    r={radius}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - progress)}
                    strokeLinecap="round"
                    transform="rotate(-90 96 96)"
                    className="transition-all duration-1000 ease-out"
                  />
                </g>
              )
            })}
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-gray-800">{total}</div>
            <div className="text-sm text-gray-500">Questions</div>
          </div>
          
          {/* Legend dots around the circle */}
          <div className="absolute inset-0">
            {segments.map((s, index) => {
              const angle = (index * 90) - 90
              const radius = 85
              const x = 96 + radius * Math.cos(angle * Math.PI / 180)
              const y = 96 + radius * Math.sin(angle * Math.PI / 180)
              
              return (
                <div
                  key={s.key}
                  className="absolute w-4 h-4 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                  style={{ 
                    backgroundColor: s.color,
                    left: `${x}px`,
                    top: `${y}px`,
                    boxShadow: s.count > 0 ? `0 0 0 3px ${s.color}20` : 'none'
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
      
      {/* Clean stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {segments.map(s => (
          <div
            key={s.key}
            className="bg-white border border-gray-200 rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:border-gray-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: s.color }}
                >
                  {s.count}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.label}</p>
                  <p className="text-xs text-gray-500">{Math.round((s.count / total) * 100)}%</p>
                </div>
              </div>
              <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-700"
                  style={{ 
                    width: `${(s.count / total) * 100}%`, 
                    backgroundColor: s.color 
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Question Card (List) ─────────────────────────────────────────────────────

function QuestionCard({ question, index, isOpen, activeTab, onToggle, onTabChange, evaluationId }: {
  question: QuestionResult; index: number; isOpen: boolean
  activeTab: 'overview' | 'answers' | 'breakdown'
  onToggle: (n: number) => void
  onTabChange: (n: number, t: 'overview' | 'answers' | 'breakdown') => void
  evaluationId?: string
}) {
  const qNum     = question.questionNumber ?? question.number ?? index + 1
  const qText    = question.questionText ?? question.text ?? `Question ${qNum}`
  const obtained = question.obtainedMarks ?? 0
  const max      = question.maxMarks ?? 10
  const conf     = question.confidence ?? 0
  const pct      = max > 0 ? (obtained / max) * 100 : 0
  const meta     = sm(pct)
  const illegible = question.illegibleSections ?? (question.illegibleParts ? [question.illegibleParts] : [])
  const TrendIcon = pct >= 70 ? TrendingUp : pct >= 40 ? Minus : TrendingDown

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden transition-all duration-200"
      style={{
        borderColor: isOpen ? meta.hex + '40' : '#f1f5f9',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors"
        style={{ background: isOpen ? meta.gradientFrom + '20' : '#fff' }}
        onClick={() => onToggle(qNum)}
      >
        {/* Number circle */}
        <MiniCircle pct={pct} size={44} stroke={4} color={meta.hex}>
          <span style={{ fontSize: 12, fontWeight: 800, color: meta.hex }}>{qNum}</span>
        </MiniCircle>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate leading-snug">{qText}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs font-bold border px-2 py-0.5 rounded-full"
              style={{ color: meta.hex, borderColor: meta.hex + '40', background: meta.hex + '10' }}
            >
              {obtained}/{max}
            </span>
            <span className="text-[10px] text-gray-400">{conf}% confidence</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5">
            <TrendIcon className="w-3.5 h-3.5" style={{ color: meta.hex }} />
            <span className="text-sm font-bold font-mono" style={{ color: meta.hex }}>{fmt(pct)}%</span>
          </div>
          <button className="p-1 text-gray-400 hover:text-gray-700 transition-colors rounded-full hover:bg-gray-100">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Tabs + Content */}
      {isOpen && (
        <div className="border-t" style={{ borderColor: meta.hex + '20' }}>
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 bg-gray-50/60">
            {(['overview', 'answers', 'breakdown'] as const).map(t => (
              <button
                key={t}
                onClick={() => onTabChange(qNum, t)}
                className="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all"
                style={{
                  color: activeTab === t ? meta.hex : '#9ca3af',
                  borderBottom: activeTab === t ? `2px solid ${meta.hex}` : '2px solid transparent',
                  background: activeTab === t ? '#fff' : 'transparent',
                }}
              >
                {t === 'overview' ? 'Overview' : t === 'answers' ? 'Answers' : 'Breakdown'}
              </button>
            ))}
          </div>

          {/* Tab: Overview */}
          {activeTab === 'overview' && (
            <div className="p-4 space-y-3 bg-white">
              {illegible.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-2xl p-3 border border-amber-200"
                  style={{ background: 'linear-gradient(135deg, #fde68a20, #fffbeb)' }}>
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-0.5">Illegible Sections</p>
                    <p className="text-sm text-amber-800">{illegible.join(', ')}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {question.strength && <FeedbackBlock icon={CheckCircle2} label="Strengths" content={question.strength} variant="strength" />}
                {question.mistakes && <FeedbackBlock icon={XCircle} label="Mistakes" content={question.mistakes} variant="mistake" />}
                {question.missingConcepts && <FeedbackBlock icon={AlertCircle} label="Missing Concepts" content={question.missingConcepts} variant="missing" />}
                {(question.suggestions ?? question.feedback) && (
                  <FeedbackBlock icon={Lightbulb} label="Suggestions" content={question.suggestions ?? question.feedback ?? ''} variant="suggestion" />
                )}
              </div>
              {/* Confidence */}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <MiniCircle pct={conf} size={40} stroke={4} color={sm(conf).hex}>
                  <span style={{ fontSize: 8, fontWeight: 800, color: sm(conf).hex }}>{conf}</span>
                </MiniCircle>
                <div>
                  <p className="text-xs font-semibold text-gray-500">AI Confidence</p>
                  <p className="text-[10px] text-gray-400">{conf}% certainty</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Answers */}
          {activeTab === 'answers' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 bg-white">
              {[
                { icon: User, label: 'Student Answer', note: 'OCR extracted', content: question.studentAnswer, image: question.studentAnswerImage },
                { icon: BookOpen, label: 'Model Answer', note: 'Expected', content: question.modelAnswer, image: null },
              ].map((side, si) => {
                const Icon = side.icon
                return (
                  <div key={si} className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-100 border border-gray-200">
                        <Icon className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{side.label}</span>
                      <span className="ml-auto text-[10px] text-gray-400">{side.note}</span>
                    </div>
                    {side.image ? (
                      <img
                        src={(side.image as string).startsWith('data:') ? side.image as string : `data:image/jpeg;base64,${side.image}`}
                        alt="Student answer"
                        className="w-full h-auto rounded-xl border border-gray-100 object-contain"
                      />
                    ) : side.content?.trim() ? (
                      <pre className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-sans max-h-60 overflow-y-auto rounded-xl border border-gray-100 p-3 bg-gray-50">
                        {side.content.trim()}
                      </pre>
                    ) : (
                      <p className="text-sm italic text-gray-400">Not available.</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Tab: Breakdown */}
          {activeTab === 'breakdown' && (
            <div className="p-4 bg-white">
              <CriteriaCircles question={question} evaluationId={evaluationId} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Question Card (Grid / Compact) ──────────────────────────────────────────

function QuestionCardCompact({ question, index, isOpen, activeTab, onToggle, onTabChange, evaluationId }: {
  question: QuestionResult; index: number; isOpen: boolean
  activeTab: 'overview' | 'answers' | 'breakdown'
  onToggle: (n: number) => void
  onTabChange: (n: number, t: 'overview' | 'answers' | 'breakdown') => void
  evaluationId?: string
}) {
  const qNum     = question.questionNumber ?? question.number ?? index + 1
  const qText    = question.questionText ?? question.text ?? `Question ${qNum}`
  const obtained = question.obtainedMarks ?? 0
  const max      = question.maxMarks ?? 10
  const conf     = question.confidence ?? 0
  const pct      = max > 0 ? (obtained / max) * 100 : 0
  const meta     = sm(pct)

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        borderColor: isOpen ? meta.hex + '50' : '#f1f5f9',
      }}
      onClick={() => onToggle(qNum)}
    >
      {/* Top gradient strip */}
      <div className="h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${meta.hex}, ${meta.hex}80)` }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <MiniCircle pct={pct} size={34} stroke={3} color={meta.hex}>
              <span style={{ fontSize: 9, fontWeight: 800, color: meta.hex }}>{qNum}</span>
            </MiniCircle>
            <p className="text-xs font-semibold text-gray-700 line-clamp-2 leading-snug">{qText}</p>
          </div>
          <span
            className="text-xs font-bold border px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ color: meta.hex, borderColor: meta.hex + '40', background: meta.hex + '12' }}
          >
            {obtained}/{max}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="font-bold font-mono" style={{ color: meta.hex }}>{fmt(pct)}%</span>
          <span className="text-gray-400">{conf}% conf</span>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-gray-100" onClick={e => e.stopPropagation()}>
          <div className="flex bg-gray-50/60 border-b border-gray-100">
            {(['overview', 'answers', 'breakdown'] as const).map(t => (
              <button
                key={t}
                onClick={() => onTabChange(qNum, t)}
                className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all"
                style={{
                  color: activeTab === t ? meta.hex : '#9ca3af',
                  borderBottom: activeTab === t ? `2px solid ${meta.hex}` : '2px solid transparent',
                  background: activeTab === t ? '#fff' : 'transparent',
                }}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="p-3 space-y-2 text-xs bg-white">
            {activeTab === 'overview' && (
              <>
                {question.strength && (
                  <div className="rounded-xl p-2.5 border border-emerald-100"
                    style={{ background: 'linear-gradient(135deg, #d1fae530, #ecfdf5)' }}>
                    <p className="font-bold text-emerald-700 mb-0.5 text-[10px] uppercase tracking-widest">Strengths</p>
                    <p className="text-emerald-800 text-xs">{question.strength}</p>
                  </div>
                )}
                {question.mistakes && (
                  <div className="rounded-xl p-2.5 border border-red-100"
                    style={{ background: 'linear-gradient(135deg, #fecaca30, #fef2f2)' }}>
                    <p className="font-bold text-red-700 mb-0.5 text-[10px] uppercase tracking-widest">Mistakes</p>
                    <p className="text-red-800 text-xs">{question.mistakes}</p>
                  </div>
                )}
                {(question.suggestions ?? question.feedback) && (
                  <div className="rounded-xl p-2.5 border border-sky-100"
                    style={{ background: 'linear-gradient(135deg, #bae6fd30, #f0f9ff)' }}>
                    <p className="font-bold text-sky-700 mb-0.5 text-[10px] uppercase tracking-widest">Suggestion</p>
                    <p className="text-sky-800 text-xs">{question.suggestions ?? question.feedback}</p>
                  </div>
                )}
              </>
            )}
            {activeTab === 'answers' && (
              <>
                <div className="rounded-xl p-2.5 border border-gray-100 bg-gray-50">
                  <p className="font-bold text-gray-500 mb-1 text-[10px] uppercase tracking-widest">Student</p>
                  <p className="text-gray-700 line-clamp-5 whitespace-pre-wrap text-xs">
                    {question.studentAnswer?.trim() || 'Not available'}
                  </p>
                </div>
                <div className="rounded-xl p-2.5 border border-gray-100 bg-gray-50">
                  <p className="font-bold text-gray-500 mb-1 text-[10px] uppercase tracking-widest">Model</p>
                  <p className="text-gray-700 line-clamp-5 whitespace-pre-wrap text-xs">
                    {question.modelAnswer?.trim() || 'Not provided'}
                  </p>
                </div>
              </>
            )}
            {activeTab === 'breakdown' && (
              <div className="flex flex-wrap gap-2 justify-center py-2">
                {[
                  { label: 'Concept', pct: Math.round(question.mistakes ? Math.max(10, (question.obtainedMarks ?? 0) / (question.maxMarks ?? 10) * 100 - 18) : (question.obtainedMarks ?? 0) / (question.maxMarks ?? 10) * 100), color: '#6366f1' },
                  { label: 'Complete', pct: Math.round(Math.min(100, (question.obtainedMarks ?? 0) / (question.maxMarks ?? 10) * 100 + 5)), color: '#10b981' },
                  { label: 'Clarity', pct: Math.round((question.confidence ?? 70) > 80 ? Math.min(100, (question.obtainedMarks ?? 0) / (question.maxMarks ?? 10) * 100 + 8) : (question.obtainedMarks ?? 0) / (question.maxMarks ?? 10) * 100), color: '#0ea5e9' },
                ].map(c => (
                  <div key={c.label} className="flex flex-col items-center gap-1">
                    <MiniCircle pct={c.pct} size={44} stroke={4} color={c.color}>
                      <span style={{ fontSize: 8, fontWeight: 800, color: c.color }}>{c.pct}%</span>
                    </MiniCircle>
                    <span className="text-[9px] text-gray-500 font-semibold">{c.label}</span>
                  </div>
                ))}
                {question.reasoning && (
                  <div className="w-full rounded-xl p-2.5 border border-gray-100 bg-gray-50 mt-1">
                    <p className="font-bold text-gray-500 mb-0.5 text-[10px] uppercase tracking-widest">Reasoning</p>
                    <p className="text-gray-600 line-clamp-4 text-xs">{question.reasoning}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stat Cell ────────────────────────────────────────────────────────────────

function StatCell({ icon: Icon, value, label, color = '#6366f1' }: {
  icon: React.ElementType; value: string | number; label: string; color?: string
}) {
  return (
    <div
      className="flex items-center gap-2.5 p-3 rounded-2xl border border-gray-100 bg-white transition-all"
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: color + '15', border: `1.5px solid ${color}30` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-base font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ResultsPage({ result, onReEvaluate, onEvaluateAnother, onDownloadReport }: ResultsPageProps) {
  const [expandedQs, setExpandedQs] = useState<Set<number>>(new Set([1]))
  const [activeTab, setActiveTab]   = useState<Record<number, 'overview' | 'answers' | 'breakdown'>>({})
  const [viewMode, setViewMode]     = useState<'list' | 'grid'>('list')
  const [sortMode, setSortMode]     = useState<'default' | 'highest' | 'lowest'>('default')
  const [filterMode, setFilterMode] = useState<'all' | 'pass' | 'fail'>('all')

  const toggleQ  = (n: number) => setExpandedQs(p => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s })
  const setTab   = (n: number, t: 'overview' | 'answers' | 'breakdown') => setActiveTab(p => ({ ...p, [n]: t }))

  const allQuestions = result.questions ?? result.questionResults ?? []
  
  // Debug: Log question data
  console.log('ResultsPage - allQuestions:', allQuestions)
  console.log('ResultsPage - result structure:', result)
  if (allQuestions.length > 0) {
    console.log('ResultsPage - first question:', allQuestions[0])
  }

  const questions = useMemo(() => {
    let qs = [...allQuestions]
    if (filterMode === 'pass') qs = qs.filter(q => ((q.obtainedMarks ?? 0) / (q.maxMarks ?? 1)) >= 0.5)
    if (filterMode === 'fail') qs = qs.filter(q => ((q.obtainedMarks ?? 0) / (q.maxMarks ?? 1)) < 0.5)
    if (sortMode === 'highest') qs.sort((a, b) => (b.obtainedMarks ?? 0) / (b.maxMarks ?? 1) - (a.obtainedMarks ?? 0) / (a.maxMarks ?? 1))
    if (sortMode === 'lowest')  qs.sort((a, b) => (a.obtainedMarks ?? 0) / (a.maxMarks ?? 1) - (b.obtainedMarks ?? 0) / (b.maxMarks ?? 1))
    return qs
  }, [allQuestions, filterMode, sortMode])

  const qNums      = questions.map((q, i) => q.questionNumber ?? q.number ?? i + 1)
  const allExpanded = qNums.length > 0 && qNums.every(n => expandedQs.has(n))
  const pct        = Math.max(0, Math.min(100, Number(result.percentage) || 0))
  const meta       = sm(pct)
  const attempted  = allQuestions.filter(q => (q.obtainedMarks ?? 0) > 0).length
  const fullMarks  = allQuestions.filter(q => (q.obtainedMarks ?? 0) === (q.maxMarks ?? 0) && (q.maxMarks ?? 0) > 0).length
  const avgConf    = allQuestions.length
    ? Math.round(allQuestions.reduce((s, q) => s + (q.confidence ?? 0), 0) / allQuestions.length)
    : 0

  return (
    <div className="space-y-5 max-w-6xl mx-auto">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <nav className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-1.5">
            <span>Exams</span>
            <span className="text-gray-200">›</span>
            <span>Evaluate</span>
            <span className="text-gray-200">›</span>
            <span className="text-gray-600">Results</span>
          </nav>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Evaluation Results</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {result.examTitle ?? 'Exam'}
            {result.studentName && ` · ${result.studentName}`}
            {result.rollNumber && ` · ${result.rollNumber}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onDownloadReport} size="sm"
            className="h-8 text-xs px-4 gap-1.5 rounded-full font-semibold"
            style={{ background: 'linear-gradient(135deg, #1e293b, #334155)' }}
          >
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
          <Button
            onClick={onReEvaluate} variant="outline" size="sm"
            className="h-8 text-xs px-4 gap-1.5 rounded-full border-gray-200 font-semibold hover:border-gray-400"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-evaluate
          </Button>
          <Button
            onClick={onEvaluateAnother} variant="ghost" size="sm"
            className="h-8 text-xs px-4 gap-1.5 rounded-full font-semibold"
          >
            <Users className="w-3.5 h-3.5" /> Another Student
          </Button>
        </div>
      </div>

      {/* ── Scorecard ────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl border overflow-hidden bg-white"
        style={{ borderColor: meta.hex + '30' }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: meta.hex + '20', background: meta.gradient + '50' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: meta.hex + '18' }}>
              <FileText className="w-4 h-4" style={{ color: meta.hex }} />
            </div>
            <span className="text-sm font-semibold text-gray-700">{result.examTitle ?? 'Untitled Exam'}</span>
            {result.subject && (
              <span
                className="text-xs border px-2.5 py-0.5 rounded-full font-semibold"
                style={{ color: meta.hex, borderColor: meta.hex + '40', background: meta.hex + '10' }}
              >
                {result.subject}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            {result.date ?? new Date().toLocaleDateString('en-IN')}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">
          {/* Arc display */}
          <div
            className="flex items-center justify-center p-8 border-b lg:border-b-0 lg:border-r"
            style={{ borderColor: meta.hex + '15' }}
          >
            <ScoreArcDisplay
              percentage={pct}
              totalMarks={result.totalMarks}
              maxMarks={result.maxMarks}
              grade={result.grade}
            />
          </div>

          {/* Stats */}
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCell icon={BarChart3}    value={result.questionCount ?? allQuestions.length} label="Questions"    color="#6366f1" />
              <StatCell icon={CheckCircle2} value={attempted}    label="Attempted"    color="#10b981" />
              <StatCell icon={Award}        value={fullMarks}    label="Full Marks"   color="#f59e0b" />
              <StatCell icon={Activity}     value={`${avgConf}%`} label="AI Confidence" color="#0ea5e9" />
            </div>

            {/* Overall Score - Modern Card Design */}
            <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">Overall Score</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.hex }} />
                  <span className="text-lg font-bold" style={{ color: meta.hex }}>{fmt(pct)}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-center">
                {/* Circular Progress */}
                <div className="relative">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      className="stroke-gray-100"
                      strokeWidth="6"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke={meta.hex}
                      strokeWidth="6"
                      strokeDasharray={2 * Math.PI * 36}
                      strokeDashoffset={2 * Math.PI * 36 * (1 - pct / 100)}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color: meta.hex }}>{Math.round(pct)}%</span>
                    <span className="text-xs text-gray-500">{result.totalMarks}/{result.maxMarks}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Overall Feedback ─────────────────────────────────────────── */}
      {result.overallFeedback && (
        <div
          className="rounded-3xl border overflow-hidden bg-white"
          style={{ borderColor: '#f1f5f9' }}
        >
          <div
            className="flex items-center gap-2 px-5 py-3 border-b"
            style={{ borderColor: '#f1f5f9', background: 'linear-gradient(135deg, #f8faff, #fafafa)' }}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100">
              <Brain className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">AI Overall Feedback</span>
          </div>
          <div className="p-5">
            <div className="max-h-60 overflow-y-auto scrollbar-hide text-sm text-gray-700 leading-relaxed columns-1 md:columns-2 gap-8 space-y-1.5">
              {result.overallFeedback.split('\n').map((line, i) => {
                if (!line.trim()) return null
                const isBullet = line.startsWith('• ') || line.startsWith('- ')
                const isBold   = line.startsWith('**') && line.endsWith('**')
                if (isBold) return (
                  <p key={i} className="font-bold text-gray-900 text-sm mt-3 first:mt-0 break-inside-avoid">
                    {line.replace(/\*\*/g, '')}
                  </p>
                )
                if (isBullet) return (
                  <div key={i} className="flex items-start gap-2 break-inside-avoid">
                    <span className="text-indigo-300 mt-1 flex-shrink-0">◆</span>
                    <span>{line.slice(2)}</span>
                  </div>
                )
                return <p key={i} className="break-inside-avoid">{line}</p>
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Question Toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-bold text-gray-900">Question Analysis</h2>
          <span className="text-xs text-gray-400">({questions.length} questions)</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Filter pills */}
          {(['all', 'pass', 'fail'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterMode(f)}
              className="px-3 h-7 text-xs rounded-full border font-semibold transition-all"
              style={{
                borderColor: filterMode === f ? '#1e293b' : '#e2e8f0',
                background: filterMode === f ? '#1e293b' : '#fff',
                color: filterMode === f ? '#fff' : '#64748b',
              }}
            >
              {f === 'all' ? 'All' : f === 'pass' ? 'Pass' : 'Fail'}
            </button>
          ))}

          <div className="w-px h-5 bg-gray-200" />

          {/* Sort */}
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as typeof sortMode)}
            className="h-7 border border-gray-200 px-2 text-xs text-gray-600 rounded-full focus:outline-none bg-white"
          >
            <option value="default">Default order</option>
            <option value="highest">Highest first</option>
            <option value="lowest">Lowest first</option>
          </select>

          <div className="w-px h-5 bg-gray-200" />

          {/* View mode */}
          {([
            { mode: 'list', Icon: List },
            { mode: 'grid', Icon: Grid3X3 },
          ] as const).map(({ mode, Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="w-7 h-7 flex items-center justify-center rounded-full border transition-all"
              style={{
                borderColor: viewMode === mode ? '#1e293b' : '#e2e8f0',
                background: viewMode === mode ? '#1e293b' : '#fff',
                color: viewMode === mode ? '#fff' : '#94a3b8',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}

          {/* Expand / collapse all */}
          <button
            title={allExpanded ? 'Collapse all' : 'Expand all'}
            onClick={() => allExpanded ? setExpandedQs(new Set()) : setExpandedQs(new Set(qNums))}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-all"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Question List ─────────────────────────────────────────────── */}
      {viewMode === 'list' ? (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.questionNumber ?? i}
              question={q}
              index={i}
              isOpen={expandedQs.has(q.questionNumber ?? q.number ?? i + 1)}
              activeTab={activeTab[q.questionNumber ?? q.number ?? i + 1] ?? 'overview'}
              onToggle={toggleQ}
              onTabChange={setTab}
              evaluationId={result.id}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {questions.map((q, i) => (
            <QuestionCardCompact
              key={q.questionNumber ?? i}
              question={q}
              index={i}
              isOpen={expandedQs.has(q.questionNumber ?? q.number ?? i + 1)}
              activeTab={activeTab[q.questionNumber ?? q.number ?? i + 1] ?? 'overview'}
              onToggle={toggleQ}
              onTabChange={setTab}
              evaluationId={result.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}