'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Sparkles, Loader2 } from 'lucide-react'
import { Question } from '@/components/exam/question-manager'

interface EvaluateSummaryProps {
  examTitle: string
  file: File | null
  questions: Question[]
  isProcessing: boolean
  processingProgress: number
  processingStatus: string
  onStartEvaluation: () => void
}

export function EvaluateSummary({
  examTitle,
  file,
  questions,
  isProcessing,
  processingProgress,
  processingStatus,
  onStartEvaluation
}: EvaluateSummaryProps) {
  const totalMaxMarks = questions.reduce((sum, q) => sum + (q.maxMarks === '' ? 0 : Number(q.maxMarks)), 0)
  const questionsWithoutRubric = questions.filter(q => !q.rubric).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Summary</CardTitle>
          <CardDescription>Review your inputs before starting evaluation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Exam Title</p>
              <p className="font-medium">{examTitle || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">File</p>
              <p className="font-medium">{file?.name || 'Not uploaded'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Number of Questions</p>
              <p className="font-medium">{questions.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Maximum Marks</p>
              <p className="font-medium">{totalMaxMarks}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-medium">Questions with Rubrics</h4>
            <div className="flex flex-wrap gap-2">
              {questions.map((q) => (
                <Badge 
                  key={q.id} 
                  variant={q.rubric ? 'default' : 'secondary'}
                  className={q.rubric ? '' : 'bg-yellow-100 text-yellow-800'}
                >
                  Q{q.questionNumber} ({q.maxMarks} marks)
                  {!q.rubric && ' - No rubric'}
                </Badge>
              ))}
            </div>
            {questionsWithoutRubric > 0 && (
              <p className="text-sm text-yellow-600 mt-2">
                ⚠️ {questionsWithoutRubric} question(s) missing rubric. AI will evaluate based on general criteria.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {!isProcessing ? (
        <Button 
          onClick={onStartEvaluation}
          disabled={!file || questions.length === 0}
          size="lg"
          className="w-full h-16 text-lg gap-3"
        >
          <Sparkles className="w-6 h-6" />
          Start AI Evaluation
        </Button>
      ) : (
        <Card className="border-2">
          <CardContent className="p-8 text-center space-y-4">
            <Loader2 className="w-16 h-16 animate-spin mx-auto text-primary" />
            <div>
              <h3 className="text-xl font-semibold mb-2">{processingStatus}</h3>
              <Progress value={processingProgress} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {processingProgress}% complete
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Processing large documents may take several minutes. Please wait...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
