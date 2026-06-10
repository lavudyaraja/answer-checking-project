'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { FileImage } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ExamUploadProps {
  examTitle: string
  examDescription: string
  file: File | null
  onExamTitleChange: (value: string) => void
  onExamDescriptionChange: (value: string) => void
  onFileUpload: (file: File) => void
}

const VALID_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']

export function ExamUpload({
  examTitle,
  examDescription,
  file,
  onExamTitleChange,
  onExamDescriptionChange,
  onFileUpload,
}: ExamUploadProps) {
  // FIX #11: state-based error instead of alert()
  const [fileError, setFileError] = useState<string | null>(null)
  // FIX #10: drag state for visual feedback
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = (selectedFile: File) => {
    setFileError(null)
    const isValid =
      selectedFile.type === 'application/pdf' ||
      selectedFile.type.startsWith('image/')
    if (!isValid) {
      setFileError('Please upload a PDF or image file (PNG, JPG, WEBP).')
      return
    }
    onFileUpload(selectedFile)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) handleFile(selectedFile)
  }

  // FIX #10: drag-and-drop actually works now
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <Label htmlFor="examTitle">Exam Title</Label>
        <Input
          id="examTitle"
          placeholder="e.g., Final Mathematics Examination"
          value={examTitle}
          onChange={(e) => onExamTitleChange(e.target.value)}
          className="mt-2"
        />
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="examDescription">Description (Optional)</Label>
        <Textarea
          id="examDescription"
          placeholder="Add any additional context about the exam…"
          value={examDescription}
          onChange={(e) => onExamDescriptionChange(e.target.value)}
          className="mt-2"
          rows={3}
        />
      </div>

      {/* Upload area — FIX #10: drag and drop now functional */}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-slate-300 dark:border-slate-700 hover:border-primary'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <input
          type="file"
          accept=".pdf,image/*"
          onChange={handleInputChange}
          className="hidden"
          id="file-upload"
        />
        <FileImage className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">
          Click to upload or drag and drop
        </p>
        <p className="text-sm text-muted-foreground">
          PDF or Image files (supports 100+ pages)
        </p>
      </div>

      {/* FIX #11: inline error message instead of alert() */}
      {fileError && (
        <p className="text-sm text-red-600 font-medium">{fileError}</p>
      )}

      {/* File preview */}
      {file && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileImage className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800"
              >
                Ready
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}