'use client'

import { useState } from 'react'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2, AlertCircle, Eye, ChevronDown, ChevronUp,
  BookOpen, User, Target, Lightbulb, XCircle,
  Brain, Activity, Award, BarChart3, Zap,
} from 'lucide-react'
import { ScoreArcDisplay } from './circular-progress-bar'
import type { EvaluationResult, QuestionEvaluation } from '@/types/evaluation'

export type { EvaluationResult }

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvaluationResultsProps {
  result: EvaluationResult
}

// ─── Score Helpers ────────────────────────────────────────────────────────────

type ScoreLevel = 'excellent' | 'good' | 'average' | 'below' | 'fail'

function scoreLevel(pct: number): ScoreLevel {
  if (pct >= 85) return 'excellent'
  if (pct >= 70) return 'good'
  if (pct >= 55) return 'average'
  if (pct >= 40) return 'below'
  return 'fail'
}

const SCORE_META: Record<ScoreLevel, {
  text: string; bar: string; badge: string; dot: string; hex: string
  gradient: string; gradientFrom: string; shadow: string
}> = {
  excellent: {
    text: 'text-emerald-700', bar: 'bg-emerald-500',
    badge: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500', hex: '#10b981',
    gradient: 'linear-gradient(135deg, #d1fae5, #ecfdf5)',
    gradientFrom: '#d1fae5',
    shadow: '0 4px 24px rgba(16,185,129,0.15)',
  },
  good: {
    text: 'text-sky-700', bar: 'bg-sky-500',
    badge: 'text-sky-700 bg-sky-50 border-sky-200',
    dot: 'bg-sky-500', hex: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #bae6fd, #f0f9ff)',
    gradientFrom: '#bae6fd',
    shadow: '0 4px 24px rgba(14,165,233,0.15)',
  },
  average: {
    text: 'text-amber-700', bar: 'bg-amber-500',
    badge: 'text-amber-700 bg-amber-50 border-amber-200',
    dot: 'bg-amber-500', hex: '#f59e0b',
    gradient: 'linear-gradient(135deg, #fde68a, #fffbeb)',
    gradientFrom: '#fde68a',
    shadow: '0 4px 24px rgba(245,158,11,0.15)',
  },
  below: {
    text: 'text-orange-700', bar: 'bg-orange-500',
    badge: 'text-orange-700 bg-orange-50 border-orange-200',
    dot: 'bg-orange-500', hex: '#f97316',
    gradient: 'linear-gradient(135deg, #fed7aa, #fff7ed)',
    gradientFrom: '#fed7aa',
    shadow: '0 4px 24px rgba(249,115,22,0.15)',
  },
  fail: {
    text: 'text-red-700', bar: 'bg-red-500',
    badge: 'text-red-700 bg-red-50 border-red-200',
    dot: 'bg-red-500', hex: '#ef4444',
    gradient: 'linear-gradient(135deg, #fecaca, #fef2f2)',
    gradientFrom: '#fecaca',
    shadow: '0 4px 24px rgba(239,68,68,0.15)',
  },
}

function sm(pct: number) { return SCORE_META[scoreLevel(pct)] }
function fmt(n: number)  { return n.toFixed(1) }

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
          className="w-7 h-7 flex items-center justify-center text-[10px] font-bold rounded-full border-2 transition-all"
          style={
            i < obtained
              ? { backgroundColor: meta.hex, borderColor: meta.hex, color: '#fff', boxShadow: `0 2px 8px ${meta.hex}40` }
              : { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#cbd5e1' }
          }
        >
          {i + 1}
        </div>
      ))}
    </div>
  )
}

// ─── Grading Criteria Circles ─────────────────────────────────────────────────

function GradingCriteriaCircles({ result }: { result: QuestionEvaluation }) {
  const pct   = result.maxMarks > 0 ? (result.obtainedMarks / result.maxMarks) * 100 : 0
  const conf  = result.confidence ?? 70

  const conceptAcc  = Math.round(result.mistakes        ? Math.max(10, pct - 18) : pct)
  const completeness= Math.round(result.missingConcepts ? Math.max(10, pct - 12) : Math.min(100, pct + 5))
  const clarity     = Math.round(conf > 80              ? Math.min(100, pct + 8) : pct)
  const relevance   = Math.round(result.strength        ? Math.min(100, pct + 5) : pct)
  const structure   = Math.round(result.obtainedMarks > 0 ? Math.min(100, pct + 3) : 0)

  const criteria = [
    { label: 'Concept Accuracy',   weight: 0.35, pct: conceptAcc,   icon: Target,      color: '#6366f1' },
    { label: 'Completeness',       weight: 0.25, pct: completeness,  icon: CheckCircle2, color: '#10b981' },
    { label: 'Clarity & Language', weight: 0.20, pct: clarity,       icon: Eye,         color: '#0ea5e9' },
    { label: 'Relevance',          weight: 0.12, pct: relevance,     icon: Zap,         color: '#f59e0b' },
    { label: 'Structure',          weight: 0.08, pct: structure,     icon: Activity,    color: '#ec4899' },
  ]

  return (
    <div className="space-y-5">
      {/* Mark chips */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5" /> Marks Awarded — {result.obtainedMarks} of {result.maxMarks}
        </p>
        <MarkChips obtained={result.obtainedMarks} max={result.maxMarks} pct={pct} />
        <p className="text-xs text-gray-400 mt-1.5">
          {result.obtainedMarks === result.maxMarks
            ? '🎯 Perfect score'
            : result.obtainedMarks === 0
            ? 'No marks awarded'
            : `${result.maxMarks - result.obtainedMarks} mark${result.maxMarks - result.obtainedMarks !== 1 ? 's' : ''} deducted`}
        </p>
      </div>

      {/* Criteria circles */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" /> Criteria Breakdown
        </p>
        <div className="flex flex-wrap gap-3">
          {criteria.map((c) => {
            const Icon  = c.icon
            const contribution = result.maxMarks * c.weight * (c.pct / 100)
            return (
              <div
                key={c.label}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-gray-100 bg-white"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', minWidth: 84 }}
              >
                <MiniCircle pct={c.pct} size={60} stroke={5} color={c.color}>
                  <Icon style={{ width: 13, height: 13, color: c.color }} />
                </MiniCircle>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-gray-700 leading-tight">{c.label}</p>
                  <p style={{ color: c.color }} className="text-[10px] font-semibold">{c.pct}%</p>
                  <p className="text-[9px] text-gray-400">{Math.round(c.weight * 100)}% · {contribution.toFixed(1)}pt</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Score calculation table */}
      <div className="rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 rounded-t-2xl">
          <Brain className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Score Calculation</span>
        </div>
        <div className="p-4 space-y-2 bg-white">
          {criteria.map((c) => {
            const contribution = result.maxMarks * c.weight * (c.pct / 100)
            return (
              <div key={c.label} className="flex items-center gap-3 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <span className="flex-1 text-gray-600">
                  {c.label} <span className="text-gray-400">({Math.round(c.weight * 100)}%)</span>
                </span>
                <MiniCircle pct={c.pct} size={22} stroke={3} color={c.color}>
                  <span style={{ fontSize: 5, fontWeight: 800, color: c.color }}></span>
                </MiniCircle>
                <span className="w-8 text-right font-mono font-semibold text-gray-700">{contribution.toFixed(1)}</span>
              </div>
            )
          })}
          <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-bold text-gray-900">
            <span>Total Awarded</span>
            <span style={{ color: sm(pct).hex }}>{result.obtainedMarks} / {result.maxMarks}</span>
          </div>
        </div>
      </div>

      {/* AI Reasoning */}
      {result.reasoning && (
        <div className="rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 rounded-t-2xl">
            <Eye className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">AI Reasoning</span>
          </div>
          <div className="p-4 bg-white">
            <p className="text-sm text-gray-600 leading-relaxed">{result.reasoning}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Feedback Block ───────────────────────────────────────────────────────────

function FeedbackBlock({ icon: Icon, label, content, variant }: {
  icon: React.ElementType; label: string; content: string
  variant: 'strength' | 'mistake' | 'missing' | 'suggestion'
}) {
  const VARIANTS = {
    strength:   { hex: '#10b981', bg: 'linear-gradient(135deg, #d1fae530, #ecfdf5)', border: '#a7f3d0', label: '#065f46', text: '#064e3b' },
    mistake:    { hex: '#ef4444', bg: 'linear-gradient(135deg, #fecaca30, #fef2f2)', border: '#fca5a5', label: '#991b1b', text: '#7f1d1d' },
    missing:    { hex: '#f97316', bg: 'linear-gradient(135deg, #fed7aa30, #fff7ed)', border: '#fdba74', label: '#9a3412', text: '#7c2d12' },
    suggestion: { hex: '#0ea5e9', bg: 'linear-gradient(135deg, #bae6fd30, #f0f9ff)', border: '#7dd3fc', label: '#0c4a6e', text: '#0c4a6e' },
  }
  const s = VARIANTS[variant]
  return (
    <div
      className="rounded-2xl p-3.5 border"
      style={{ background: s.bg, borderColor: s.border, boxShadow: `0 2px 12px ${s.hex}15` }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color: s.hex }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: s.label }}>{label}</span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: s.text }}>{content}</p>
    </div>
  )
}

// ─── Per-Question Card ────────────────────────────────────────────────────────

function QuestionResultCard({ result }: { result: QuestionEvaluation }) {
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab]       = useState<'overview' | 'answers' | 'breakdown'>('overview')
  const pct  = result.maxMarks > 0 ? (result.obtainedMarks / result.maxMarks) * 100 : 0
  const conf = result.confidence ?? 0
  const meta = sm(pct)

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden transition-all duration-200"
      style={{
        borderColor: isOpen ? meta.hex + '40' : '#f1f5f9',
        boxShadow: isOpen ? meta.shadow : '0 2px 8px rgba(0,0,0,0.05)',
      }}
    >
      {/* Left accent + header */}
      <div className="flex">
        {/* Vertical color pill */}
        <div
          className="w-1 flex-shrink-0 rounded-l-2xl"
          style={{ background: `linear-gradient(180deg, ${meta.hex}, ${meta.hex}60)` }}
        />
        <div className="flex-1">
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors"
            style={{ background: isOpen ? meta.gradientFrom + '18' : '#fff' }}
            onClick={() => setIsOpen(p => !p)}
          >
            {/* Number circle */}
            <MiniCircle pct={pct} size={44} stroke={4} color={meta.hex}>
              <span style={{ fontSize: 12, fontWeight: 800, color: meta.hex }}>
                {result.questionNumber}
              </span>
            </MiniCircle>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700 leading-snug">Question {result.questionNumber}</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-xs font-bold border px-2 py-0.5 rounded-full"
                  style={{ color: meta.hex, borderColor: meta.hex + '40', background: meta.hex + '10' }}
                >
                  {result.obtainedMarks}/{result.maxMarks}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              <span className="text-sm font-bold font-mono" style={{ color: meta.hex }}>{fmt(pct)}%</span>
              <button className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Expanded */}
          {isOpen && (
            <div className="border-t" style={{ borderColor: meta.hex + '20' }}>
              {/* Tab bar */}
              <div className="flex bg-gray-50/60 border-b border-gray-100">
                {(['overview', 'answers', 'breakdown'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all"
                    style={{
                      color: tab === t ? meta.hex : '#9ca3af',
                      borderBottom: tab === t ? `2px solid ${meta.hex}` : '2px solid transparent',
                      background: tab === t ? '#fff' : 'transparent',
                    }}
                  >
                    {t === 'overview' ? 'Overview' : t === 'answers' ? 'Answers' : 'Breakdown'}
                  </button>
                ))}
              </div>

              {/* Overview */}
              {tab === 'overview' && (
                <div className="p-4 space-y-3 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.strength        && <FeedbackBlock icon={CheckCircle2} label="Strengths"        content={result.strength}        variant="strength" />}
                    {result.mistakes        && <FeedbackBlock icon={XCircle}      label="Mistakes"         content={result.mistakes}        variant="mistake" />}
                    {result.missingConcepts && <FeedbackBlock icon={AlertCircle}  label="Missing Concepts" content={result.missingConcepts} variant="missing" />}
                    {result.suggestions     && <FeedbackBlock icon={Lightbulb}    label="Suggestions"      content={result.suggestions}     variant="suggestion" />}
                  </div>
                  {/* Confidence circle */}
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <MiniCircle pct={conf} size={40} stroke={4} color={sm(conf).hex}>
                      <span style={{ fontSize: 8, fontWeight: 800, color: sm(conf).hex }}>{conf}</span>
                    </MiniCircle>
                    <div>
                      <p className="text-xs font-semibold text-gray-500">AI Confidence</p>
                      <p className="text-[10px] text-gray-400">{conf}% certainty in this evaluation</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Answers */}
              {tab === 'answers' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 bg-white">
                  {[
                    { 
                      icon: User, 
                      label: 'Student Answer', 
                      content: (result as any).studentAnswer,
                      image: (result as any).studentAnswerImage
                    },
                    { 
                      icon: BookOpen, 
                      label: 'Model Answer', 
                      content: (result as any).modelAnswer,
                      image: null
                    },
                  ].map((side, si) => {
                    const Icon = side.icon
                    return (
                      <div key={si} className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center border border-gray-200 bg-gray-50">
                            <Icon className="w-3.5 h-3.5 text-gray-500" />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{side.label}</span>
                        </div>
                        {side.image ? (
                          <img
                            src={side.image.startsWith('data:') ? side.image : `data:image/jpeg;base64,${side.image}`}
                            alt="Student handwritten answer"
                            className="w-full h-auto border border-gray-100 rounded-xl object-contain"
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

              {/* Breakdown */}
              {tab === 'breakdown' && (
                <div className="p-4 bg-white">
                  <GradingCriteriaCircles result={result} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Stat Cell ────────────────────────────────────────────────────────────────

function StatCell({ icon: Icon, value, label, color = '#6366f1' }: {
  icon: React.ElementType; value: string | number; label: string; color?: string
}) {
  return (
    <div
      className="flex items-center gap-2.5 p-3 rounded-2xl border border-gray-100 bg-white transition-all hover:shadow-md"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: color + '15', border: `1.5px solid ${color}25` }}
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

// ─── Skeleton Component ───────────────────────────────────────────────────────

export function EvaluationResultsSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header card skeleton */}
      <div className="bg-white rounded-3xl border overflow-hidden animate-pulse">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
          <div>
            <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
          <div className="text-right">
            <div className="h-6 bg-gray-200 rounded w-12 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-16 ml-auto"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* Arc skeleton */}
          <div className="flex items-center justify-center p-7">
            <div className="w-48 h-48 bg-gray-200 rounded-full"></div>
          </div>
          {/* Stats skeleton */}
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-gray-200 rounded-2xl"></div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-24"></div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-2 bg-gray-200 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Question cards skeleton */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="h-3 bg-gray-200 rounded w-20"></div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
              <div className="flex">
                <div className="w-1 bg-gray-200 rounded-l-2xl"></div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-11 h-11 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-4 bg-gray-200 rounded w-8"></div>
                      <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function EvaluationResults({ result }: EvaluationResultsProps) {
  const pct      = Math.max(0, Math.min(100, result.percentage))
  const meta     = SCORE_META[scoreLevel(pct)]
  const attempted = result.questionResults.filter(q => q.obtainedMarks > 0).length
  const fullMarks = result.questionResults.filter(q => q.obtainedMarks === q.maxMarks && q.maxMarks > 0).length
  const avgConf   = result.questionResults.length
    ? Math.round(result.questionResults.reduce((s, q) => s + (q.confidence ?? 0), 0) / result.questionResults.length)
    : 0

  return (
    <div className="space-y-5">

      {/* ── Header card ──────────────────────────────────────────────── */}
      <div
        className="bg-white rounded-3xl border overflow-hidden"
        style={{ borderColor: meta.hex + '30', boxShadow: meta.shadow }}
      >
        {/* Title strip */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: meta.hex + '20', background: meta.gradient + '60' }}
        >
          <div>
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">Evaluation Results</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">AI-powered semantic grading</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-mono" style={{ color: meta.hex }}>{result.totalMarks}</p>
            <p className="text-[10px] text-gray-400">of {result.maxMarks} marks</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* Arc */}
          <div className="flex items-center justify-center p-7">
            <ScoreArcDisplay
              percentage={pct}
              totalMarks={result.totalMarks}
              maxMarks={result.maxMarks}
              grade={result.grade}
            />
          </div>

          {/* Stats */}
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCell icon={BarChart3}    value={result.questionResults.length} label="Questions"    color="#6366f1" />
              <StatCell icon={CheckCircle2} value={attempted}                     label="Attempted"    color="#10b981" />
              <StatCell icon={Award}        value={fullMarks}                     label="Full Marks"   color="#f59e0b" />
              <StatCell icon={Activity}     value={`${avgConf}%`}                 label="AI Confidence" color="#0ea5e9" />
            </div>

            {/* Score display */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-gray-600">Overall Score</span>
                <span className="font-bold font-mono" style={{ color: meta.hex }}>{fmt(pct)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <MiniCircle pct={pct} size={48} stroke={5} color={meta.hex}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: meta.hex }}>{Math.round(pct)}%</span>
                </MiniCircle>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${meta.hex}, ${meta.hex}80)`,
                        boxShadow: `0 1px 6px ${meta.hex}60`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{result.totalMarks} of {result.maxMarks} marks secured</p>
                </div>
              </div>
            </div>

            {/* Feedback */}
            {result.overallFeedback && (
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100">
                    <Brain className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Overall Feedback</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-line">
                  {result.overallFeedback}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Question-wise ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-bold text-gray-900">Question-wise Analysis</h3>
          <span className="text-xs text-gray-400">({result.questionResults.length} questions)</span>
        </div>
        <div className="space-y-2">
          {result.questionResults.map(qr => (
            <QuestionResultCard key={qr.questionNumber} result={qr} />
          ))}
        </div>
      </div>
    </div>
  )
}