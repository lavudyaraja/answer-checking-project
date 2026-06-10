'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CreateExam, Question, ExamData } from './create-exam'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react'

interface Exam {
  id: string
  title: string
  subject: string
  description: string
  instructions: string
  questions: Question[]
}

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'

interface ExamEditProps {
  examId: string
  onBack: () => void
  onSave: () => void
}

export default function ExamEdit({ examId, onBack, onSave }: ExamEditProps) {
  const { toast } = useToast()
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const dirtyRef = useRef(false)

  const [examData, setExamData] = useState<ExamData>({
    title: '',
    subject: '',
    instructions: '',
    duration: '',
    questionsPaper: null,
    answerModel: null,
  })
  const [questions, setQuestions] = useState<Question[]>([])

  useEffect(() => {
    fetchExam()
  }, [examId])

  // Mark dirty on any change after initial load
  const handleExamDataChange = useCallback((delta: Partial<ExamData>) => {
    setExamData(prev => ({ ...prev, ...delta }))
    if (!loading) {
      dirtyRef.current = true
      setSaveStatus('unsaved')
    }
  }, [loading])

  const handleQuestionsChange = useCallback((qs: Question[]) => {
    setQuestions(qs)
    if (!loading) {
      dirtyRef.current = true
      setSaveStatus('unsaved')
    }
  }, [loading])

  const fetchExam = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/exams/${examId}`)
      if (res.ok) {
        const data = await res.json()
        setExam(data)
        setExamData({
          title: data.title,
          subject: data.subject,
          instructions: data.instructions,
          duration: '',
          questionsPaper: null,
          answerModel: null,
        })
        setQuestions(data.questions.map((q: any) => ({ ...q, rubric: q.rubric || '' })))
        setSaveStatus('idle')
      } else throw new Error()
    } catch {
      toast({ title: 'Error', description: 'Failed to load exam.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const validate = (): string[] => {
    const errors: string[] = []
    if (!examData.title.trim()) errors.push('Exam title is required.')
    if (questions.length === 0) errors.push('At least one question is required.')
    questions.forEach((q, i) => {
      if (!q.text.trim()) errors.push(`Question ${i + 1} is missing question text.`)
      if (Number(q.marks) <= 0) errors.push(`Question ${i + 1} must have marks > 0.`)
    })
    return errors
  }

  const handleSave = async () => {
    const errors = validate()
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors([])

    try {
      setSaving(true)
      setSaveStatus('saving')

      const payload = {
        title: examData.title,
        description: examData.instructions,
        subject: examData.subject,
        questions: questions.map(q => ({
          id: q.id,
          number: q.number,
          text: q.text,
          modelAnswer: q.modelAnswer,
          rubric: q.rubric,
          marks: q.marks,
          keywords: q.keywords,
        })),
      }

      const res = await fetch(`/api/exams/${examId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setSaveStatus('saved')
        setLastSaved(new Date())
        dirtyRef.current = false
        toast({ title: 'Saved', description: 'Exam updated successfully.' })
        setTimeout(() => onSave(), 800)
      } else {
        const err = await res.json()
        throw new Error(err.error || 'Save failed')
      }
    } catch (e: any) {
      setSaveStatus('error')
      toast({ title: 'Save failed', description: e.message || 'Please try again.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const StatusIndicator = () => {
    const map: Record<SaveStatus, { icon: React.ReactNode; text: string; color: string }> = {
      idle: { icon: null, text: '', color: '' },
      unsaved: {
        icon: <Clock className="w-3.5 h-3.5" />,
        text: 'Unsaved changes',
        color: 'text-amber-600',
      },
      saving: {
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
        text: 'Saving…',
        color: 'text-gray-500',
      },
      saved: {
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        text: lastSaved ? `Saved at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved',
        color: 'text-green-600',
      },
      error: {
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        text: 'Save failed',
        color: 'text-red-500',
      },
    }
    const s = map[saveStatus]
    if (!s.text) return null
    return (
      <span className={`flex items-center gap-1.5 text-xs font-medium ${s.color}`}>
        {s.icon}
        {s.text}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-3 text-sm text-gray-500">Loading exam…</span>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="text-center py-16 border border-dashed border-gray-200 rounded">
        <p className="text-sm text-gray-500 mb-4">Exam not found.</p>
        <button onClick={onBack} className="text-sm text-gray-700 underline">Back to exams</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────── */}
      <div className="border-b border-gray-200 pb-5 flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">
            Editing Exam
          </p>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight truncate">{exam.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusIndicator />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Validation Errors ─────────────────────────── */}
      {validationErrors.length > 0 && (
        <div className="border border-red-200 rounded p-4 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-red-700">Please fix these issues before saving:</span>
          </div>
          <ul className="space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i} className="text-sm text-red-600 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0 mt-0.5" />
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Edit Form ─────────────────────────────────── */}
      <CreateExam
        examData={examData}
        questions={questions}
        onExamDataChange={handleExamDataChange}
        onQuestionsChange={handleQuestionsChange}
        onCreateExam={handleSave}
        isCreating={saving}
      />

      {/* ── Bottom Save Bar ───────────────────────────── */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-white py-3 flex items-center justify-between">
        <StatusIndicator />
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm border border-gray-200 rounded text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}