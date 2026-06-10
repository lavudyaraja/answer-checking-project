'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatsDialog } from './stats-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  FileText,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Edit3,
  Search,
  Filter,
  RefreshCw,
  Activity,
  MessageSquare,
  ChevronRight,
  BarChart3,
  TrendingUp,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  Layers,
  Award,
  Percent,
  Calendar
} from 'lucide-react'
import { ReviewUI } from './review-ui'

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

interface ReviewPageProps {
  evaluationResults?: EvaluationResult[]
  onRefreshResults?: () => void
  isLoading?: boolean
}

type SortField = 'studentName' | 'percentage' | 'aiConfidence' | 'evaluationDate'
type SortDirection = 'asc' | 'desc'

const STATUS_CONFIG = {
  approved: {
    label: 'Approved',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    icon: XCircle,
  },
  needs_revision: {
    label: 'Needs Revision',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    icon: Edit3,
  },
  pending_review: {
    label: 'Pending',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
    icon: Clock,
  },
}

function ConfidenceRing({ value }: { value: number }) {
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#f43f5e'
  const textColor = value >= 80 ? 'text-emerald-600' : value >= 60 ? 'text-amber-600' : 'text-rose-600'
  const circumference = 2 * Math.PI * 16
  const offset = circumference - (value / 100) * circumference
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-9 h-9 flex-shrink-0">
        <svg className="w-9 h-9 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="#f3f4f6" strokeWidth="3" />
          <circle
            cx="20" cy="20" r="16" fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-bold ${textColor}`}>{value.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  )
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    'A+': 'bg-emerald-100 text-emerald-800',
    'A': 'bg-green-100 text-green-800',
    'B+': 'bg-teal-100 text-teal-800',
    'B': 'bg-cyan-100 text-cyan-800',
    'C+': 'bg-sky-100 text-sky-800',
    'C': 'bg-blue-100 text-blue-800',
    'D': 'bg-amber-100 text-amber-800',
    'F': 'bg-rose-100 text-rose-800',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${colors[grade] || 'bg-gray-100 text-gray-800'}`}>
      {grade}
    </span>
  )
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border ${color}`}>
      <div className="p-2 rounded-lg bg-white/60">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
        <p className="text-xs font-medium opacity-75">{label}</p>
      </div>
    </div>
  )
}

export function ReviewPage({
  evaluationResults = [],
  onRefreshResults,
  isLoading = false
}: ReviewPageProps) {
  const { toast } = useToast()
  const [selectedResult, setSelectedResult] = useState<EvaluationResult | null>(null)
  const [showReviewUI, setShowReviewUI] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('evaluationDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [questionData, setQuestionData] = useState<any[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [localResults, setLocalResults] = useState<EvaluationResult[]>(evaluationResults)

  useEffect(() => {
    setLocalResults(evaluationResults)
  }, [evaluationResults])

  const summaryStats = useMemo(() => ({
    total: localResults.length,
    pending: localResults.filter(r => r.status === 'pending_review').length,
    approved: localResults.filter(r => r.status === 'approved').length,
    rejected: localResults.filter(r => r.status === 'rejected').length,
    revision: localResults.filter(r => r.status === 'needs_revision').length,
  }), [localResults])

  const updateEvaluationStatus = async (evaluationId: string, newStatus: string, comments?: string) => {
    try {
      const response = await fetch(`/api/evaluate/evaluations/${evaluationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, comments: comments || '' })
      })
      if (!response.ok) throw new Error('Failed to update evaluation status')

      setLocalResults(prev =>
        prev.map(e =>
          e.id === evaluationId
            ? { ...e, status: newStatus as any, reviewDate: new Date().toISOString(), reviewerName: 'Current Reviewer' }
            : e
        )
      )
      toast({ title: 'Status Updated', description: `Evaluation marked as ${newStatus.replace(/_/g, ' ')}` })
      if (onRefreshResults) await onRefreshResults()
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
    }
  }

  useEffect(() => {
    if (!selectedResult) { setQuestionData([]); return }
    setIsLoadingQuestions(true)
    fetch(`/api/evaluate/evaluations/${selectedResult.id}/questions`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setQuestionData(d.questions || []))
      .catch(() => {
        toast({ title: 'Error', description: 'Failed to load questions', variant: 'destructive' })
        setQuestionData([])
      })
      .finally(() => setIsLoadingQuestions(false))
  }, [selectedResult])

  const filteredAndSorted = useMemo(() => {
    let results = localResults.filter(r => {
      const term = searchTerm.toLowerCase()
      const matchesSearch = !term ||
        r.studentName.toLowerCase().includes(term) ||
        r.rollNumber.toLowerCase().includes(term) ||
        r.examTitle.toLowerCase().includes(term) ||
        r.subject.toLowerCase().includes(term)
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter
      return matchesSearch && matchesStatus
    })

    results = [...results].sort((a, b) => {
      let aVal: any, bVal: any
      switch (sortField) {
        case 'studentName': aVal = a.studentName; bVal = b.studentName; break
        case 'percentage': aVal = a.percentage; bVal = b.percentage; break
        case 'aiConfidence': aVal = a.aiConfidence; bVal = b.aiConfidence; break
        case 'evaluationDate': aVal = new Date(a.evaluationDate).getTime(); bVal = new Date(b.evaluationDate).getTime(); break
      }
      if (typeof aVal === 'string') return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })
    return results
  }, [localResults, searchTerm, statusFilter, sortField, sortDirection])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('desc') }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      if (onRefreshResults) await onRefreshResults()
      toast({ title: 'Refreshed', description: 'Results updated successfully.' })
    } catch {
      toast({ title: 'Refresh Failed', variant: 'destructive', description: 'Please try again.' })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleReviewClick = (result: EvaluationResult) => {
    setSelectedResult(result)
    setShowReviewUI(true)
  }

  const handleBackToList = () => {
    setShowReviewUI(false)
    setSelectedResult(null)
  }

  if (showReviewUI && selectedResult) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="mb-5">
          <button
            onClick={handleBackToList}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Review Queue
          </button>
        </div>
        <ReviewUI
          evaluationResult={selectedResult}
          onBack={handleBackToList}
          questionData={questionData}
          isLoadingQuestions={isLoadingQuestions}
          onUpdateStatus={updateEvaluationStatus}
        />
      </div>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and approve AI-evaluated exam submissions</p>
        </div>
        <div className="flex items-center gap-2">
          <StatsDialog
            title="Statistics Overview"
            description="Comprehensive overview of evaluation statuses and AI confidence."
            evaluationResults={localResults}
          >
            <Button variant="outline" size="sm" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Stats
            </Button>
          </StatsDialog>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total" value={summaryStats.total} icon={Layers} color="border-gray-200 text-gray-700" />
        <SummaryCard label="Pending" value={summaryStats.pending} icon={Clock} color="border-sky-200 text-sky-700 bg-sky-50" />
        <SummaryCard label="Approved" value={summaryStats.approved} icon={CheckCircle2} color="border-emerald-200 text-emerald-700 bg-emerald-50" />
        <SummaryCard label="Rejected" value={summaryStats.rejected} icon={XCircle} color="border-rose-200 text-rose-700 bg-rose-50" />
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by student, exam, or subject…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 bg-white border-gray-200 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3 py-1.5 text-sm border border-gray-200 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 justify-start">
                {statusFilter === 'all' ? 'All Status' : 
                 statusFilter === 'pending_review' ? 'Pending Review' :
                 statusFilter === 'approved' ? 'Approved' :
                 statusFilter === 'rejected' ? 'Rejected' :
                 statusFilter === 'needs_revision' ? 'Needs Revision' : statusFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                All Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('pending_review')}>
                Pending Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('approved')}>
                Approved
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('rejected')}>
                Rejected
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('needs_revision')}>
                Needs Revision
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3 py-1.5 text-sm border border-gray-200 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 justify-start">
                {sortField === 'evaluationDate' ? (sortDirection === 'desc' ? 'Newest First' : 'Oldest First') :
                 sortField === 'percentage' ? (sortDirection === 'desc' ? 'Score: High → Low' : 'Score: Low → High') :
                 sortField === 'aiConfidence' ? (sortDirection === 'desc' ? 'Confidence: High → Low' : 'Confidence: Low → High') :
                 sortField === 'studentName' ? 'Name: A → Z' : 'Sort'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setSortField('evaluationDate'); setSortDirection('desc'); }}>
                Newest First
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('evaluationDate'); setSortDirection('asc'); }}>
                Oldest First
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('percentage'); setSortDirection('desc'); }}>
                Score: High → Low
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('percentage'); setSortDirection('asc'); }}>
                Score: Low → High
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('aiConfidence'); setSortDirection('desc'); }}>
                Confidence: High → Low
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('aiConfidence'); setSortDirection('asc'); }}>
                Confidence: Low → High
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('studentName'); setSortDirection('asc'); }}>
                Name: A → Z
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400 -mt-2">
        Showing {filteredAndSorted.length} of {localResults.length} evaluations
      </p>

      {/* List */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <ScrollArea className="h-[calc(100vh-360px)] min-h-[400px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-gray-300" />
              <p className="text-sm text-gray-400">Loading evaluations…</p>
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-2">
              <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-2">
                <FileText className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-600">No evaluations found</p>
              <p className="text-xs text-gray-400">
                {searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'New evaluations will appear here'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredAndSorted.map(result => {
                const cfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.pending_review
                const StatusIcon = cfg.icon
                return (
                  <div
                    key={result.id}
                    onClick={() => handleReviewClick(result)}
                    className="group px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                  >
                    <div className="flex items-start gap-4">
                      {/* Status dot */}
                      <div className="mt-1.5 flex-shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 text-sm">{result.studentName}</span>
                              {result.rollNumber && (
                                <span className="text-xs text-gray-400 font-mono">{result.rollNumber}</span>
                              )}
                              <GradeBadge grade={result.grade} />
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {result.examTitle} • {result.subject}
                            </p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <Badge className={`${cfg.color} border text-xs font-medium gap-1 px-2 py-0.5`}>
                              <StatusIcon className="w-3 h-3" />
                              {cfg.label}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-2.5">
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Score</p>
                            <p className="text-sm font-bold text-gray-800 tabular-nums">
                              {result.obtainedMarks}
                              <span className="text-gray-400 font-normal">/{result.totalMarks}</span>
                              <span className="ml-1 text-xs font-medium text-gray-500">({result.percentage.toFixed(0)}%)</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">AI Confidence</p>
                            <ConfidenceRing value={result.aiConfidence} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Date</p>
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              {new Date(result.evaluationDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        {(result.hasAttachments || result.reviewerName) && (
                          <div className="flex items-center gap-3 mt-2">
                            {result.hasAttachments && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                📎 Attachments
                              </span>
                            )}
                            {result.reviewerName && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {result.reviewerName}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors mt-1 flex-shrink-0" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  )
}