'use client'

import { useState } from 'react'
import { CreateExam, type ExamData, type Question } from '@/components/exam/create-exam'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { DEFAULT_MODELS } from '@/lib/ai/ai-provider'

export default function CreateExamPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [examData, setExamData] = useState<ExamData>({
    title: '',
    subject: '',
    duration: '',
    instructions: '',
    questionsPaper: null,
    answerModel: null,
    selectedModel: DEFAULT_MODELS[0] // Default to first available model
  })
  const [questions, setQuestions] = useState<Question[]>([])
  const [isCreating, setIsCreating] = useState(false)

  const handleExamDataChange = (delta: Partial<ExamData>) => {
    setExamData(prev => ({ ...prev, ...delta }))
  }

  const handleQuestionsChange = (newQuestions: Question[]) => {
    setQuestions(newQuestions)
  }

  const handleCreateExam = async () => {
    if (!examData.title) {
      toast({
        variant: 'destructive',
        title: 'Title required',
        description: 'Please enter an exam title.'
      })
      return
    }

    setIsCreating(true)
    
    try {
      const formData = new FormData()
      formData.append('title', examData.title)
      formData.append('subject', examData.subject)
      formData.append('duration', examData.duration.toString())
      formData.append('instructions', examData.instructions)
      formData.append('questions', JSON.stringify(questions))
      
      if (examData.questionsPaper) {
        formData.append('questionsPaper', examData.questionsPaper)
      }
      if (examData.answerModel) {
        formData.append('answerModel', examData.answerModel)
      }

      const response = await fetch('/api/exams/create', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: 'Exam created!',
          description: `"${examData.title}" created with ${questions.length} question(s).`,
        })
        
        // Reset form
        setExamData({
          title: '',
          subject: '',
          duration: '',
          instructions: '',
          questionsPaper: null,
          answerModel: null,
          selectedModel: DEFAULT_MODELS[0]
        })
        setQuestions([])
        
        // Navigate to exams list
        router.push('/exams')
      } else {
        throw new Error('Failed to create exam')
      }
    } catch (error) {
      console.error('Error creating exam:', error)
      toast({
        variant: 'destructive',
        title: 'Failed to create exam',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <CreateExam
      examData={examData}
      questions={questions}
      onExamDataChange={handleExamDataChange}
      onQuestionsChange={handleQuestionsChange}
      onCreateExam={handleCreateExam}
      isCreating={isCreating}
    />
  )
}
