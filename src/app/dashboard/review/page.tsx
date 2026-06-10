'use client'
// app/(review)/review/page.tsx  — or wherever your route lives

import { useState, useEffect, useCallback } from 'react'
import { ReviewPage } from '@/components/review/review-page'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw } from 'lucide-react'

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

export default function ReviewPageRoute() {
  const { toast } = useToast()
  const [evaluationResults, setEvaluationResults] = useState<EvaluationResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvaluationResults = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/evaluate/evaluations', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // Prevent stale cache
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setEvaluationResults(data.evaluations || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      toast({
        title: 'Failed to Load',
        description: 'Could not fetch evaluations. Please try again.',
        variant: 'destructive'
      })
      setEvaluationResults([])
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchEvaluationResults()
  }, [fetchEvaluationResults])

  if (error && !isLoading && evaluationResults.length === 0) {
    return (
      <div className="container mx-auto py-12 flex flex-col items-center gap-4">
        <div className="text-center max-w-sm">
          <p className="text-sm font-semibold text-gray-700 mb-1">Failed to load evaluations</p>
          <p className="text-xs text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchEvaluationResults}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <ReviewPage
        evaluationResults={evaluationResults}
        onRefreshResults={fetchEvaluationResults}
        isLoading={isLoading}
      />
    </div>
  )
}