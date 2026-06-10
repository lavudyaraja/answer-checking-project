'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Eye,
  Edit,
  Trash2,
  Plus,
  FileText,
  Calendar,
  BookOpen,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  Hash,
  LayoutGrid,
  List,
  RefreshCw,
  CheckSquare,
  Square,
  MoreVertical,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Exam {
  id: string
  title: string
  subject: string
  questionCount: number
  totalMarks: number
  createdAt: string
  updatedAt: string
}

type SortField = 'title' | 'subject' | 'questionCount' | 'totalMarks' | 'createdAt'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'grid'

interface ExamManagementProps {
  onCreateNew: () => void
  onEditExam: (examId: string) => void
  onViewExam: (examId: string) => void
}

export default function ExamManagement({
  onCreateNew,
  onEditExam,
  onViewExam,
}: ExamManagementProps) {
  const { toast } = useToast()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchExams()
  }, [])

  const fetchExams = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const response = await fetch('/api/exams/list')
      if (response.ok) {
        const data = await response.json()
        setExams(data.exams || [])
      } else {
        throw new Error('Failed to fetch exams')
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load exams.', variant: 'destructive' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleDeleteExam = async (examId: string, examTitle: string) => {
    if (!confirm(`Delete "${examTitle}"? This cannot be undone.`)) return
    try {
      setDeletingId(examId)
      const res = await fetch(`/api/exams/${examId}`, { method: 'DELETE' })
      if (res.ok) {
        setExams(prev => prev.filter(e => e.id !== examId))
        setSelectedIds(prev => { const n = new Set(prev); n.delete(examId); return n })
        toast({ title: 'Deleted', description: `"${examTitle}" removed.` })
      } else {
        const err = await res.json()
        toast({ title: 'Cannot delete', description: err.details || err.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Delete failed', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} exam(s)? This cannot be undone.`)) return
    setBulkDeleting(true)
    const ids = Array.from(selectedIds)
    let failed = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' })
        if (res.ok) {
          setExams(prev => prev.filter(e => e.id !== id))
        } else { failed++ }
      } catch { failed++ }
    }
    setSelectedIds(new Set())
    setBulkDeleting(false)
    toast({
      title: failed === 0 ? 'Deleted' : 'Partial delete',
      description: failed === 0
        ? `${ids.length} exam(s) removed.`
        : `${ids.length - failed} deleted, ${failed} failed (may have evaluations).`,
      variant: failed === 0 ? 'default' : 'destructive',
    })
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-400" />
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />
  }

  const filteredAndSorted = useMemo(() => {
    let list = exams.filter(e =>
      e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.subject.toLowerCase().includes(searchTerm.toLowerCase())
    )
    list = [...list].sort((a, b) => {
      let va: string | number = a[sortField]
      let vb: string | number = b[sortField]
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [exams, searchTerm, sortField, sortDir])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSorted.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAndSorted.map(e => e.id)))
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const totalQuestions = exams.reduce((s, e) => s + e.questionCount, 0)
  const totalMarks = exams.reduce((s, e) => s + e.totalMarks, 0)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        <span className="text-xs text-gray-400 tracking-widest uppercase font-medium">Loading exams…</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── Page Header ─────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Exam Library</p>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Manage Exams</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchExams(true)}
              className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
              className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all"
              title="Toggle view"
            >
              {viewMode === 'list' ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onCreateNew}
              className="h-9 px-4 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Exam
            </button>
          </div>
        </div>

        {/* ── Stats Bar ───────────────────────────────────── */}
        {exams.length > 0 && (
          <div className="grid grid-cols-3 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {[
              { label: 'Total Exams', value: exams.length, icon: ClipboardList, accent: 'text-violet-500' },
              { label: 'Total Questions', value: totalQuestions, icon: FileText, accent: 'text-blue-500' },
              { label: 'Total Marks', value: totalMarks, icon: Hash, accent: 'text-emerald-500' },
            ].map(({ label, value, icon: Icon, accent }, i) => (
              <div
                key={label}
                className={`flex items-center gap-3 px-5 py-4 bg-white ${i < 2 ? 'border-r border-gray-200' : ''}`}
              >
                <div className={`w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${accent}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 leading-none tabular-nums">{value}</div>
                  <div className="text-[11px] text-gray-400 font-medium mt-0.5">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Search + Sort Bar ───────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by title or subject…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-lg bg-white placeholder-gray-400 text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-all"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Sort</span>
            {(['title', 'subject', 'questionCount', 'totalMarks', 'createdAt'] as SortField[]).map(f => (
              <button
                key={f}
                onClick={() => toggleSort(f)}
                className={`flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold rounded-md border transition-all ${
                  sortField === f
                    ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                    : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 bg-white'
                }`}
              >
                {f === 'questionCount' ? 'Q&A' : f === 'totalMarks' ? 'Marks' : f === 'createdAt' ? 'Date' : f.charAt(0).toUpperCase() + f.slice(1)}
                <SortIcon field={f} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Bulk Action Bar ─────────────────────────────── */}
        {filteredAndSorted.length > 0 && (
          <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
            >
              {selectedIds.size === filteredAndSorted.length && filteredAndSorted.length > 0
                ? <CheckSquare className="w-3.5 h-3.5 text-gray-800" />
                : <Square className="w-3.5 h-3.5" />}
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-md transition-all"
              >
                {bulkDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Delete {selectedIds.size}
              </button>
            )}
            <span className="ml-auto text-[11px] text-gray-400 font-medium">
              {filteredAndSorted.length} of {exams.length} exam{exams.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* ── Empty State ─────────────────────────────────── */}
        {filteredAndSorted.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-xl py-20 text-center bg-gray-50/50">
            <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <FileText className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">
              {searchTerm ? 'No matching exams' : 'No exams yet'}
            </p>
            <p className="text-xs text-gray-400 mb-6">
              {searchTerm
                ? 'Try a different search term.'
                : 'Create your first exam to get started.'}
            </p>
            {!searchTerm && (
              <button
                onClick={onCreateNew}
                className="inline-flex items-center gap-2 h-8 px-4 text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:border-gray-900 hover:text-gray-900 rounded-lg transition-all"
              >
                <Plus className="w-3 h-3" />
                Create Exam
              </button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          /* ── List View ─────────────────────────────────── */
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
            {/* Table Header */}
            <div className="grid grid-cols-[auto_1fr_90px_90px_110px_48px] items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exam</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Questions</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Marks</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</span>
              <span />
            </div>
            <div className="divide-y divide-gray-100">
              {filteredAndSorted.map((exam, idx) => (
                <div
                  key={exam.id}
                  className={`grid grid-cols-[auto_1fr_90px_90px_110px_48px] items-center gap-3 px-4 py-3.5 transition-colors group ${
                    selectedIds.has(exam.id)
                      ? 'bg-gray-50'
                      : 'bg-white hover:bg-gray-50/80'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(exam.id)}
                    className="text-gray-300 hover:text-gray-600 transition-colors"
                  >
                    {selectedIds.has(exam.id)
                      ? <CheckSquare className="w-4 h-4 text-gray-800" />
                      : <Square className="w-4 h-4" />}
                  </button>

                  {/* Title + Subject */}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate leading-snug">{exam.title}</div>
                    {exam.subject && (
                      <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 border border-gray-200 rounded-md px-1.5 py-0.5 bg-gray-50">
                        {exam.subject}
                      </span>
                    )}
                  </div>

                  {/* Questions */}
                  <div className="text-sm font-semibold text-gray-700 text-right tabular-nums">
                    {exam.questionCount}
                    <span className="text-xs text-gray-400 font-normal ml-0.5">Q</span>
                  </div>

                  {/* Marks */}
                  <div className="text-sm font-semibold text-gray-700 text-right tabular-nums">
                    {exam.totalMarks}
                    <span className="text-xs text-gray-400 font-normal ml-0.5">pts</span>
                  </div>

                  {/* Date */}
                  <div className="text-[11px] text-gray-400 font-medium whitespace-nowrap">
                    {formatDate(exam.createdAt)}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36 shadow-lg border border-gray-200 rounded-lg p-1">
                        <DropdownMenuItem
                          onClick={() => onViewExam(exam.id)}
                          className="flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-md cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-gray-400" />
                          <span>View exam</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onEditExam(exam.id)}
                          className="flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-md cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5 text-gray-400" />
                          <span>Edit exam</span>
                        </DropdownMenuItem>
                        <div className="my-1 border-t border-gray-100" />
                        <DropdownMenuItem
                          onClick={() => handleDeleteExam(exam.id, exam.title)}
                          className="flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-md cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          {deletingId === exam.id ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> <span>Deleting…</span></>
                          ) : (
                            <><Trash2 className="w-3.5 h-3.5" /> <span>Delete</span></>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── Grid View ─────────────────────────────────── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSorted.map(exam => (
              <div
                key={exam.id}
                className={`group relative border rounded-xl p-5 bg-white transition-all cursor-pointer ${
                  selectedIds.has(exam.id)
                    ? 'border-gray-900 shadow-md'
                    : 'border-gray-200 hover:border-gray-400 hover:shadow-md'
                }`}
              >
                {/* Top Row */}
                <div className="flex items-start justify-between mb-4">
                  <button
                    onClick={() => toggleSelect(exam.id)}
                    className="text-gray-300 hover:text-gray-700 transition-colors mt-0.5"
                  >
                    {selectedIds.has(exam.id)
                      ? <CheckSquare className="w-4 h-4 text-gray-900" />
                      : <Square className="w-4 h-4" />}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 shadow-lg border border-gray-200 rounded-lg p-1">
                      <DropdownMenuItem
                        onClick={() => onViewExam(exam.id)}
                        className="flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-md cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-gray-400" />
                        <span>View exam</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onEditExam(exam.id)}
                        className="flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-md cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5 text-gray-400" />
                        <span>Edit exam</span>
                      </DropdownMenuItem>
                      <div className="my-1 border-t border-gray-100" />
                      <DropdownMenuItem
                        onClick={() => handleDeleteExam(exam.id, exam.title)}
                        className="flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-md cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        {deletingId === exam.id ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> <span>Deleting…</span></>
                        ) : (
                          <><Trash2 className="w-3.5 h-3.5" /> <span>Delete</span></>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Content */}
                <h3 className="font-bold text-sm text-gray-900 leading-snug mb-2">{exam.title}</h3>
                {exam.subject && (
                  <span className="inline-block text-[10px] font-bold tracking-widest uppercase text-gray-500 border border-gray-200 rounded-md px-1.5 py-0.5 bg-gray-50 mb-4">
                    {exam.subject}
                  </span>
                )}

                {/* Divider */}
                <div className="border-t border-gray-100 my-3" />

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2">
                    <FileText className="w-3 h-3 text-blue-400 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-gray-800 leading-none">{exam.questionCount}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Questions</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2">
                    <BookOpen className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-gray-800 leading-none">{exam.totalMarks}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Marks</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-3">
                  <Calendar className="w-3 h-3 text-gray-300 flex-shrink-0" />
                  <span className="text-[11px] text-gray-400">{formatDate(exam.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}