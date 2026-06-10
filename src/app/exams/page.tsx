'use client'

import ExamManagement from '@/components/exam/exam-management'
import { useRouter } from 'next/navigation'

export default function ExamsPage() {
  const router = useRouter()

  const handleCreateNew = () => {
    router.push('/exams/create')
  }

  const handleEditExam = (examId: string) => {
    router.push(`/exams/${examId}/edit`)
  }

  const handleViewExam = (examId: string) => {
    router.push(`/exams/${examId}`)
  }

  return (
    <ExamManagement
      onCreateNew={handleCreateNew}
      onEditExam={handleEditExam}
      onViewExam={handleViewExam}
    />
  )
}
