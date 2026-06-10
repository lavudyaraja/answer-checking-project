'use client'

import { useState, useEffect, Suspense } from 'react'
import { ResultsPage } from '@/components/result/results-page'
import { EvaluationResults, EvaluationResultsSkeleton } from '@/components/result/evaluation-results'
import { useToast } from '@/hooks/use-toast'
import { useRouter, useSearchParams } from 'next/navigation'

function ResultsContent() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Get result ID from URL
  const resultId = searchParams.get('id')

  useEffect(() => {
    // Check sessionStorage for direct result data (from evaluation flow)
    if (!resultId) {
      try {
        const storedResult = sessionStorage.getItem('evaluationResult')
        const storedMetadata = sessionStorage.getItem('evaluationMetadata')
        
        if (storedResult && storedMetadata) {
          const result = JSON.parse(storedResult)
          const metadata = JSON.parse(storedMetadata)
          
          // Combine result with metadata
          setResult({
            ...result,
            ...metadata
          })
          setIsLoading(false)
          
          // Clear sessionStorage after loading
          sessionStorage.removeItem('evaluationResult')
          sessionStorage.removeItem('evaluationMetadata')
          return
        }
      } catch (error) {
        console.error('Error loading stored result:', error)
      }
      
      setIsLoading(false)
      return
    }

    let cancelled = false
    let attempts = 0
    const maxAttempts = 30 // ~60s with 2s delay
    const delayMs = 2000
    let progressToastShown = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const fetchResult = async () => {
      if (cancelled) return
      attempts += 1

      try {
        const response = await fetch(
          `/api/evaluate/student/result?evaluationId=${encodeURIComponent(resultId)}`
        )

        if (response.status === 404) {
          toast({
            variant: 'destructive',
            title: 'Evaluation Not Found',
            description: 'The requested evaluation could not be found in the system.'
          })
          router.push('/dashboard/history')
          return
        }

        if (response.status === 202) {
          if (!progressToastShown) {
            progressToastShown = true
            toast({
              title: 'Evaluation in Progress',
              description: 'Generating evaluation results...'
            })
          }

          if (attempts < maxAttempts) {
            if (timeoutId) clearTimeout(timeoutId)
            timeoutId = setTimeout(fetchResult, delayMs)
            return
          }

          // Timed out waiting for result
          toast({
            variant: 'destructive',
            title: 'Still processing',
            description: 'Result is taking longer than expected. Please try again from History.'
          })
          setIsLoading(false)
          return
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          throw new Error(errorData?.error || 'Failed to fetch result')
        }

        const data = await response.json()
        if (cancelled) return
        
        // Debug: Log the response structure
        console.log('API Response:', data)
        console.log('Question results count:', data.questionResults?.length || data.questions?.length || data.evaluations?.length || 0)
        
        // Ensure the data has the expected structure
        const questionData = data.questionResults || data.questions || data.evaluations || []
        const normalizedData = {
          ...data,
          questions: questionData,
          questionResults: questionData
        }
        
        console.log('Normalized data:', normalizedData)
        console.log('First question:', questionData[0])
        
        setResult(normalizedData)
        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching result:', error)
        toast({
          variant: 'destructive',
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to load evaluation result'
        })
        if (!cancelled) setIsLoading(false)
        router.push('/dashboard/history')
      }
    }

    setIsLoading(true)
    fetchResult()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [resultId, toast, router])

  const handleReEvaluate = () => {
    toast({
      title: 'Re-evaluation',
      description: 'Starting re-evaluation process...'
    })
  }

  const handleEvaluateAnother = () => {
    toast({
      title: 'New Evaluation',
      description: 'Redirecting to evaluation page...'
    })
    router.push('/evaluate')
  }

  const handleDownloadReport = async () => {
    if (!result?.id) return

    try {
      const response = await fetch(`/api/evaluate/student/report?evaluationId=${result.id}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report-${result.studentName?.replace(/\s+/g, '-') || 'result'}.html`
        document.body.appendChild(a)
        a.click()
        URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast({
          title: 'Report Downloaded',
          description: 'Report has been downloaded successfully'
        })
      } else {
        throw new Error('Failed to generate report')
      }
    } catch (error) {
      console.error('Error downloading report:', error)
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: 'Failed to generate and download report'
      })
    }
  }

  if (isLoading) {
    return <EvaluationResultsSkeleton />
  }

  if (!result || (!result.questions && !result.questionResults && !result.evaluations)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Results</h1>
          <p className="text-muted-foreground">
            No evaluation result found
          </p>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">The requested evaluation result could not be found.</p>
          {result && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-600">Debug info:</p>
              <pre className="text-xs text-gray-500 mt-2">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
          <button
            onClick={() => router.push('/dashboard/history')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 mt-4"
          >
            Back to History
          </button>
        </div>
      </div>
    )
  }

  return (
    <ResultsPage
      result={result}
      onReEvaluate={handleReEvaluate}
      onEvaluateAnother={handleEvaluateAnother}
      onDownloadReport={handleDownloadReport}
    />
  )
}

export default function ResultsPageRoute() {
  return (
    <Suspense fallback={<EvaluationResultsSkeleton />}>
      <ResultsContent />
    </Suspense>
  )
}
