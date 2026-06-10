'use client'

import { useParams, useRouter } from 'next/navigation'
import ExamEdit from '@/components/exam/exam-edit'

export default function ExamEditPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string

  const handleBack = () => {
    router.push('/exams')
  }

  const handleSave = () => {
    router.push(`/exams/${examId}`)
  }

  return (
    <ExamEdit
      examId={examId}
      onBack={handleBack}
      onSave={handleSave}
    />
  )
}
