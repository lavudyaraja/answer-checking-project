'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface EvaluationProgress {
  fileId: string
  progress: number
  status: string
  completed: boolean
  error?: string
}

export function useEvaluationProgress(fileId: string | null) {
  const [progress, setProgress] = useState<EvaluationProgress | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!fileId) return

    // Connect to WebSocket service
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling']
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to progress service')
      setIsConnected(true)
      socket.emit('join-evaluation', fileId)
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from progress service')
      setIsConnected(false)
    })

    socket.on('progress-update', (data: EvaluationProgress) => {
      console.log('Progress update:', data)
      setProgress(data)
    })

    // Request current progress on connect
    socket.on('connect', () => {
      socket.emit('get-progress', fileId, (currentProgress: EvaluationProgress | null) => {
        if (currentProgress) {
          setProgress(currentProgress)
        }
      })
    })

    return () => {
      if (fileId) {
        socket.emit('leave-evaluation', fileId)
      }
      socket.disconnect()
    }
  }, [fileId])

  return { progress, isConnected }
}
