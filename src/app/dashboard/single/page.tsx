'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  Upload,
  FileText,
  CheckCircle2,
  X,
  Brain,
  Zap,
  Clock,
  AlertTriangle,
  Play,
  BarChart3
} from 'lucide-react'

interface Exam {
  id: string
  title: string
  subject: string
  questionCount: number
}

interface SinglePassData {
  examId: string
  studentName: string
  rollNumber: string
  notes: string
  answerSheet: File | null
  aiProvider: 'claude' | 'groq'
}

interface SinglePassResult {
  totalMarks: number
  maxMarks: number
  percentage: number
  grade: string
  overallFeedback: string
  questionResults: Array<{
    questionNumber: number
    obtainedMarks: number
    maxMarks: number
    confidence: number
    reasoning: string
    studentAnswer: string
    semanticScore?: {
      conceptualCoverage: number
      grammarCoherence: number
      keywordRelevance: number
      completeness: number
      accuracyScore: number
      composite: number
    }
  }>
  processingTime: number
  apiCalls: number
}

export default function SinglePassTestPage() {
  const { toast } = useToast()
  const [exams, setExams] = useState<Exam[]>([])
  const [loadingExams, setLoadingExams] = useState(false)
  const [data, setData] = useState<SinglePassData>({
    examId: '',
    studentName: '',
    rollNumber: '',
    notes: '',
    answerSheet: null,
    aiProvider: 'claude'
  })
  
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState<SinglePassResult | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // Fetch available exams
  useEffect(() => {
    fetchExams()
  }, [])

  const fetchExams = async () => {
    setLoadingExams(true)
    try {
      const response = await fetch('/api/exams/list')
      if (response.ok) {
        const responseData = await response.json()
        // The API returns { exams: [...], total, page, totalPages }
        const examsData = responseData.exams || []
        setExams(examsData.map((exam: any) => ({
          id: exam.id,
          title: exam.title,
          subject: exam.subject || 'General',
          questionCount: exam.questionCount || 0
        })))
      }
    } catch (error) {
      console.error('Failed to fetch exams:', error)
      toast({
        title: 'Failed to load exams',
        description: 'Could not fetch available exams.',
        variant: 'destructive'
      })
    } finally {
      setLoadingExams(false)
    }
  }

  const onDataChange = (newData: Partial<SinglePassData>) => {
    setData(prev => ({ ...prev, ...newData }))
  }

  const handleFileUpload = (file: File) => {
    const validTypes = ['image/jpeg', 'image/png']
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload JPEG or PNG images only for single-pass testing.',
        variant: 'destructive'
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload files smaller than 10MB.',
        variant: 'destructive'
      })
      return
    }

    onDataChange({ answerSheet: file })
    toast({
      title: 'File uploaded',
      description: `${file.name} uploaded for single-pass testing.`,
    })
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const startEvaluation = async () => {
    if (!data.examId || !data.studentName || !data.answerSheet) {
      toast({
        title: 'Missing fields',
        description: 'Please select an exam, enter student name, and upload an answer sheet.',
        variant: 'destructive'
      })
      return
    }

    setIsEvaluating(true)
    setProgress(0)
    setStatus('Starting single-pass evaluation...')
    setResult(null)

    const startTime = Date.now()

    try {
      const formData = new FormData()
      formData.append('examId', data.examId || 'test-exam')
      formData.append('studentName', data.studentName)
      formData.append('rollNumber', data.rollNumber)
      formData.append('notes', data.notes)
      formData.append('answerSheet', data.answerSheet)
      formData.append('aiProvider', data.aiProvider)

      const response = await fetch('/api/evaluate-single', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Evaluation failed')
      }

      const { evaluationId } = await response.json()

      // Poll for progress
      const pollProgress = async () => {
        try {
          const progressResponse = await fetch(`/api/evaluate-single?evaluationId=${evaluationId}`)
          const progressData = await progressResponse.json()

          setProgress(progressData.progress || 0)
          setStatus(progressData.status || 'Processing...')

          if (progressData.completed) {
            const endTime = Date.now()
            const processingTime = (endTime - startTime) / 1000

            setResult({
              ...progressData.result,
              processingTime,
              apiCalls: 1 // Single-pass uses 1 API call per question
            })
            setIsEvaluating(false)
            
            toast({
              title: 'Single-pass evaluation complete!',
              description: `Processed in ${processingTime.toFixed(1)}s with 1 API call per question.`,
            })
          } else {
            setTimeout(pollProgress, 1000)
          }
        } catch (error) {
          console.error('Progress polling error:', error)
          setTimeout(pollProgress, 1000)
        }
      }

      pollProgress()

    } catch (error) {
      console.error('Evaluation error:', error)
      setIsEvaluating(false)
      toast({
        title: 'Evaluation failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
        variant: 'destructive'
      })
    }
  }

  const getGradeColor = (grade: string) => {
    switch (grade[0]) {
      case 'A': return 'bg-green-100 text-green-800'
      case 'B': return 'bg-blue-100 text-blue-800'
      case 'C': return 'bg-yellow-100 text-yellow-800'
      case 'D': return 'bg-orange-100 text-orange-800'
      default: return 'bg-red-100 text-red-800'
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Single-Pass Evaluation Testing</h1>
        <p className="text-gray-600">
          Test the new single-pass evaluation engine that processes transcription, analysis, and marking in one AI call.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Single-Pass Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="exam">Select Exam *</Label>
                <Select 
                  value={data.examId} 
                  onValueChange={(value) => onDataChange({ examId: value })}
                  disabled={loadingExams}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={loadingExams ? "Loading exams..." : "Select an exam"} />
                  </SelectTrigger>
                  <SelectContent>
                    {exams.map((exam) => (
                      <SelectItem key={exam.id} value={exam.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{exam.title}</span>
                          <span className="text-xs text-gray-500">
                            {exam.subject} • {exam.questionCount} questions
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="studentName">Student Name *</Label>
                <Input
                  id="studentName"
                  placeholder="Enter student name"
                  value={data.studentName}
                  onChange={(e) => onDataChange({ studentName: e.target.value })}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="rollNumber">Roll Number</Label>
                <Input
                  id="rollNumber"
                  placeholder="Enter roll number"
                  value={data.rollNumber}
                  onChange={(e) => onDataChange({ rollNumber: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>AI Provider</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant={data.aiProvider === 'claude' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onDataChange({ aiProvider: 'claude' })}
                    className="flex items-center gap-2"
                  >
                    <Brain className="w-4 h-4" />
                    Claude
                  </Button>
                  <Button
                    type="button"
                    variant={data.aiProvider === 'groq' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onDataChange({ aiProvider: 'groq' })}
                    className="flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Groq
                  </Button>
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <Label>Answer Sheet (Image) *</Label>
              <div
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors mt-2 ${
                  dragActive
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => e.target.files && e.target.files[0] && handleFileUpload(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Drop answer sheet here, or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  JPEG or PNG only (Max 10MB)
                </p>
              </div>

              {data.answerSheet && (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md mt-2">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        {data.answerSheet.name}
                      </p>
                      <p className="text-xs text-green-600">
                        {(data.answerSheet.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDataChange({ answerSheet: null })}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <Button
              onClick={startEvaluation}
              disabled={isEvaluating || !data.examId || !data.studentName || !data.answerSheet}
              className="w-full"
            >
              {isEvaluating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Evaluating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Single-Pass Evaluation
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Progress & Results Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Progress & Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEvaluating && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm text-gray-500">{progress.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {status}
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-gray-900">{result.percentage.toFixed(1)}%</div>
                  <Badge className={`mt-2 ${getGradeColor(result.grade)}`}>
                    {result.grade}
                  </Badge>
                  <div className="text-sm text-gray-600 mt-2">
                    {result.totalMarks} / {result.maxMarks} marks
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="font-semibold text-blue-900">{result.processingTime.toFixed(1)}s</div>
                    <div className="text-blue-600">Processing Time</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="font-semibold text-green-900">{result.apiCalls}</div>
                    <div className="text-green-600">API Calls</div>
                  </div>
                </div>

                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="details">Question Details</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Overall Feedback</h4>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {result.overallFeedback}
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="details" className="space-y-4">
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {result.questionResults.map((question, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">Question {question.questionNumber}</span>
                              <span className="text-sm text-gray-600">
                                {question.obtainedMarks} / {question.maxMarks}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mb-1">
                              Confidence: {question.confidence}%
                            </div>
                            {question.semanticScore && (
                              <div className="text-xs text-gray-500 mb-2">
                                Semantic Score: {question.semanticScore.composite}%
                              </div>
                            )}
                            <div className="text-sm text-gray-600">
                              <strong>Student Answer:</strong> {question.studentAnswer || 'No answer provided'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {!isEvaluating && !result && (
              <div className="text-center py-8 text-gray-500">
                <Brain className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Configure and start an evaluation to see results here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
