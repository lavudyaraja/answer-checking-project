import { NextRequest, NextResponse } from 'next/server'
import { evaluationStorage } from '@/lib/evaluation-storage'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/evaluate/student/report?evaluationId=xxx
// Returns a print-ready HTML report as a downloadable file.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const evaluationId = request.nextUrl.searchParams.get('evaluationId')

    if (!evaluationId) {
      return NextResponse.json({ error: 'Evaluation ID is required' }, { status: 400 })
    }

    let evaluationData: ReportData | null = null

    // ── 1. Try database first ────────────────────────────────────────────────
    try {
      const dbEval = await db.evaluation.findUnique({
        where: { id: evaluationId },
        include: {
          questionEvaluations: { include: { question: true } },
          document: true,
        },
      })

      if (dbEval) {
        let examTitle = 'Exam'
        if (dbEval.examId) {
          const exam = await db.exam.findUnique({
            where: { id: dbEval.examId },
            select: { title: true },
          })
          examTitle = exam?.title ?? 'Exam'
        }

        evaluationData = {
          id: dbEval.id,
          examTitle,
          studentName: dbEval.studentName ?? undefined,
          totalMarks: dbEval.totalMarks,
          maxMarks: dbEval.maxMarks,
          percentage: dbEval.percentage,
          grade: dbEval.grade ?? 'N/A',
          overallFeedback: dbEval.overallFeedback ?? '',
          evaluatedAt: dbEval.evaluatedAt?.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          }) ?? new Date().toLocaleDateString(),
          questionResults: dbEval.questionEvaluations.map((qe) => ({
            questionNumber: qe.question.questionNumber,
            questionText: qe.question.questionText,
            obtainedMarks: qe.obtainedMarks,
            maxMarks: qe.maxMarks,
            confidence: qe.confidence,
            strength: qe.strength ?? undefined,
            mistakes: qe.mistakes ?? undefined,
            missingConcepts: qe.missingConcepts ?? undefined,
            suggestions: qe.suggestions ?? undefined,
            // reasoning stored as JSON string — parse if needed
            reasoning:
              typeof qe.reasoning === 'string'
                ? qe.reasoning
                : JSON.stringify(qe.reasoning ?? {}),
            modelAnswer: qe.question.modelAnswer ?? undefined,
          })),
        }
      }
    } catch (dbError) {
      console.warn('DB fetch failed, falling back to memory storage:', dbError)
    }

    // ── 2. Fallback: in-memory storage ───────────────────────────────────────
    if (!evaluationData) {
      const task = evaluationStorage.getTask(evaluationId)
      if (!task?.result) {
        return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 })
      }
      evaluationData = task.result as unknown as ReportData
    }

    const html = generateReportHTML(evaluationData)
    const filename = `report-${(evaluationData.studentName ?? 'student').replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.html`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface QuestionReportResult {
  questionNumber: number
  questionText?: string
  obtainedMarks: number
  maxMarks: number
  confidence?: number
  strength?: string
  mistakes?: string
  missingConcepts?: string
  suggestions?: string
  reasoning?: string
  studentAnswer?: string
  modelAnswer?: string
}

interface ReportData {
  id?: string
  examTitle?: string
  studentName?: string
  rollNumber?: string
  subject?: string
  totalMarks: number
  maxMarks: number
  percentage: number
  grade: string
  overallFeedback?: string
  evaluatedAt?: string
  questionResults?: QuestionReportResult[]
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML generator
// ─────────────────────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  const k = grade?.charAt(0).toUpperCase() ?? 'F'
  const map: Record<string, string> = {
    A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444',
  }
  return map[k] ?? '#6b7280'
}

function scoreBarColor(pct: number): string {
  if (pct >= 70) return '#10b981'
  if (pct >= 50) return '#f59e0b'
  return '#ef4444'
}

function generateReportHTML(data: ReportData): string {
  const questions = data.questionResults ?? []
  const gColor = gradeColor(data.grade)
  const scoreColor = scoreBarColor(data.percentage)
  const date = data.evaluatedAt ?? new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const questionsHTML = questions.map((q) => {
    const pct = q.maxMarks > 0 ? (q.obtainedMarks / q.maxMarks) * 100 : 0
    const barColor = scoreBarColor(pct)
    const conf = q.confidence ?? 0

    const feedbackRows = [
      q.strength        && { label: '💪 Strengths',         color: '#d1fae5', border: '#6ee7b7', text: '#065f46', content: q.strength        },
      q.mistakes        && { label: '⚠️ Mistakes',           color: '#fee2e2', border: '#fca5a5', text: '#7f1d1d', content: q.mistakes        },
      q.missingConcepts && { label: '🔍 Missing Concepts',   color: '#ffedd5', border: '#fdba74', text: '#7c2d12', content: q.missingConcepts },
      q.suggestions     && { label: '💡 Suggestions',        color: '#dbeafe', border: '#93c5fd', text: '#1e3a8a', content: q.suggestions     },
    ].filter(Boolean) as { label: string; color: string; border: string; text: string; content: string }[]

    const marksChips = Array.from({ length: q.maxMarks })
      .map((_, i) =>
        `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;
          border-radius:6px;font-size:11px;font-weight:700;margin:2px;
          background:${i < q.obtainedMarks ? '#d1fae5' : '#f3f4f6'};
          color:${i < q.obtainedMarks ? '#065f46' : '#9ca3af'};
          border:2px solid ${i < q.obtainedMarks ? '#6ee7b7' : '#e5e7eb'};">${i + 1}</span>`
      ).join('')

    return `
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:20px;overflow:hidden;page-break-inside:avoid;">
  <!-- Question header -->
  <div style="background:#f9fafb;padding:16px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #e5e7eb;">
    <div style="width:34px;height:34px;border-radius:50%;background:#111827;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">${q.questionNumber}</div>
    <div style="flex:1;min-width:0;">
      <p style="margin:0;font-weight:600;color:#111827;font-size:14px;">${escapeHtml(q.questionText ?? `Question ${q.questionNumber}`)}</p>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <div style="flex:1;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;"></div>
        </div>
        <span style="font-size:12px;font-weight:700;color:${barColor};flex-shrink:0;">${q.obtainedMarks}/${q.maxMarks}</span>
      </div>
    </div>
    <div style="font-size:18px;font-weight:800;color:${barColor};flex-shrink:0;">${pct.toFixed(0)}%</div>
  </div>

  <!-- Answers side-by-side -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #f3f4f6;">
    <div style="padding:16px;background:#eff6ff;border-right:1px solid #e0f2fe;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.05em;">👤 Student Answer</p>
      <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${escapeHtml(q.studentAnswer ?? 'Not available')}</p>
    </div>
    <div style="padding:16px;background:#f0fdf4;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.05em;">📚 Model Answer</p>
      <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${escapeHtml(q.modelAnswer ?? 'Not provided')}</p>
    </div>
  </div>

  <!-- Feedback grid -->
  ${feedbackRows.length > 0 ? `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;padding:16px;border-bottom:1px solid #f3f4f6;">
    ${feedbackRows.map((fb) => `
    <div style="background:${fb.color};border:1px solid ${fb.border};border-radius:8px;padding:12px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${fb.text};text-transform:uppercase;">${fb.label}</p>
      <p style="margin:0;font-size:13px;color:${fb.text};line-height:1.5;">${escapeHtml(fb.content)}</p>
    </div>`).join('')}
  </div>` : ''}

  <!-- Marks breakdown + reasoning -->
  <div style="padding:16px;">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Mark Distribution</p>
    <div style="margin-bottom:10px;">${marksChips}</div>
    <div style="background:#1e293b;border-radius:8px;padding:12px;margin-top:8px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">🔍 Why This Score Was Given</p>
      <p style="margin:0;font-size:13px;color:#e2e8f0;line-height:1.6;">${escapeHtml(q.reasoning ?? 'No reasoning available.')}</p>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
      <span style="font-size:11px;color:#9ca3af;">AI Confidence:</span>
      <div style="flex:1;height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;max-width:120px;">
        <div style="height:100%;width:${conf}%;background:${scoreBarColor(conf)};border-radius:2px;"></div>
      </div>
      <span style="font-size:11px;font-weight:700;color:#6b7280;">${conf}%</span>
    </div>
  </div>
</div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Evaluation Report — ${escapeHtml(data.studentName ?? 'Student')}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#f3f4f6;color:#111827;padding:24px;}
    @media print{body{background:#fff;padding:0;}@page{margin:15mm;}}
  </style>
</head>
<body>
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#4f46e5 100%);color:#fff;padding:32px;border-radius:16px;margin-bottom:24px;text-align:center;">
    <h1 style="font-size:28px;font-weight:800;letter-spacing:-.5px;margin-bottom:6px;">🎓 Evaluation Report</h1>
    <p style="opacity:.85;font-size:15px;">${escapeHtml(data.examTitle ?? 'Exam')} · ${escapeHtml(data.studentName ?? 'Student')}</p>
    <p style="opacity:.65;font-size:13px;margin-top:4px;">Generated ${date}</p>
  </div>

  <!-- Score card -->
  <div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:24px;box-shadow:0 2px 12px rgba(0,0,0,.06);display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:24px;text-align:center;">
    <div>
      <p style="font-size:42px;font-weight:800;color:${scoreColor};">${data.totalMarks}</p>
      <p style="font-size:13px;color:#6b7280;">/ ${data.maxMarks} marks</p>
    </div>
    <div>
      <p style="font-size:42px;font-weight:800;color:${scoreColor};">${data.percentage.toFixed(1)}%</p>
      <p style="font-size:13px;color:#6b7280;">Percentage</p>
    </div>
    <div>
      <p style="font-size:42px;font-weight:800;color:${gColor};">${data.grade}</p>
      <p style="font-size:13px;color:#6b7280;">Grade</p>
    </div>
    <div>
      <p style="font-size:42px;font-weight:800;color:#374151;">${questions.length}</p>
      <p style="font-size:13px;color:#6b7280;">Questions</p>
    </div>
  </div>

  <!-- Score bar -->
  <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:24px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;">
      <span style="color:#6b7280;font-weight:600;">Overall Score</span>
      <span style="font-weight:700;color:${scoreColor};">${data.percentage.toFixed(1)}%</span>
    </div>
    <div style="height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden;">
      <div style="height:100%;width:${data.percentage}%;background:${scoreColor};border-radius:5px;"></div>
    </div>
  </div>

  ${data.overallFeedback ? `
  <!-- Overall feedback -->
  <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:24px;box-shadow:0 2px 12px rgba(0,0,0,.06);border-left:4px solid #6366f1;">
    <p style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">🧠 Overall Feedback</p>
    <div style="font-size:14px;color:#374151;line-height:1.7;white-space:pre-line;">${escapeHtml(data.overallFeedback)}</div>
  </div>` : ''}

  <!-- Questions -->
  <h2 style="font-size:18px;font-weight:700;color:#111827;margin-bottom:14px;">📋 Question-wise Analysis</h2>
  ${questionsHTML}

  <!-- Footer -->
  <div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">
    <p>Generated by AI Exam Evaluator · Powered by Gemini</p>
  </div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}