'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  ClipboardList,
  Award,
  Paperclip,
  BarChart2,
  AlignLeft,
  BookOpen,
  Tag,
  Search,
  Eye,
  EyeOff,
  Star,
  ChevronDown,
  ChevronUp,
  FileText,
  Hash,
  Info,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface Question {
  id: string
  number: number
  text: string
  modelAnswer: string
  rubric: string
  marks: number
  keywords: string[]
}

interface Exam {
  id: string
  title: string
  subject: string
  description: string
  instructions: string
  createdAt: string
  updatedAt: string
  questions: Question[]
  documents: { fileName: string; fileType: string }[]
}

interface ExamViewProps {
  examId: string
  onBack: () => void
  onEdit: (examId: string) => void
  onDelete: (examId: string, examTitle: string) => void
}

// ── Helpers ───────────────────────────────────────────────────
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const formatShortDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

const fileTypeColor: Record<string, string> = {
  pdf: 'text-red-500 bg-red-50 border-red-200',
  doc: 'text-blue-500 bg-blue-50 border-blue-200',
  docx: 'text-blue-500 bg-blue-50 border-blue-200',
  xlsx: 'text-emerald-500 bg-emerald-50 border-emerald-200',
  pptx: 'text-orange-500 bg-orange-50 border-orange-200',
  png: 'text-violet-500 bg-violet-50 border-violet-200',
  jpg: 'text-violet-500 bg-violet-50 border-violet-200',
  jpeg: 'text-violet-500 bg-violet-50 border-violet-200',
}

export default function ExamView({ examId, onBack, onEdit, onDelete }: ExamViewProps) {
  const { toast } = useToast()
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'documents' | 'analytics'>('overview')
  const [copied, setCopied] = useState(false)
  const [questionSearch, setQuestionSearch] = useState('')
  const [showAnswers, setShowAnswers] = useState(true)
  const [marksFilter, setMarksFilter] = useState<number | null>(null)
  const [sortOrder, setSortOrder] = useState<'number' | 'marks-asc' | 'marks-desc'>('number')
  const [highlightKeywords, setHighlightKeywords] = useState(true)

  useEffect(() => { fetchExam() }, [examId])

  const fetchExam = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/exams/${examId}`)
      if (res.ok) {
        const data = await res.json()
        setExam(data)
        setExpandedIds(new Set(data.questions.map((q: Question) => q.id)))
      } else throw new Error()
    } catch {
      toast({ title: 'Error', description: 'Failed to load exam.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const toggleQuestion = (id: string) =>
    setExpandedIds(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  const expandAll  = () => exam && setExpandedIds(new Set(exam.questions.map(q => q.id)))
  const collapseAll = () => setExpandedIds(new Set())

  const handleCopy = (text: string, label = 'Copied') => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast({ title: label, description: 'Copied to clipboard.' })
    setTimeout(() => setCopied(false), 1500)
  }

  const handleExportJSON = () => {
    if (!exam) return
    const blob = new Blob([JSON.stringify(exam, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${exam.title.replace(/\s+/g, '_')}.json`; a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Exported', description: 'Exam exported as JSON.' })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        <span className="text-xs text-gray-400 tracking-widest uppercase font-medium">Loading exam…</span>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="text-center py-20 border border-dashed border-gray-200 rounded-xl">
        <p className="text-sm text-gray-500 mb-4">Exam not found.</p>
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:border-gray-400 transition-all">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>
    )
  }

  const totalMarks  = exam.questions.reduce((s, q) => s + q.marks, 0)
  const avgMarks    = exam.questions.length > 0 ? (totalMarks / exam.questions.length).toFixed(1) : '—'
  const maxMark     = exam.questions.length > 0 ? Math.max(...exam.questions.map(q => q.marks)) : 0
  const minMark     = exam.questions.length > 0 ? Math.min(...exam.questions.map(q => q.marks)) : 0

  // marks distribution for analytics
  const marksBuckets = exam.questions.reduce<Record<number, number>>((acc, q) => {
    acc[q.marks] = (acc[q.marks] || 0) + 1; return acc
  }, {})

  const uniqueMarks = [...new Set(exam.questions.map(q => q.marks))].sort((a, b) => a - b)

  // filtered + sorted questions
  const filteredQuestions = exam.questions
    .filter(q => {
      const matchSearch = !questionSearch ||
        q.text.toLowerCase().includes(questionSearch.toLowerCase()) ||
        q.keywords.some(k => k.toLowerCase().includes(questionSearch.toLowerCase()))
      const matchMarks = marksFilter === null || q.marks === marksFilter
      return matchSearch && matchMarks
    })
    .sort((a, b) => {
      if (sortOrder === 'marks-asc') return a.marks - b.marks
      if (sortOrder === 'marks-desc') return b.marks - a.marks
      return a.number - b.number
    })

  const allKeywords = [...new Set(exam.questions.flatMap(q => q.keywords))].sort()
  const totalKeywords = allKeywords.length

  const tabs = [
    { key: 'overview',   label: 'Overview',                        icon: AlignLeft },
    { key: 'questions',  label: `Questions (${exam.questions.length})`, icon: FileText },
    { key: 'documents',  label: `Documents (${exam.documents?.length ?? 0})`, icon: Paperclip },
    { key: 'analytics',  label: 'Analytics',                       icon: BarChart2 },
  ] as const

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 print:px-0 print:py-0">

        {/* ── Top Bar ───────────────────────────────────────── */}
        <div className="print:hidden">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {/* ── Exam Header Card ──────────────────────────────── */}
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
          {/* Header band */}
          <div className="px-6 pt-6 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {exam.subject && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 border border-gray-200 bg-gray-50 rounded-md px-2 py-0.5">
                      {exam.subject}
                    </span>
                  )}
                  <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatShortDate(exam.createdAt)}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-snug">
                  {exam.title}
                </h1>
                {exam.updatedAt !== exam.createdAt && (
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    Last updated {formatShortDate(exam.updatedAt)}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleCopy(exam.title, 'Title copied')}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all flex-shrink-0"
                title="Copy title"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-4 border-t border-gray-200 divide-x divide-gray-200">
            {[
              { label: 'Questions',     value: exam.questions.length, icon: ClipboardList, accent: 'text-violet-500' },
              { label: 'Total Marks',   value: totalMarks,            icon: Award,         accent: 'text-emerald-500' },
              { label: 'Avg / Q',       value: avgMarks,              icon: Hash,          accent: 'text-blue-500'   },
              { label: 'Documents',     value: exam.documents?.length ?? 0, icon: Paperclip, accent: 'text-orange-500' },
            ].map(({ label, value, icon: Icon, accent }) => (
              <div key={label} className="flex items-center gap-2.5 px-4 py-3.5 bg-gray-50/60">
                <Icon className={`w-3.5 h-3.5 ${accent} flex-shrink-0`} />
                <div>
                  <div className="text-lg font-bold text-gray-900 leading-none tabular-nums">{value}</div>
                  <div className="text-[10px] text-gray-400 font-medium mt-0.5">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────── */}
        <div className="border-b border-gray-200 print:hidden">
          <div className="flex gap-0 -mb-px">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                    activeTab === tab.key
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB: OVERVIEW
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {exam.description && (
              <div className="border border-gray-200 rounded-xl p-5 bg-white">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center">
                    <AlignLeft className="w-3 h-3 text-gray-500" />
                  </div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Description</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{exam.description}</p>
              </div>
            )}

            {exam.instructions && (
              <div className="border border-amber-200 rounded-xl p-5 bg-amber-50/40">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-amber-100 border border-amber-200 flex items-center justify-center">
                    <BookOpen className="w-3 h-3 text-amber-600" />
                  </div>
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">Instructions</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{exam.instructions}</p>
              </div>
            )}

            {/* Meta info */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exam Details</span>
              </div>
              <div className="divide-y divide-gray-100">
                {[
                  { label: 'Exam ID',      value: exam.id },
                  { label: 'Subject',      value: exam.subject || '—' },
                  { label: 'Created',      value: formatDate(exam.createdAt) },
                  { label: 'Last Updated', value: formatDate(exam.updatedAt) },
                  { label: 'Keywords',     value: totalKeywords > 0 ? `${totalKeywords} unique keyword${totalKeywords !== 1 ? 's' : ''}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
                    <span className="text-xs font-semibold text-gray-400 w-28 flex-shrink-0">{label}</span>
                    <span className="text-xs text-gray-700 text-right font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* All keywords */}
            {allKeywords.length > 0 && (
              <div className="border border-gray-200 rounded-xl p-5 bg-white">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center">
                    <Tag className="w-3 h-3 text-gray-500" />
                  </div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">All Keywords</span>
                  <span className="ml-auto text-[10px] text-gray-400 font-medium">{allKeywords.length} total</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allKeywords.map((kw, i) => (
                    <span key={i} className="text-[11px] font-medium border border-gray-200 rounded-md px-2 py-0.5 text-gray-600 bg-gray-50">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* {!exam.description && !exam.instructions && (
              <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
                <Info className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No description or instructions added.</p>
                <button
                  onClick={() => onEdit(exam.id)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors"
                >
                  <Edit className="w-3 h-3" /> Edit exam to add details
                </button>
              </div>
            )} */}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: QUESTIONS
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {/* Toolbar */}
            {exam.questions.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search questions or keywords…"
                    value={questionSearch}
                    onChange={e => setQuestionSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-all"
                  />
                </div>

                {/* Marks filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9 text-xs">
                      All marks
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setMarksFilter(null)}>
                      All marks
                    </DropdownMenuItem>
                    {uniqueMarks.map(m => (
                      <DropdownMenuItem key={m} onClick={() => setMarksFilter(m)}>
                        {m} {m === 1 ? 'mark' : 'marks'}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Sort */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9 text-xs">
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setSortOrder("number")}>
                      Sort by number
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOrder("marks-asc")}>
                      Marks: low → high
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOrder("marks-desc")}>
                      Marks: high → low
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Controls row */}
            {exam.questions.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAnswers(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                >
                  {showAnswers ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showAnswers ? 'Hide answers' : 'Show answers'}
                </button>
                <div className="w-px h-4 bg-gray-200" />
                <button
                  onClick={() => setHighlightKeywords(v => !v)}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${highlightKeywords ? 'text-amber-600' : 'text-gray-400 hover:text-gray-700'}`}
                >
                  <Star className="w-3.5 h-3.5" />
                  Keywords
                </button>
                <span className="ml-auto text-[11px] text-gray-400 font-medium">
                  {filteredQuestions.length} of {exam.questions.length}
                </span>
              </div>
            )}

            {/* Question list */}
            {exam.questions.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
                <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-1">No questions added yet</p>
                <button onClick={() => onEdit(exam.id)} className="mt-2 text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors">
                  Edit exam to add questions
                </button>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
                <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No questions match your filters.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQuestions.map(q => {
                  const isOpen = expandedIds.has(q.id)
                  return (
                    <div
                      key={q.id}
                      className={`border rounded-xl overflow-hidden transition-all ${
                        isOpen ? 'border-gray-300 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Question header */}
                      <button
                        onClick={() => toggleQuestion(q.id)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left bg-white hover:bg-gray-50/80 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex-shrink-0 w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-600 tabular-nums">
                            {q.number}
                          </span>
                          <span className="text-sm font-medium text-gray-900 leading-snug line-clamp-2 text-left">
                            {q.text || <span className="italic text-gray-400">No question text</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 rounded-md px-2 py-0.5 tabular-nums">
                            {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                          </span>
                          {isOpen
                            ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                            : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                        </div>
                      </button>

                      {/* Question body */}
                      {isOpen && (
                        <div className="border-t border-gray-200">
                          {showAnswers && q.modelAnswer && (
                            <div className="p-4 bg-white border-b border-gray-100">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Model Answer</p>
                                <button
                                  onClick={() => handleCopy(q.modelAnswer, 'Answer copied')}
                                  className="text-gray-400 hover:text-gray-700 transition-colors"
                                  title="Copy answer"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{q.modelAnswer}</p>
                            </div>
                          )}
                          {showAnswers && q.rubric && (
                            <div className="p-4 bg-amber-50/50 border-b border-amber-100/60">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700/70 mb-2">Grading Rubric</p>
                              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{q.rubric}</p>
                            </div>
                          )}
                          {q.keywords && q.keywords.length > 0 && (
                            <div className="p-4 bg-white">
                              <div className="flex items-center gap-2 mb-2">
                                <Tag className="w-3 h-3 text-gray-400" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Keywords</p>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {q.keywords.map((kw, i) => (
                                  <span
                                    key={i}
                                    className={`text-[11px] font-medium rounded-md px-2 py-0.5 border transition-colors ${
                                      highlightKeywords
                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                        : 'border-gray-200 bg-gray-50 text-gray-600'
                                    }`}
                                  >
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {!q.modelAnswer && !q.rubric && (!q.keywords || q.keywords.length === 0) && (
                            <div className="p-4 text-center text-xs text-gray-400 italic">
                              No additional details for this question.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: DOCUMENTS
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'documents' && (
          <div className="space-y-3">
            {!exam.documents || exam.documents.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
                <Paperclip className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-1">No documents attached</p>
                <p className="text-xs text-gray-400">Attach documents when editing the exam.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 font-medium">{exam.documents.length} document{exam.documents.length !== 1 ? 's' : ''}</p>
                <div className="space-y-2">
                  {exam.documents.map((doc, i) => {
                    const ext = doc.fileType?.toLowerCase().replace('.', '') || 'file'
                    const colorClass = fileTypeColor[ext] || 'text-gray-500 bg-gray-50 border-gray-200'
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl bg-white hover:border-gray-300 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-gray-800 truncate block">{doc.fileName}</span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{ext}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCopy(doc.fileName, 'Filename copied')}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100"
                          title="Copy filename"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: ANALYTICS
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            {exam.questions.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
                <BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No questions to analyse yet.</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total marks',   value: totalMarks, accent: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                    { label: 'Average / Q',   value: avgMarks,   accent: 'bg-blue-50 border-blue-200 text-blue-700' },
                    { label: 'Highest mark',  value: maxMark,    accent: 'bg-violet-50 border-violet-200 text-violet-700' },
                    { label: 'Lowest mark',   value: minMark,    accent: 'bg-orange-50 border-orange-200 text-orange-700' },
                  ].map(({ label, value, accent }) => (
                    <div key={label} className={`border rounded-xl px-4 py-3.5 ${accent}`}>
                      <div className="text-2xl font-bold leading-none tabular-nums">{value}</div>
                      <div className="text-[11px] font-medium opacity-70 mt-1">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Marks distribution */}
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Marks Distribution</span>
                  </div>
                  <div className="p-5 space-y-3">
                    {Object.entries(marksBuckets)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([mark, count]) => {
                        const pct = Math.round((count / exam.questions.length) * 100)
                        return (
                          <div key={mark} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-500 w-16 flex-shrink-0 tabular-nums">
                              {mark} {Number(mark) === 1 ? 'mark' : 'marks'}
                            </span>
                            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                              <div
                                className="h-full bg-gray-900 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-600 w-20 text-right flex-shrink-0 tabular-nums">
                              {count} Q · {pct}%
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* Per-question table */}
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Question Breakdown</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {exam.questions.map(q => {
                      const pct = totalMarks > 0 ? Math.round((q.marks / totalMarks) * 100) : 0
                      return (
                        <div key={q.id} className="flex items-center gap-3 px-4 py-3">
                          <span className="w-6 h-6 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                            {q.number}
                          </span>
                          <span className="flex-1 text-xs text-gray-700 font-medium truncate">{q.text || '—'}</span>
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                            <div className="h-full bg-gray-700 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-gray-600 w-14 text-right flex-shrink-0 tabular-nums">
                            {q.marks} / {totalMarks}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}