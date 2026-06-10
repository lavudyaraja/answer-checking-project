'use client'

import { useState, useMemo } from 'react'
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
import { useToast } from '@/hooks/use-toast'
import {
  FileText, Clock, User, CheckCircle2, XCircle, AlertTriangle,
  Eye, Edit3, Search, Filter, RefreshCw, Activity, ChevronRight
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

interface ReviewSidebarProps {
  evaluationResults: EvaluationResult[]
  onSelectResult: (result: EvaluationResult) => void
  onRefreshResults: () => void
  isLoading?: boolean
}

const STATUS_CONFIG = {
  approved:       { label: 'Approved',       color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', icon: CheckCircle2 },
  rejected:       { label: 'Rejected',       color: 'bg-rose-50 text-rose-700 border-rose-200',           dot: 'bg-rose-400',    icon: XCircle       },
  needs_revision: { label: 'Revision',       color: 'bg-amber-50 text-amber-700 border-amber-200',        dot: 'bg-amber-400',   icon: Edit3         },
  pending_review: { label: 'Pending',        color: 'bg-sky-50 text-sky-700 border-sky-200',              dot: 'bg-sky-400',     icon: Clock         },
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-emerald-400' : value >= 60 ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-400">{value.toFixed(0)}%</span>
    </div>
  )
}

export function ReviewSidebar({ evaluationResults, onSelectResult, onRefreshResults, isLoading = false }: ReviewSidebarProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = useMemo(() => evaluationResults.filter(r => {
    const term = searchTerm.toLowerCase()
    const matchesSearch = !term ||
      r.studentName.toLowerCase().includes(term) ||
      r.rollNumber.toLowerCase().includes(term) ||
      r.examTitle.toLowerCase().includes(term)
    return matchesSearch && (statusFilter === 'all' || r.status === statusFilter)
  }), [evaluationResults, searchTerm, statusFilter])

  const pendingCount = evaluationResults.filter(r => r.status === 'pending_review').length

  return (
    <div className="w-full h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-bold text-gray-800">Review Queue</h2>
          {pendingCount > 0 && (
            <p className="text-xs text-sky-600 font-medium">{pendingCount} pending</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onRefreshResults} disabled={isLoading} className="h-7 w-7 p-0">
          <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input
          placeholder="Search…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-8 h-8 text-xs border-gray-200 bg-gray-50"
        />
      </div>

      {/* Status filter dropdown */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-gray-400" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 px-2.5 py-1 text-xs border border-gray-200 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 justify-start">
              {statusFilter === 'all' ? 'All Status' : 
               statusFilter === 'pending_review' ? 'Pending' :
               statusFilter === 'approved' ? 'Approved' :
               statusFilter === 'rejected' ? 'Rejected' :
               statusFilter === 'needs_revision' ? 'Revision' : statusFilter}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>
              All Status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('pending_review')}>
              Pending
              <span className="ml-auto text-xs text-gray-400">
                {evaluationResults.filter(r => r.status === 'pending_review').length}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('approved')}>
              Approved
              <span className="ml-auto text-xs text-gray-400">
                {evaluationResults.filter(r => r.status === 'approved').length}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('rejected')}>
              Rejected
              <span className="ml-auto text-xs text-gray-400">
                {evaluationResults.filter(r => r.status === 'rejected').length}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('needs_revision')}>
              Needs Revision
              <span className="ml-auto text-xs text-gray-400">
                {evaluationResults.filter(r => r.status === 'needs_revision').length}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Result count */}
      <p className="text-xs text-gray-400">Showing {filtered.length} of {evaluationResults.length}</p>

      {/* List */}
      <Card className="flex-1 border-gray-200 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-280px)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-300 mb-2" />
              <p className="text-xs text-gray-400">Loading…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <FileText className="w-7 h-7 text-gray-200 mb-2" />
              <p className="text-sm text-gray-500 font-medium">No results</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchTerm || statusFilter !== 'all' ? 'Adjust filters' : 'Evaluations appear here'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(result => {
                const cfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.pending_review
                const StatusIcon = cfg.icon
                return (
                  <div
                    key={result.id}
                    className="group px-3 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => onSelectResult(result)}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1 mb-0.5">
                          <p className="text-xs font-semibold text-gray-800 truncate">{result.studentName}</p>
                          <span className={`text-xs font-bold flex-shrink-0 px-1.5 py-0.5 rounded border ${cfg.color}`}>
                            {result.grade}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate mb-1.5">{result.examTitle}</p>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500 tabular-nums">
                            {result.obtainedMarks}/{result.totalMarks}
                            <span className="text-gray-400 ml-1">({result.percentage.toFixed(0)}%)</span>
                          </span>
                          <Badge className={`${cfg.color} text-xs px-1.5 py-0 border gap-1 h-4`}>
                            <StatusIcon className="w-2.5 h-2.5" />
                            {cfg.label}
                          </Badge>
                        </div>
                        <ConfidenceBar value={result.aiConfidence} />
                      </div>
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