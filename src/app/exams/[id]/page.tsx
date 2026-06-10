'use client'

import { useParams, useRouter } from 'next/navigation'
import ExamView from '@/components/exam/exam-view'

export default function ExamViewPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string

  const handleBack = () => {
    router.push('/exams')
  }

  const handleEdit = (examId: string) => {
    router.push(`/exams/${examId}/edit`)
  }

  const handleDelete = (examId: string, examTitle: string) => {
    if (confirm(`Delete "${examTitle}"? This cannot be undone.`)) {
      // Delete logic here
      fetch(`/api/exams/${examId}`, { method: 'DELETE' })
        .then(res => {
          if (res.ok) {
            router.push('/exams')
          } else {
            alert('Failed to delete exam')
          }
        })
        .catch(() => {
          alert('Failed to delete exam')
        })
    }
  }

  return (
    <ExamView
      examId={examId}
      onBack={handleBack}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  )
}
