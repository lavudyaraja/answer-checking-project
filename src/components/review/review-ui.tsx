'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit3,
  MessageSquare,
  Clock,
  User,
  FileText,
  RefreshCw,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
  BookOpen,
  Zap,
  TrendingUp,
  Award,
} from 'lucide-react'

interface EvaluationResult {
  id: string
  studentName: string
  rollNumber: string
  examTitle: string
  subject: string
  totalMarks: number
  obtainedMarks: number
  percentage: number
  grade: string
  evaluationDate: string
  status: 'pending_review' | 'approved' | 'rejected' | 'needs_revision'
  aiConfidence: number
  reviewerName?: string
  reviewDate?: string
  hasAttachments: boolean
}

interface ReviewUIProps {
  evaluationResult: EvaluationResult
  onBack: () => void
  questionData: any[]
  isLoadingQuestions: boolean
  onUpdateStatus: (id: string, status: string, comments?: string) => void
}

type TabKey = 'overview' | 'questions' | 'feedback'

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'A+': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'A':  { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200'   },
  'B+': { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200'    },
  'B':  { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200'    },
  'C+': { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200'     },
  'C':  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  'D':  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  'F':  { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200'    },
}

function ConfidenceRing({ value }: { value: number }) {
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#f43f5e'
  const circumference = 2 * Math.PI * 20
  const offset = circumference - (value / 100) * circumference
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="#f3f4f6" strokeWidth="4" />
        <circle
          cx="24" cy="24" r="20" fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-gray-700">{value.toFixed(0)}%</span>
      </div>
    </div>
  )
}

function ScoreBar({ obtained, max }: { obtained: number; max: number }) {
  const pct = max > 0 ? (obtained / max) * 100 : 0
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : pct >= 40 ? 'bg-orange-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
      <span className="text-xs tabular-nums text-gray-500 w-16 text-right">
        {obtained}/{max} <span className="text-gray-400">({pct.toFixed(0)}%)</span>
      </span>
    </div>
  )
}

function QuestionCard({ question, index }: { question: any; index: number }) {
  const [expanded, setExpanded] = useState(index === 0)
  const pct = question.maxMarks > 0 ? (question.awardedMarks / question.maxMarks) * 100 : 0
  const borderColor = 'border-l-gray-300'
  const confidenceColor = question.confidence >= 80 ? 'text-emerald-600 bg-emerald-50' : question.confidence >= 60 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50'

  return (
    <Card className={`border-l-4 ${borderColor} shadow-sm overflow-hidden`}>
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
            Q{question.questionNumber}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {question.awardedMarks}/{question.maxMarks} marks
            </p>
            <ScoreBar obtained={question.awardedMarks} max={question.maxMarks} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${confidenceColor}`}>
            {question.confidence.toFixed(0)}% confident
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
          {/* Side-by-side answers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Student Answer</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[80px] max-h-[200px] overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {question.studentAnswer || <span className="italic text-gray-400">No answer provided</span>}
                </p>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Model Answer</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 min-h-[80px] max-h-[200px] overflow-y-auto">
                <p className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed">
                  {question.modelAnswer || <span className="italic text-blue-400">No model answer</span>}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

export function ReviewUI({ evaluationResult, onBack, questionData, isLoadingQuestions, onUpdateStatus }: ReviewUIProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [reviewComments, setReviewComments] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const gradeColors = GRADE_COLORS[evaluationResult.grade] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }

  const avgConfidence = questionData.length > 0
    ? questionData.reduce((s, q) => s + q.confidence, 0) / questionData.length
    : evaluationResult.aiConfidence

  const handleAction = async (status: string, requiresComment = false) => {
    if (requiresComment && !reviewComments.trim()) {
      toast({ title: 'Comment Required', description: 'Please provide comments before proceeding.', variant: 'destructive' })
      setActiveTab('feedback')
      return
    }
    setIsSubmitting(true)
    try {
      await onUpdateStatus(evaluationResult.id, status, reviewComments)
      onBack()
    } finally {
      setIsSubmitting(false)
    }
  }

  const tabs = [
    { key: 'overview' as TabKey, label: 'Overview', icon: FileText },
    { key: 'questions' as TabKey, label: `Questions${questionData.length ? ` (${questionData.length})` : ''}`, icon: MessageSquare },
    { key: 'feedback' as TabKey, label: 'Feedback', icon: Edit3 },
  ]

  return (
    <div className="space-y-5">
      {/* Header card */}
      <Card className=" border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-white to-gray-50 px-6 py-5 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-bold text-gray-800 truncate">{evaluationResult.studentName}</h2>
                {evaluationResult.rollNumber && (
                  <span className="text-gray-600 text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{evaluationResult.rollNumber}</span>
                )}
              </div>
              <p className="text-gray-600 text-sm">{evaluationResult.examTitle} • {evaluationResult.subject}</p>
            </div>
            <div className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl border-2 ${gradeColors.bg} ${gradeColors.border}`}>
              <span className={`text-2xl font-black ${gradeColors.text}`}>{evaluationResult.grade}</span>
              <span className="text-xs text-gray-500 font-medium">Grade</span>
            </div>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
            {[
              { label: 'Score', value: `${evaluationResult.obtainedMarks}/${evaluationResult.totalMarks}`, sub: `${evaluationResult.percentage.toFixed(1)}%` },
              { label: 'Questions', value: isLoadingQuestions ? '…' : `${questionData.length}`, sub: 'total' },
              { label: 'Evaluated', value: new Date(evaluationResult.evaluationDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), sub: new Date(evaluationResult.evaluationDate).getFullYear().toString() },
              { label: 'Status', value: evaluationResult.status.replace(/_/g, ' '), sub: evaluationResult.reviewerName || 'Unreviewed', capitalize: true },
            ].map((item, i) => (
              <div key={i} className="px-5 py-3.5 text-center">
                <p className={`text-sm font-bold text-gray-800 ${item.capitalize ? 'capitalize' : ''}`}>{item.value}</p>
                <p className="text-xs text-gray-400">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Confidence summary row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <ConfidenceRing value={avgConfidence} />
            <div>
              <p className="text-xs text-gray-400">Avg Confidence</p>
              <p className="text-sm font-bold text-gray-800">
                {avgConfidence >= 80 ? 'High' : avgConfidence >= 60 ? 'Moderate' : 'Low'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">High Confidence</p>
              <p className="text-sm font-bold text-gray-800">{questionData.filter(q => q.confidence >= 80).length} questions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Need Review</p>
              <p className="text-sm font-bold text-gray-800">{questionData.filter(q => q.confidence < 60).length} questions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0 -mb-px">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.key
                    ? 'border-gray-800 text-gray-800'
                    : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Performance Breakdown</h4>
              {isLoadingQuestions ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : questionData.length === 0 ? (
                <p className="text-sm text-gray-400">No question data available.</p>
              ) : (
                <div className="space-y-2.5">
                  {questionData.map((q, i) => (
                    <div key={q.questionId || i} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-gray-400 w-5">Q{q.questionNumber}</span>
                      <div className="flex-1">
                        <ScoreBar obtained={q.awardedMarks} max={q.maxMarks} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">AI Assessment Summary</h4>
              <div className={`rounded-lg p-4 border ${
                avgConfidence >= 80 ? 'bg-emerald-50 border-emerald-200' :
                avgConfidence >= 60 ? 'bg-amber-50 border-amber-200' :
                'bg-rose-50 border-rose-200'
              }`}>
                <p className={`text-sm leading-relaxed ${
                  avgConfidence >= 80 ? 'text-emerald-700' :
                  avgConfidence >= 60 ? 'text-amber-700' : 'text-rose-700'
                }`}>
                  {avgConfidence >= 80
                    ? `✓ High confidence (${avgConfidence.toFixed(0)}%) — AI scoring is reliable across all questions. Safe to approve.`
                    : avgConfidence >= 60
                    ? `⚠ Moderate confidence (${avgConfidence.toFixed(0)}%) — Some questions may need manual verification.`
                    : `✗ Low confidence (${avgConfidence.toFixed(0)}%) — Significant manual review recommended before approval.`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Questions */}
      {activeTab === 'questions' && (
        <div className="space-y-3">
          {isLoadingQuestions ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-300" />
              <p className="text-sm text-gray-400">Loading questions…</p>
            </div>
          ) : questionData.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2">
              <FileText className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-400">No question data available</p>
            </div>
          ) : (
            questionData.map((q, i) => <QuestionCard key={q.questionId || i} question={q} index={i} />)
          )}
        </div>
      )}

      {/* Tab: Feedback */}
      {activeTab === 'feedback' && (
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Review Comments</label>
              <Textarea
                value={reviewComments}
                onChange={e => setReviewComments(e.target.value)}
                placeholder="Add your review comments here. Required for Reject and Request Revision actions."
                className="min-h-[130px] text-sm resize-none border-gray-200 focus:border-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1.5">Comments are required when rejecting or requesting revision.</p>
            </div>

            {/* Warnings */}
            {evaluationResult.aiConfidence < 60 && (
              <div className="flex items-start gap-2.5 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-orange-700">Low AI confidence detected — thorough manual review is recommended before approving.</p>
              </div>
            )}
            {questionData.filter(q => q.confidence < 60).length > 0 && (
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700">
                  {questionData.filter(q => q.confidence < 60).length} question(s) have low confidence scores. Review them in the Questions tab.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action bar */}
      <div className="sticky bottom-4">
        <Card className="border-gray-200 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-gray-400">
                {evaluationResult.studentName} • {evaluationResult.examTitle}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction('needs_revision', true)}
                  disabled={isSubmitting}
                  className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Request Revision
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction('rejected', true)}
                  disabled={isSubmitting}
                  className="gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAction('approved', false)}
                  disabled={isSubmitting}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Approve
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}