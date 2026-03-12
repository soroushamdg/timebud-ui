'use client'

import { ChatMessage } from '@/types/ai'
import { Check, Loader2, Pin } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MessageBubbleProps {
  message: ChatMessage
  onSuggestionClick?: (suggestion: string) => void
  onConfirm?: (tools: any[]) => void
  onCancel?: () => void
  onLongPress?: (messageId: string) => void
}

export function MessageBubble({
  message,
  onSuggestionClick,
  onConfirm,
  onCancel,
  onLongPress,
}: MessageBubbleProps) {
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)

  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      if (onLongPress) {
        onLongPress(message.id)
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }
    }, 500)
    setLongPressTimer(timer)
  }

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  // System/status messages (context loading, tool results)
  if (message.role === 'system') {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-bg-card border border-border-card rounded-full px-4 py-2 flex items-center gap-2 text-sm text-text-sec">
          {message.content.includes('Loading') ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3 text-accent-green" />
          )}
          <span>{message.content}</span>
        </div>
      </div>
    )
  }

  // User messages
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%]">
          {message.isPinned && (
            <div className="flex items-center gap-1 text-xs text-text-sec mb-1 justify-end">
              <Pin className="w-3 h-3" />
              <span>Pinned</span>
            </div>
          )}
          <div
            className={`bg-accent-yellow text-black px-4 py-3 rounded-2xl rounded-br-md ${
              message.isOptimistic ? 'opacity-70' : ''
            }`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        </div>
      </div>
    )
  }

  // Assistant messages
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%]">
        {message.isPinned && (
          <div className="flex items-center gap-1 text-xs text-text-sec mb-1">
            <Pin className="w-3 h-3" />
            <span>Pinned</span>
          </div>
        )}
        <div
          className="bg-bg-card text-white px-4 py-3 rounded-2xl rounded-bl-md"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
        >
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Confirmation payload */}
          {message.confirmationPayload && (
            <div className="mt-4 border border-border-card rounded-lg p-3 bg-bg-primary">
              {message.confirmationPayload.type === 'delete' && (
                <div className="border-l-2 border-accent-pink pl-3">
                  <p className="text-sm text-text-sec mb-3">
                    {message.confirmationPayload.confirmationSummary}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onConfirm?.(message.confirmationPayload!.tools)}
                      className="flex-1 bg-accent-pink text-white font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Delete
                    </button>
                    <button
                      onClick={onCancel}
                      className="flex-1 bg-transparent border border-border-card text-white font-semibold py-2 px-4 rounded-lg hover:bg-bg-card transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {message.confirmationPayload.type === 'project_preview' && (
                <div>
                  <p className="text-sm text-text-sec mb-3">
                    {message.confirmationPayload.confirmationSummary}
                  </p>
                  {message.confirmationPayload.preview && (
                    <div className="mb-3">
                      <p className="font-semibold text-white mb-2">
                        {message.confirmationPayload.preview.name}
                      </p>
                      {message.confirmationPayload.preview.tasks && message.confirmationPayload.preview.tasks.length > 0 && (
                        <div className="space-y-1">
                          {message.confirmationPayload.preview.tasks.slice(0, 6).map((task, idx) => (
                            <div key={idx} className="text-sm text-text-sec flex items-start gap-2">
                              <span className="text-accent-yellow">•</span>
                              <span>{task.title}</span>
                            </div>
                          ))}
                          {message.confirmationPayload.preview.tasks.length > 6 && (
                            <p className="text-xs text-text-sec pl-4">
                              +{message.confirmationPayload.preview.tasks.length - 6} more tasks
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onConfirm?.(message.confirmationPayload!.tools)}
                      className="flex-1 bg-accent-yellow text-black font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Create everything
                    </button>
                    <button
                      onClick={onCancel}
                      className="flex-1 bg-transparent border border-border-card text-white font-semibold py-2 px-4 rounded-lg hover:bg-bg-card transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {message.confirmationPayload.type === 'generic' && (
                <div>
                  <p className="text-sm text-text-sec mb-3">
                    {message.confirmationPayload.confirmationSummary}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onConfirm?.(message.confirmationPayload!.tools)}
                      className="flex-1 bg-accent-yellow text-black font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={onCancel}
                      className="flex-1 bg-transparent border border-border-card text-white font-semibold py-2 px-4 rounded-lg hover:bg-bg-card transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Suggestion chips */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
            {message.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="bg-bg-card border border-border-card text-white text-sm px-4 py-2 rounded-full hover:bg-bg-card-hover transition-colors whitespace-nowrap flex-shrink-0"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Metadata (optional, collapsible) */}
        {message.metadata && (
          <div className="mt-2 text-xs text-text-sec">
            {message.metadata.contextLoaded && message.metadata.contextLoaded.length > 0 && (
              <p>Based on {message.metadata.contextLoaded.join(', ')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
