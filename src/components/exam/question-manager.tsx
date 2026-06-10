'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
// FIX #6: ScrollArea removed — fixed height clips content; let cards grow naturally
import { FileText, Plus, Trash2 } from 'lucide-react'

export interface Question {
  id: string
  questionNumber: number
  questionText: string
  maxMarks: number | ''   // FIX #8: allow '' so input can be visually empty
  modelAnswer: string
  rubric: string
}

// FIX #7: typed union instead of `any`
type QuestionFieldValue = string | number | ''

interface QuestionManagerProps {
  questions: Question[]
  onAddQuestion: () => void
  onRemoveQuestion: (id: string) => void
  onUpdateQuestion: (id: string, field: keyof Question, value: QuestionFieldValue) => void
}

export function QuestionManager({
  questions,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
}: QuestionManagerProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Questions &amp; Rubrics</h3>
          <p className="text-sm text-muted-foreground">
            Add questions with maximum marks, model answers, and grading rubrics
          </p>
        </div>
        <Button onClick={onAddQuestion} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Question
        </Button>
      </div>

      {/* FIX #6: no fixed-height scroll area — render all cards */}
      <div className="space-y-4">
        {questions.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No questions added yet. Click &ldquo;Add Question&rdquo; to begin.
            </p>
          </Card>
        ) : (
          questions.map((question) => (
            <Card key={question.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  Q{question.questionNumber}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveQuestion(question.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Question text */}
                <div>
                  <Label htmlFor={`qt-${question.id}`}>Question Text</Label>
                  <Textarea
                    id={`qt-${question.id}`}
                    placeholder="Enter the question text…"
                    value={question.questionText}
                    onChange={(e) =>
                      onUpdateQuestion(question.id, 'questionText', e.target.value)
                    }
                    className="mt-2"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Max marks — FIX #8: show empty string, not 0 */}
                  <div>
                    <Label htmlFor={`marks-${question.id}`}>Maximum Marks</Label>
                    <Input
                      id={`marks-${question.id}`}
                      type="number"
                      placeholder="e.g. 10"
                      value={question.maxMarks === 0 ? '' : question.maxMarks}
                      onChange={(e) => {
                        const raw = e.target.value
                        onUpdateQuestion(
                          question.id,
                          'maxMarks',
                          raw === '' ? '' : parseFloat(raw)
                        )
                      }}
                      className="mt-2"
                    />
                  </div>

                  {/* Question number — FIX #9: show empty string when 0/falsy */}
                  <div>
                    <Label htmlFor={`qnum-${question.id}`}>Question Number</Label>
                    <Input
                      id={`qnum-${question.id}`}
                      type="number"
                      placeholder="e.g. 1"
                      value={question.questionNumber === 0 ? '' : question.questionNumber}
                      onChange={(e) => {
                        const raw = e.target.value
                        onUpdateQuestion(
                          question.id,
                          'questionNumber',
                          raw === '' ? '' : parseInt(raw, 10)
                        )
                      }}
                      className="mt-2"
                    />
                  </div>
                </div>

                {/* Model answer */}
                <div>
                  <Label htmlFor={`model-${question.id}`}>Model Answer (Optional)</Label>
                  <Textarea
                    id={`model-${question.id}`}
                    placeholder="Enter the model or expected answer…"
                    value={question.modelAnswer}
                    onChange={(e) =>
                      onUpdateQuestion(question.id, 'modelAnswer', e.target.value)
                    }
                    className="mt-2"
                    rows={3}
                  />
                </div>

                {/* Rubric */}
                <div>
                  <Label htmlFor={`rubric-${question.id}`}>Grading Rubric</Label>
                  <Textarea
                    id={`rubric-${question.id}`}
                    placeholder="Enter detailed grading criteria (e.g., 'Step 1: Correct formula (2 marks), Step 2: Correct calculation (3 marks)')"
                    value={question.rubric}
                    onChange={(e) =>
                      onUpdateQuestion(question.id, 'rubric', e.target.value)
                    }
                    className="mt-2"
                    rows={4}
                  />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}