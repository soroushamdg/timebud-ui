'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, X } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { ChatAPIRequest, ChatAPIResponse } from '@/types/ai'

interface QuickCaptureSheetProps {
  onClose: () => void
  onSuccess: (message: string) => void
}

export function QuickCaptureSheet({ onClose, onSuccess }: QuickCaptureSheetProps) {
  const router = useRouter()
  const { messages, addUserMessage, addAssistantMessage, addStatusMessage } = useChatStore()

  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    isRecording,
    isTranscribing,
    ringRefs,
    toggle: toggleRecording,
    error: recorderError,
  } = useVoiceRecorder({
    onTranscribed: (transcribed) => setText((prev) => (prev ? `${prev} ${transcribed}` : transcribed)),
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (recorderError) setError(recorderError)
  }, [recorderError])

  const goTo = (path: string) => {
    onClose()
    router.push(path)
  }

  const handleSend = async () => {
    const content = text.trim()
    if (!content || isSending) return

    setIsSending(true)
    setError(null)

    // Same construction as the /chat page's send flow: capture history before this
    // message lands in the store, then append it for the request body.
    const conversationMessages = messages.map((msg) => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.content,
    }))
    conversationMessages.push({ role: 'user', content })
    addUserMessage(content)

    try {
      const requestBody: ChatAPIRequest = {
        messages: conversationMessages,
        complexity: 'complex',
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const data: ChatAPIResponse = await response.json()

      if (!data.success) {
        setError(data.error?.message || 'Failed to reach the AI assistant')
        return
      }

      if (data.toolsExecuted && data.toolsExecuted.length > 0) {
        for (const tool of data.toolsExecuted) {
          addStatusMessage(tool.success ? `✓ ${tool.summary}` : `✗ ${tool.summary}`, tool.success ? 'success' : 'error')
        }
      }

      const aiResponse = data.response!

      if (aiResponse.action === 'execute_tools' && !aiResponse.requiresConfirmation) {
        // Auto-executed — done, no need to leave the sheet.
        addAssistantMessage(aiResponse.message || '', aiResponse.suggestions, aiResponse.metadata, undefined, aiResponse)
        onSuccess(aiResponse.message || 'Done')
        onClose()
        return
      }

      // Anything that needs more back-and-forth (a clarifying question, a confirmation,
      // a project-creation preview, etc.) — record it in the shared chat history and
      // hand off to the full chat screen rather than trying to handle it in this sheet.
      const confirmationPayload =
        aiResponse.action === 'execute_tools' && aiResponse.requiresConfirmation
          ? {
              type: (aiResponse.tools?.some((t) => t.name.includes('delete')) ? 'delete' : 'generic') as
                | 'delete'
                | 'generic',
              tools: aiResponse.tools || [],
              confirmationSummary: aiResponse.confirmationSummary || 'Confirm this action?',
            }
          : aiResponse.action === 'preview_creation'
            ? {
                type: 'project_preview' as const,
                tools: aiResponse.tools || [],
                confirmationSummary: aiResponse.message || 'Review and confirm',
                preview: aiResponse.preview,
              }
            : undefined

      addAssistantMessage(aiResponse.message || '', aiResponse.suggestions, aiResponse.metadata, confirmationPayload, aiResponse)
      goTo('/chat')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach the AI assistant')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-scrim/70 z-[100] flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-bg-primary rounded-t-3xl p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text-primary text-xl font-bold">Quick capture</h2>
          <button onClick={onClose} className="text-text-sec">
            <X className="w-6 h-6" />
          </button>
        </div>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind?"
          rows={3}
          className="w-full bg-bg-card border border-border-card rounded-2xl px-4 py-3 text-text-primary placeholder-text-sec focus:outline-none focus:border-accent-yellow resize-none mb-3"
        />

        {error && <p className="text-accent-pink text-sm mb-3">{error}</p>}

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-shrink-0 w-11 h-11">
            {isRecording && [0, 1, 2].map((i) => (
              <div
                key={i}
                ref={(el) => { ringRefs.current[i] = el }}
                className="absolute inset-0 rounded-full border-2 border-accent-pink pointer-events-none"
                style={{ opacity: 0, transform: 'scale(1)' }}
              />
            ))}
            <button
              onClick={toggleRecording}
              disabled={isTranscribing}
              className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
                isRecording ? 'bg-accent-pink' : 'bg-bg-card border border-border-card'
              }`}
            >
              {isRecording ? <Square className="w-4 h-4 text-on-dark-accent" /> : <Mic className="w-5 h-5 text-text-primary" />}
            </button>
          </div>
          {isTranscribing && <span className="text-text-sec text-sm">Transcribing...</span>}

          <button
            onClick={handleSend}
            disabled={!text.trim() || isSending}
            className="flex-1 bg-accent-yellow text-on-light-accent font-bold py-3 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>

        <div className="flex items-center justify-center gap-6 text-sm">
          <button onClick={() => goTo('/tasks/new')} className="text-text-sec hover:text-text-primary transition-colors">
            Full job form
          </button>
          <button onClick={() => goTo('/projects/new')} className="text-text-sec hover:text-text-primary transition-colors">
            New mission
          </button>
        </div>
      </div>
    </div>
  )
}
