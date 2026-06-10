'use client'

import { useState, useMemo, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import {
  Search, Download, Trash2, ChevronDown, ChevronUp,
  ChevronRight, BarChart3, TrendingUp, TrendingDown,
  Award, Activity, BookOpen, FileDown, SlidersHorizontal,
  Users, CalendarDays, X, ArrowUpDown, ArrowUp, ArrowDown,
  CheckSquare, Square, Minus, Eye, RotateCcw, MoreVertical,
} from 'lucide-react'
import { StoredEvaluationResult, getEvaluationStats } from '@/lib/results-history'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResultsHistoryProps {
  historyData?: StoredEvaluationResult[]
  isLoading?: boolean
  onHistoryChange?: () => void
  onSelectResult: (result: StoredEvaluationResult) => void
  onDownloadReport: (result: StoredEvaluationResult) => void
}

type SortKey = 'evaluatedAt' | 'studentName' | 'examTitle' | 'percentage' | 'grade'
type SortDir = 'asc' | 'desc'
type GroupBy = 'none' | 'student' | 'exam' | 'grade'
type ViewMode = 'table' | 'cards'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeCategory(grade: string): 'A' | 'B' | 'C' | 'D' | 'F' {
  const ch = grade?.charAt(0)?.toUpperCase()
  return (['A', 'B', 'C', 'D', 'F'] as const).find(g => g === ch) ?? 'F'
}

const GRADE_META: Record<string, { label: string; dot: string; text: string; row: string; border: string }> = {
  A: { label: 'A', dot: 'bg-emerald-500', text: 'text-emerald-700', row: 'bg-emerald-50/40', border: 'border-emerald-200' },
  B: { label: 'B', dot: 'bg-sky-500',     text: 'text-sky-700',     row: 'bg-sky-50/40',     border: 'border-sky-200' },
  C: { label: 'C', dot: 'bg-amber-500',   text: 'text-amber-700',   row: 'bg-amber-50/40',   border: 'border-amber-200' },
  D: { label: 'D', dot: 'bg-orange-500',  text: 'text-orange-700',  row: 'bg-orange-50/40',  border: 'border-orange-200' },
  F: { label: 'F', dot: 'bg-red-500',     text: 'text-red-700',     row: 'bg-red-50/40',     border: 'border-red-200' },
}

function pctColor(pct: number) {
  if (pct >= 85) return 'text-emerald-700'
  if (pct >= 70) return 'text-sky-700'
  if (pct >= 55) return 'text-amber-700'
  if (pct >= 40) return 'text-orange-700'
  return 'text-red-700'
}

function fmt(n: number) { return n.toFixed(1) }
function fmtDate(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtTime(s: string) {
  const d = new Date(s)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function exportCSV(results: StoredEvaluationResult[]) {
  const headers = ['Student', 'Roll No', 'Exam', 'Subject', 'Marks', 'Max Marks', 'Percentage', 'Grade', 'Evaluated At']
  const rows = results.map(r => [
    r.studentName ?? '', r.rollNumber ?? '', r.examTitle ?? '', r.subject ?? '',
    r.totalMarks, r.maxMarks, fmt(r.percentage), r.grade,
    new Date(r.evaluatedAt).toLocaleString('en-IN'),
  ])
  const csv = [headers, ...rows].map(row =>
    row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n')
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `evaluations-${new Date().toISOString().slice(0, 10)}.csv`,
  })
  a.click()
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ pct }: { pct: number }) {
  const cat = gradeCategory(pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : pct >= 40 ? 'D' : 'F')
  return (
    <div className="w-full h-1 bg-gray-100 rounded-lg overflow-hidden">
      <div
        className={`h-full rounded-full ${GRADE_META[cat].dot}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

// ─── Mini Sparkline ────────────────────────────────────────────────────────── 

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 60, h = 20, pad = 2
  const pts = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / range) * (h - pad * 2),
  }))
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const trend = values[values.length - 1] - values[0]
  const stroke = trend > 2 ? '#10b981' : trend < -2 ? '#ef4444' : '#6b7280'
  return (
    <svg width={w} height={h} className="inline-block">
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2" fill={stroke} />
    </svg>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent }:
  { label: string; value: string | number; sub?: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="border border-gray-200 bg-white p-5 rounded-xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
          <p className={`text-2xl font-bold tracking-tight ${accent}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="p-2 bg-gray-50 border border-gray-100 rounded-lg">
          <Icon className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ResultsHistory({
  historyData = [],
  isLoading,
  onHistoryChange,
  onSelectResult,
  onDownloadReport,
}: ResultsHistoryProps) {
  // ── State ────────────────────────────────────────────────────────────────
  const [search, setSearch]           = useState('')
  const [groupBy, setGroupBy]         = useState<GroupBy>('none')
  const [viewMode, setViewMode]       = useState<ViewMode>('table')
  const [gradeFilter, setGradeFilter] = useState<string>('')
  const [sortKey, setSortKey]         = useState<SortKey>('evaluatedAt')
  const [sortDir, setSortDir]         = useState<SortDir>('desc')
  const [expandedGrps, setExpGrps]   = useState<Set<string>>(new Set())
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage]               = useState(1)
  const PAGE_SIZE = 20

  const stats = useMemo(() => getEvaluationStats(), [historyData])

  // ── Filter + Sort ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...historyData]
    if (search) {
      const t = search.toLowerCase()
      list = list.filter(r =>
        r.studentName?.toLowerCase().includes(t) ||
        r.examTitle?.toLowerCase().includes(t) ||
        r.subject?.toLowerCase().includes(t) ||
        r.rollNumber?.toLowerCase().includes(t)
      )
    }
    if (gradeFilter) list = list.filter(r => gradeCategory(r.grade) === gradeFilter)
    if (dateFrom) list = list.filter(r => new Date(r.evaluatedAt) >= new Date(dateFrom))
    if (dateTo)   list = list.filter(r => new Date(r.evaluatedAt) <= new Date(dateTo + 'T23:59:59'))
    list.sort((a, b) => {
      let av: any, bv: any
      if (sortKey === 'evaluatedAt') { av = new Date(a.evaluatedAt).getTime(); bv = new Date(b.evaluatedAt).getTime() }
      else if (sortKey === 'percentage') { av = a.percentage; bv = b.percentage }
      else if (sortKey === 'grade') { av = a.grade; bv = b.grade }
      else if (sortKey === 'studentName') { av = a.studentName ?? ''; bv = b.studentName ?? '' }
      else { av = a.examTitle ?? ''; bv = b.examTitle ?? '' }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [historyData, search, gradeFilter, dateFrom, dateTo, sortKey, sortDir])

  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  // ── Grouped ──────────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (groupBy === 'none') return null
    const map = new Map<string, StoredEvaluationResult[]>()
    for (const r of filtered) {
      const key =
        groupBy === 'student' ? (r.studentName ?? 'Unknown') :
        groupBy === 'exam'    ? (r.examTitle ?? 'Untitled') :
        gradeCategory(r.grade)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered, groupBy])

  // ── Grade Distribution ───────────────────────────────────────────────────
  const gradeDist = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
    historyData.forEach(r => { const c = gradeCategory(r.grade); counts[c]++ })
    const total = historyData.length || 1
    return Object.entries(counts).map(([g, c]) => ({ grade: g, count: c, pct: (c / total) * 100 }))
  }, [historyData])

  // ── Sort Toggle ──────────────────────────────────────────────────────────
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(1)
  }
  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <ArrowUpDown className="w-3 h-3 text-gray-300" /> :
    sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-gray-700" /> : <ArrowDown className="w-3 h-3 text-gray-700" />

  // ── Selection ────────────────────────────────────────────────────────────
  const allSelected = paginated.length > 0 && paginated.every(r => selected.has(r.id))
  const someSelected = paginated.some(r => selected.has(r.id))
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) paginated.forEach(r => next.delete(r.id))
      else paginated.forEach(r => next.add(r.id))
      return next
    })
  }
  const toggleOne = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!id?.trim() || !confirm('Delete this evaluation result?')) return
    try {
      const res = await fetch(`/api/evaluate/student/result/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.ok) { onHistoryChange?.(); setSelected(p => { const n = new Set(p); n.delete(id); return n }) }
      else alert('Failed to delete result')
    } catch { alert('Failed to delete evaluation result.') }
  }

  const handleBulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} selected result(s)?`)) return
    const ids = Array.from(selected)
    await Promise.all(ids.map(id =>
      fetch(`/api/evaluate/student/result/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
    ))
    setSelected(new Set())
    onHistoryChange?.()
  }

  const clearFilters = () => {
    setSearch(''); setGradeFilter(''); setDateFrom(''); setDateTo(''); setPage(1)
  }
  const hasFilters = search || gradeFilter || dateFrom || dateTo

  // ─────────────────────────────────────────────────────────────────────────
  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[0,1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-lg" />)}
      </div>
      <div className="h-10 bg-gray-100 rounded-lg" />
      {[0,1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
    </div>
  )

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (historyData.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 border border-dashed border-gray-200 bg-white rounded-xl">
      <div className="w-12 h-12 border-2 border-gray-200 flex items-center justify-center mb-4 rounded-lg">
        <BookOpen className="w-5 h-5 text-gray-300" />
      </div>
      <h3 className="text-sm font-semibold text-gray-600 mb-1">No Evaluation History</h3>
      <p className="text-xs text-gray-400 max-w-xs text-center leading-relaxed">
        Complete evaluations to build your history. All results will appear here with analytics.
      </p>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // ── Row (table mode) ──────────────────────────────────────────────────────
  const TableRow = ({ result }: { result: StoredEvaluationResult }) => {
    const cat = gradeCategory(result.grade)
    const meta = GRADE_META[cat]
    const isChecked = selected.has(result.id)

    return (
      <tr
        className={`border-b border-gray-200 transition-colors ${
          isChecked ? 'bg-gray-50' : 'hover:bg-gray-50/70'
        }`}
      >
        {/* Checkbox */}
        <td className="pl-4 pr-2 py-3 w-8">
          <button onClick={() => toggleOne(result.id)} className="text-gray-300 hover:text-gray-600">
            {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-gray-700" /> : <Square className="w-3.5 h-3.5" />}
          </button>
        </td>
        {/* Student */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} />
            <div>
              <p className="text-sm font-medium text-gray-900 leading-tight">{result.studentName ?? '—'}</p>
              {result.rollNumber && <p className="text-[10px] font-mono text-gray-400">{result.rollNumber}</p>}
            </div>
          </div>
        </td>
        {/* Exam */}
        <td className="px-3 py-3">
          <p className="text-sm text-gray-700 truncate max-w-[180px]">{result.examTitle ?? '—'}</p>
          {result.subject && <p className="text-[10px] text-gray-400">{result.subject}</p>}
        </td>
        {/* Score bar */}
        <td className="px-3 py-3 w-32">
          <div className="space-y-1">
            <div className="flex justify-between items-baseline">
              <span className={`text-sm font-bold font-mono ${pctColor(result.percentage)}`}>
                {fmt(result.percentage)}%
              </span>
              <span className="text-[10px] text-gray-400">{result.totalMarks}/{result.maxMarks}</span>
            </div>
            <ScoreBar pct={result.percentage} />
          </div>
        </td>
        {/* Grade */}
        <td className="px-3 py-3 w-16">
          <span className={`inline-flex items-center justify-center w-8 h-8 text-xs font-bold border ${meta.text} ${meta.border} bg-white rounded-lg`}>
            {result.grade}
          </span>
        </td>
        {/* Date */}
        <td className="px-3 py-3 w-28 text-right">
          <p className="text-xs text-gray-600">{fmtDate(result.evaluatedAt)}</p>
          <p className="text-[10px] text-gray-400">{fmtTime(result.evaluatedAt)}</p>
        </td>
        {/* Actions */}
        <td className="px-3 py-3 w-28">
          <div className="flex items-center justify-end gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors rounded"
                  title="More options"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem onClick={() => onSelectResult(result)}>
                  <Eye className="w-3.5 h-3.5 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDownloadReport(result)}>
                  <Download className="w-3.5 h-3.5 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => handleDelete(result.id, e as any)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>
    )
  }

  // ── Card (card mode) ──────────────────────────────────────────────────────
  const ResultCard = ({ result }: { result: StoredEvaluationResult }) => {
    const cat = gradeCategory(result.grade)
    const meta = GRADE_META[cat]
    return (
      <div
        className="group bg-white border border-gray-200 p-4 hover:border-gray-400 transition-colors cursor-pointer rounded-xl relative"
        onClick={() => onSelectResult(result)}
      >
        {/* Three dots on hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors rounded"
                title="More options"
                onClick={e => e.stopPropagation()}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={() => onSelectResult(result)}>
                <Eye className="w-3.5 h-3.5 mr-2" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownloadReport(result)}>
                <Download className="w-3.5 h-3.5 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => handleDelete(result.id, e as any)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{result.studentName ?? '—'}</p>
              {result.rollNumber && (
                <p className="text-[10px] font-mono text-gray-400">{result.rollNumber}</p>
              )}
            </div>
          </div>
          <span className={`flex-shrink-0 text-xs font-bold border px-2 py-1 ${meta.text} ${meta.border} rounded-lg`}>
            {result.grade}
          </span>
        </div>

        <p className="text-xs text-gray-500 truncate mb-3">{result.examTitle ?? 'Untitled Exam'}</p>

        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-xs">
            <span className={`font-bold font-mono ${pctColor(result.percentage)}`}>{fmt(result.percentage)}%</span>
            <span className="text-gray-400">{result.totalMarks}/{result.maxMarks}</span>
          </div>
          <ScoreBar pct={result.percentage} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{fmtDate(result.evaluatedAt)}</span>
        </div>
      </div>
    )
  }

  // ── Group Section ─────────────────────────────────────────────────────────
  const GroupSection = ({ groupKey, items }: { groupKey: string; items: StoredEvaluationResult[] }) => {
    const isOpen = expandedGrps.has(groupKey)
    const avg = items.reduce((s, r) => s + r.percentage, 0) / items.length
    const cat = gradeCategory(groupKey.length === 1 ? groupKey : (avg >= 85 ? 'A' : avg >= 70 ? 'B' : avg >= 55 ? 'C' : avg >= 40 ? 'D' : 'F'))
    const scores = items.map(r => r.percentage)

    return (
      <div className="border border-gray-200 bg-white mb-2 rounded-xl">
        <button
          onClick={() => setExpGrps(prev => { const n = new Set(prev); n.has(groupKey) ? n.delete(groupKey) : n.add(groupKey); return n })}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-transparent hover:border-gray-100"
        >
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <span className="text-sm font-semibold text-gray-800 flex-1">{groupKey}</span>
          <Sparkline values={scores} />
          <div className="flex items-center gap-3 text-xs text-gray-500 ml-3">
            <span>{items.length} result{items.length !== 1 ? 's' : ''}</span>
            <span className={`font-bold font-mono ${pctColor(avg)}`}>{fmt(avg)}% avg</span>
          </div>
        </button>
        {isOpen && (
          <div className="p-3">
            {viewMode === 'table' ? (
              <div className="bg-white border-2 border-gray-300 rounded-lg shadow-sm">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      <th className="pl-4 pr-2 py-3 w-8 font-bold text-gray-800 bg-gray-100 border-r border-gray-300">
                        <span className="text-[10px] font-bold uppercase tracking-widest">#</span>
                      </th>
                      {groupBy !== 'student' && (
                        <th className="px-3 py-3 text-left font-bold text-gray-800 bg-gray-100 border-r border-gray-300">
                          <button
                            onClick={() => toggleSort('studentName')}
                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-800 hover:text-gray-900 transition-colors"
                          >
                            Student
                            <SortIcon k={'studentName'} />
                          </button>
                        </th>
                      )}
                      {groupBy !== 'exam' && (
                        <th className="px-3 py-3 text-left font-bold text-gray-800 bg-gray-100 border-r border-gray-300">
                          <button
                            onClick={() => toggleSort('examTitle')}
                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-800 hover:text-gray-900 transition-colors"
                          >
                            Exam
                            <SortIcon k={'examTitle'} />
                          </button>
                        </th>
                      )}
                      <th className="px-3 py-3 text-left font-bold text-gray-800 bg-gray-100 border-r border-gray-300" style={{ width: 140 }}>
                        <button
                          onClick={() => toggleSort('percentage')}
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-800 hover:text-gray-900 transition-colors"
                        >
                          Score
                          <SortIcon k={'percentage'} />
                        </button>
                      </th>
                      <th className="px-3 py-3 text-left font-bold text-gray-800 bg-gray-100 border-r border-gray-300" style={{ width: 64 }}>
                        <button
                          onClick={() => toggleSort('grade')}
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-800 hover:text-gray-900 transition-colors"
                        >
                          Grade
                          <SortIcon k={'grade'} />
                        </button>
                      </th>
                      <th className="px-3 py-3 text-left font-bold text-gray-800 bg-gray-100 border-r border-gray-300" style={{ width: 112 }}>
                        <button
                          onClick={() => toggleSort('evaluatedAt')}
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-800 hover:text-gray-900 transition-colors"
                        >
                          Date
                          <SortIcon k={'evaluatedAt'} />
                        </button>
                      </th>
                      <th className="px-3 py-3 text-right font-bold text-gray-800 bg-gray-100">
                        <span className="text-[10px] font-bold uppercase tracking-widest">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(r => <TableRow key={r.id} result={r} />)}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>
                {/* Grouped Cards Filter Header */}
                <div className="bg-white border border-gray-200 rounded-t-xl p-3 border-b-2 border-gray-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={toggleAll} className="text-gray-300 hover:text-gray-600">
                        {allSelected
                          ? <CheckSquare className="w-3.5 h-3.5 text-gray-700" />
                          : someSelected
                          ? <Minus className="w-3.5 h-3.5 text-gray-400" />
                          : <Square className="w-3.5 h-3.5" />}
                      </button>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-700">Select All</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-6">
                      {groupBy !== 'student' && (
                        <button
                          onClick={() => toggleSort('studentName')}
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          Student
                          <SortIcon k={'studentName'} />
                        </button>
                      )}
                      {groupBy !== 'exam' && (
                        <button
                          onClick={() => toggleSort('examTitle')}
                          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          Exam
                          <SortIcon k={'examTitle'} />
                        </button>
                      )}
                      <button
                        onClick={() => toggleSort('percentage')}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:text-gray-900 transition-colors"
                      >
                        Score
                        <SortIcon k={'percentage'} />
                      </button>
                      <button
                        onClick={() => toggleSort('grade')}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:text-gray-900 transition-colors"
                      >
                        Grade
                        <SortIcon k={'grade'} />
                      </button>
                      <button
                        onClick={() => toggleSort('evaluatedAt')}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:text-gray-900 transition-colors"
                      >
                        Date
                        <SortIcon k={'evaluatedAt'} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-xl p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map(r => <ResultCard key={r.id} result={r} />)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Evaluations"
          value={stats.totalEvaluations}
          icon={BarChart3}
          accent="text-gray-900"
        />
        <StatCard
          label="Average Score"
          value={`${fmt(stats.averageScore)}%`}
          sub={stats.recentTrend !== 'stable' ? `Trend: ${stats.recentTrend}` : undefined}
          icon={stats.recentTrend === 'improving' ? TrendingUp : stats.recentTrend === 'declining' ? TrendingDown : Activity}
          accent={pctColor(stats.averageScore)}
        />
        <StatCard
          label="Highest Score"
          value={`${fmt(stats.highestScore)}%`}
          icon={Award}
          accent="text-emerald-700"
        />
        <StatCard
          label="Lowest Score"
          value={`${fmt(stats.lowestScore)}%`}
          icon={Activity}
          accent="text-gray-600"
        />
      </div>

      {/* ── Grade Distribution - Unique Radial Design ─────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-50 to-white border border-gray-200 p-6 rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-bold text-gray-700">Grade Distribution</p>
          <p className="text-xs text-gray-500">{historyData.length} total evaluations</p>
        </div>
        
        {/* Radial Chart Container */}
        <div className="flex justify-center items-center mb-6">
          <div className="relative w-48 h-48">
            {/* SVG Pie Chart */}
            <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 192 192">
              {gradeDist.map(({ grade, pct }, index) => {
                if (pct === 0) return null
                const startAngle = gradeDist.slice(0, index).reduce((sum, g) => sum + g.pct, 0) * 3.6
                const endAngle = startAngle + (pct * 3.6)
                const startRad = (startAngle * Math.PI) / 180
                const endRad = (endAngle * Math.PI) / 180
                const x1 = 96 + 80 * Math.cos(startRad)
                const y1 = 96 + 80 * Math.sin(startRad)
                const x2 = 96 + 80 * Math.cos(endRad)
                const y2 = 96 + 80 * Math.sin(endRad)
                const largeArc = pct > 50 ? 1 : 0
                
                // Get the actual color values
                const colorMap: Record<string, string> = {
                  A: '#10b981', // emerald-500
                  B: '#0ea5e9', // sky-500  
                  C: '#f59e0b', // amber-500
                  D: '#f97316', // orange-500
                  F: '#ef4444'  // red-500
                }
                
                return (
                  <path
                    key={grade}
                    d={`M 96 96 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={colorMap[grade] || '#6b7280'}
                    className="transition-all duration-500 hover:opacity-80 cursor-pointer"
                    onClick={() => { setGradeFilter(gradeFilter === grade ? '' : grade); setPage(1) }}
                  />
                )
              })}
              
              {/* Center circle */}
              <circle cx="96" cy="96" r="40" fill="white" />
              
              {/* Center text */}
              <text x="96" y="96" textAnchor="middle" dominantBaseline="middle" className="fill-gray-700">
                <tspan x="96" y="90" className="text-2xl font-bold">{historyData.length}</tspan>
                <tspan x="96" y="110" className="text-xs text-gray-500">Total</tspan>
              </text>
            </svg>
          </div>
        </div>
        
        {/* Interactive Legend */}
        <div className="flex flex-wrap justify-center gap-4">
          {gradeDist.map(({ grade, count, pct }) => (
            <div
              key={grade}
              className="group cursor-pointer"
              onClick={() => { setGradeFilter(gradeFilter === grade ? '' : grade); setPage(1) }}
            >
              <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-all duration-300">
                <div className={`w-4 h-4 rounded-full ${GRADE_META[grade].dot} border-2 ${GRADE_META[grade].border}`} />
                <div className="text-left">
                  <p className={`text-sm font-bold ${GRADE_META[grade].text}`}>Grade {grade}</p>
                  <p className="text-xs text-gray-500">{count} students ({fmt(pct)}%)</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 p-3 rounded-lg">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search student, exam, subject, roll no…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-9 h-8 text-sm border border-gray-300 focus:border-gray-400 focus:ring-0 rounded-lg"
            />
          </div>

          {/* Toolbar buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 h-8 text-xs border rounded-lg transition-colors ${
                showFilters || dateFrom || dateTo
                  ? 'border-gray-800 bg-gray-800 text-white'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              Filters
              {(dateFrom || dateTo) && <span className="w-1.5 h-1.5 rounded-lg bg-amber-400 ml-0.5" />}
            </button>

            <div className="w-px h-5 bg-gray-200" />

            {/* Group by */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-1.5 px-3 h-8 text-xs border rounded-lg transition-colors ${
                  groupBy !== 'none'
                    ? 'border-gray-800 bg-gray-800 text-white'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400'
                }`}>
                  <span>{groupBy === 'none' ? 'All' : `By ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32">
                {(['none', 'student', 'exam', 'grade'] as GroupBy[]).map(g => (
                  <DropdownMenuItem
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={groupBy === g ? 'bg-gray-100' : ''}
                  >
                    {g === 'none' ? 'All' : `By ${g.charAt(0).toUpperCase() + g.slice(1)}`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-5 bg-gray-200" />

            {/* View Mode */}
            {(['table', 'cards'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-2.5 h-8 text-xs border rounded-lg transition-colors ${
                  viewMode === v
                    ? 'border-gray-800 bg-gray-800 text-white'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400'
                }`}
              >
                {v === 'table' ? 'Table' : 'Cards'}
              </button>
            ))}

            <div className="w-px h-5 bg-gray-200" />

            <button
              onClick={() => exportCSV(filtered)}
              className="flex items-center gap-1.5 px-2.5 h-8 text-xs border border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 transition-colors"
            >
              <FileDown className="w-3 h-3" />
              Export
            </button>
          </div>
        </div>

        {/* Date filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-full sm:w-auto">
              Date Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                className="h-8 border border-gray-300 px-2 text-xs focus:outline-none focus:border-gray-400 rounded-lg"
              />
              <span className="text-gray-300 text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1) }}
                className="h-8 border border-gray-300 px-2 text-xs focus:outline-none focus:border-gray-400 rounded-lg"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo('') }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <X className="w-3 h-3" /> Clear dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Meta Row ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span>{filtered.length} of {historyData.length} results</span>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-gray-400 hover:text-gray-700 transition-colors p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
              <RotateCcw className="w-3 h-3" />
              Clear all filters
            </button>
          )}
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="font-medium text-gray-700">{selected.size} selected</span>
            <button
              onClick={() => exportCSV(historyData.filter(r => selected.has(r.id)))}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FileDown className="w-3 h-3" /> Export selected
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1 text-red-500 hover:text-red-700 transition-colors p-1.5 border border-gray-300 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3" /> Delete selected
            </button>
            <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-gray-700 p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── No Results ─────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 bg-white rounded-xl">
          <Search className="w-7 h-7 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 mb-1">No results match your filters</p>
          <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2">
            Clear all filters
          </button>
        </div>
      ) : grouped ? (
        /* ── Grouped View ───────────────────────────────────────────── */
        <div>
          {grouped.map(([key, items]) => <GroupSection key={key} groupKey={key} items={items} />)}
        </div>
      ) : viewMode === 'cards' ? (
        /* ── Card Grid ──────────────────────────────────────────────── */
        <div>
          {/* Cards Filter Header */}
          <div className="bg-white border border-gray-200 rounded-t-xl p-3 border-b-2 border-gray-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={toggleAll} className="text-gray-300 hover:text-gray-600">
                  {allSelected
                    ? <CheckSquare className="w-3.5 h-3.5 text-gray-700" />
                    : someSelected
                    ? <Minus className="w-3.5 h-3.5 text-gray-400" />
                    : <Square className="w-3.5 h-3.5" />}
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-700">Select All</span>
              </div>
              <div className="flex-1 flex items-center justify-center gap-6">
                {([
                  ['examTitle', 'Exam'],
                  ['percentage', 'Score'],
                  ['grade', 'Grade'],
                  ['evaluatedAt', 'Date'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    {label}
                    <SortIcon k={key} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginated.map(r => <ResultCard key={r.id} result={r} />)}
            </div>
          </div>
        </div>
      ) : (
        /* ── Table ──────────────────────────────────────────────────── */
        <div className="bg-white border border-gray-200 overflow-hidden rounded-xl">
          <table className="w-full border-collapse text-sm">
            <thead className="rounded-t-xl">
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="pl-4 pr-2 py-2.5 w-8">
                  <button onClick={toggleAll} className="text-gray-300 hover:text-gray-600">
                    {allSelected
                      ? <CheckSquare className="w-3.5 h-3.5 text-gray-700" />
                      : someSelected
                      ? <Minus className="w-3.5 h-3.5 text-gray-400" />
                      : <Square className="w-3.5 h-3.5" />}
                  </button>
                </th>
                {([
                  ['studentName', 'Student'],
                  ['examTitle', 'Exam'],
                  ['percentage', 'Score'],
                  ['grade', 'Grade'],
                  ['evaluatedAt', 'Date'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    className="px-3 py-2.5 text-left"
                    style={{ width: key === 'percentage' ? 140 : key === 'grade' ? 64 : key === 'evaluatedAt' ? 112 : 'auto' }}
                  >
                    <button
                      onClick={() => toggleSort(key)}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      {label}
                      <SortIcon k={key} />
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(r => <TableRow key={r.id} result={r} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────────────── */}
      {!grouped && totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 h-7 border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 border text-xs transition-colors ${
                    p === page
                      ? 'border-gray-800 bg-gray-800 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 h-7 border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
