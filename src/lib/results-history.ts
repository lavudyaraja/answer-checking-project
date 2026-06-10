/**
 * results-history.ts
 * 
 * Manages storage and retrieval of all evaluation results
 * Uses localStorage for client-side persistence
 */

export interface StoredEvaluationResult {
  id: string
  examTitle?: string
  studentName?: string
  rollNumber?: string
  subject?: string
  date?: string
  totalMarks: number
  maxMarks: number
  percentage: number
  grade: string
  overallFeedback?: string
  questionResults: any[]
  createdAt: string
  evaluatedAt: string
}

const STORAGE_KEY = 'evaluation_results_history'

// ─── Storage Operations ────────────────────────────────────────────────────────

export function saveEvaluationResult(result: StoredEvaluationResult): void {
  try {
    // Check if we're on the client side
    if (typeof window === 'undefined') {
      return
    }
    const existing = getAllEvaluationResults()
    const updated = [result, ...existing.filter(r => r.id !== result.id)]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Failed to save evaluation result:', error)
  }
}

export function getAllEvaluationResults(): StoredEvaluationResult[] {
  try {
    // Check if we're on the client side
    if (typeof window === 'undefined') {
      return []
    }
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to load evaluation results:', error)
    return []
  }
}

export function getEvaluationResult(id: string): StoredEvaluationResult | null {
  try {
    const results = getAllEvaluationResults()
    return results.find(r => r.id === id) || null
  } catch (error) {
    console.error('Failed to get evaluation result:', error)
    return null
  }
}

export function deleteEvaluationResult(id: string): void {
  try {
    // Check if we're on the client side
    if (typeof window === 'undefined') {
      return
    }
    const existing = getAllEvaluationResults()
    const updated = existing.filter(r => r.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Failed to delete evaluation result:', error)
  }
}

export function clearAllEvaluationResults(): void {
  try {
    // Check if we're on the client side
    if (typeof window === 'undefined') {
      return
    }
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear evaluation results:', error)
  }
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

export function getResultsCount(): number {
  return getAllEvaluationResults().length
}

export function getRecentResults(limit: number = 5): StoredEvaluationResult[] {
  return getAllEvaluationResults().slice(0, limit)
}

export function getResultsByStudent(studentName: string): StoredEvaluationResult[] {
  const all = getAllEvaluationResults()
  return all.filter(r => 
    r.studentName?.toLowerCase().includes(studentName.toLowerCase())
  )
}

export function getResultsByDateRange(startDate: Date, endDate: Date): StoredEvaluationResult[] {
  const all = getAllEvaluationResults()
  return all.filter(r => {
    const resultDate = new Date(r.evaluatedAt)
    return resultDate >= startDate && resultDate <= endDate
  })
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface EvaluationStats {
  totalEvaluations: number
  averageScore: number
  highestScore: number
  lowestScore: number
  gradeDistribution: Record<string, number>
  recentTrend: 'improving' | 'declining' | 'stable'
}

export function getEvaluationStats(): EvaluationStats {
  const results = getAllEvaluationResults()
  
  if (results.length === 0) {
    return {
      totalEvaluations: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      gradeDistribution: {},
      recentTrend: 'stable'
    }
  }

  const scores = results.map(r => r.percentage)
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length
  const highestScore = Math.max(...scores)
  const lowestScore = Math.min(...scores)

  const gradeDistribution: Record<string, number> = {}
  results.forEach(r => {
    const grade = r.grade.charAt(0) // Get first letter (A, B, C, D, F)
    gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1
  })

  // Calculate recent trend (compare last 3 with previous 3)
  let recentTrend: 'improving' | 'declining' | 'stable' = 'stable'
  if (results.length >= 6) {
    const recent = results.slice(0, 3).map(r => r.percentage)
    const previous = results.slice(3, 6).map(r => r.percentage)
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length
    
    if (recentAvg > previousAvg + 2) recentTrend = 'improving'
    else if (recentAvg < previousAvg - 2) recentTrend = 'declining'
  }

  return {
    totalEvaluations: results.length,
    averageScore,
    highestScore,
    lowestScore,
    gradeDistribution,
    recentTrend
  }
}
