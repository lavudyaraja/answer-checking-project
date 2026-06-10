'use client'

import { useState, useEffect, useCallback } from 'react'
import { ResultsHistory } from '@/components/result/results-history'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { StoredEvaluationResult } from '@/lib/results-history'
import { History, RefreshCw } from 'lucide-react'

export default function HistoryPage() {
  const { toast } = useToast()
  const router = useRouter()

  const [historyData, setHistoryData] = useState<StoredEvaluationResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => { setIsMounted(true) }, [])

  const fetchHistory = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const response = await fetch('/api/evaluate/student/history')
      if (!response.ok) throw new Error('Failed to fetch history')
      const data = await response.json()
      setHistoryData(data.evaluations || [])
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error fetching history:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading history',
        description: 'Could not fetch evaluation history. Please try again.',
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    if (!isMounted) return
    fetchHistory()
  }, [isMounted, fetchHistory])

  const handleSelectResult = (result: StoredEvaluationResult) => {
    router.push(`/dashboard/results?id=${result.id}`)
  }

  const handleDownloadReport = (result: StoredEvaluationResult) => {
    toast({
      title: 'Preparing report…',
      description: `Downloading report for ${result.studentName ?? 'student'}.`,
    })
    // downstream PDF logic hooks in here
  }

  // ── Skeleton ─────────────────────────────────────────────────────────────
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-white">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="h-6 w-32 bg-gray-100 rounded mb-2 animate-pulse" />
          <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="p-6 space-y-4 animate-pulse">
          <div className="grid grid-cols-4 gap-4">
            {[0,1,2,3].map(i => <div key={i} className="h-24 bg-gray-100" />)}
          </div>
          <div className="h-10 bg-gray-100" />
          {[0,1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-100" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 border border-gray-200 bg-gray-50">
              <History className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900">Evaluation History</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                All student evaluations · Searchable, filterable, exportable
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <p className="text-[10px] text-gray-400 hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <button
              onClick={() => fetchHistory(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 h-8 text-xs border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <div className="p-6">
        <ResultsHistory
          historyData={historyData}
          isLoading={isLoading}
          onHistoryChange={() => fetchHistory(true)}
          onSelectResult={handleSelectResult}
          onDownloadReport={handleDownloadReport}
        />
      </div>
    </div>
  )
}