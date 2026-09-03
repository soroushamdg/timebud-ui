'use client'

import { ChatMessage } from '@/types/ai'
import { Check, Loader2, Pin } from 'lucide-react'
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { WarningBanner } from './WarningBanner'
import { SessionPlanPreview } from './SessionPlanPreview'
import { LearningOpportunity } from './LearningOpportunity'
import { ActionButtonGroup } from './ActionButtonGroup'
import { SuggestedActions } from './SuggestedActions'

// Shared iMessage-style entrance for every bubble type: a slight pop (scale up from
// 0.8) and upward drift, with a spring instead of a linear ease so it has some
// bounce/weight to it rather than a flat fade. `layout` lets Framer Motion animate
// this bubble's position smoothly whenever something ABOVE or BELOW it in the list
// changes size (e.g. a confirmation card collapsing) instead of everything jumping.
const bubbleMotionProps = {
  layout: true as const,
  initial: { opacity: 0, scale: 0.8, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.85, transition: { duration: 0.15 } },
  transition: { type: 'spring' as const, stiffness: 500, damping: 35, mass: 0.8 },
}

interface MessageBubbleProps {
  message: ChatMessage
  onSuggestionClick?: (suggestion: string) => void
  onConfirm?: (tools: any[]) => void
  onCancel?: () => void
  onLongPress?: (messageId: string) => void
  onButtonExecuted?: (messageId: string, buttonId: string) => void
  onDismissLearning?: (messageId: string) => void
  onStartSession?: (sessionPlan: any) => void
}

export function MessageBubble({
  message,
  onSuggestionClick,
  onConfirm,
  onCancel,
  onLongPress,
  onButtonExecuted,
  onDismissLearning,
  onStartSession,
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
      <motion.div className="flex justify-center my-2" {...bubbleMotionProps}>
        <div className="bg-bg-card border border-border-card rounded-full px-4 py-2 flex items-center gap-2 text-sm text-text-sec">
          {message.content.includes('Loading') ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3 text-accent-green" />
          )}
          <span>{message.content}</span>
        </div>
      </motion.div>
    )
  }

  // User messages
  if (message.role === 'user') {
    return (
      <motion.div className="flex justify-end mb-4" {...bubbleMotionProps}>
        <div className="max-w-[85%]">
          {message.isPinned && (
            <div className="flex items-center gap-1 text-xs text-text-sec mb-1 justify-end">
              <Pin className="w-3 h-3" />
              <span>Pinned</span>
            </div>
          )}
          <div
            className={`bg-accent-yellow text-on-light-accent px-4 py-3 rounded-2xl rounded-br-md ${
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
      </motion.div>
    )
  }

  // Assistant messages
  return (
    <motion.div className="flex justify-start items-start gap-2 mb-4" {...bubbleMotionProps}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bud/bud-avatar.png"
        alt="Bud"
        className="w-6 h-6 rounded-full flex-shrink-0 mt-1 object-cover"
      />
      <div className="max-w-[85%]">
        {message.isPinned && (
          <div className="flex items-center gap-1 text-xs text-text-sec mb-1">
            <Pin className="w-3 h-3" />
            <span>Pinned</span>
          </div>
        )}
        <motion.div
          layout
          className="bg-bg-card text-text-primary px-4 py-3 rounded-2xl rounded-bl-md"
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

          {/* Warnings */}
          {message.warnings && message.warnings.length > 0 && (
            <WarningBanner warnings={message.warnings} />
          )}

          {/* Session Plan Preview */}
          {message.sessionPlan && (
            <SessionPlanPreview
              plan={message.sessionPlan}
              onStartSession={() => onStartSession?.(message.sessionPlan)}
              onAdjustTime={() => onSuggestionClick?.('Plan a different session time')}
            />
          )}

          {/* Confirmation payload — animated separately so confirming/cancelling
              collapses just this card (with the bubble reflowing via `layout`
              above) instead of the whole message popping or jumping. */}
          <AnimatePresence>
          {message.confirmationPayload && (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="overflow-hidden"
            >
            <div className="border border-border-card rounded-lg p-3 bg-bg-primary">
              {message.confirmationPayload.type === 'delete' && (
                <div className="border-l-2 border-accent-pink pl-3">
                  <p className="text-sm text-text-sec mb-3">
                    {message.confirmationPayload.confirmationSummary}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onConfirm?.(message.confirmationPayload!.tools)}
                      className="flex-1 bg-accent-pink text-on-dark-accent font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Delete
                    </button>
                    <button
                      onClick={onCancel}
                      className="flex-1 bg-transparent border border-border-card text-text-primary font-semibold py-2 px-4 rounded-lg hover:bg-bg-card transition-colors"
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
                      <p className="font-semibold text-text-primary mb-2">
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
                              +{message.confirmationPayload.preview.tasks.length - 6} more jobs
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onConfirm?.(message.confirmationPayload!.tools)}
                      className="flex-1 bg-accent-yellow text-on-light-accent font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Create everything
                    </button>
                    <button
                      onClick={onCancel}
                      className="flex-1 bg-transparent border border-border-card text-text-primary font-semibold py-2 px-4 rounded-lg hover:bg-bg-card transition-colors"
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
                      className="flex-1 bg-accent-yellow text-on-light-accent font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={onCancel}
                      className="flex-1 bg-transparent border border-border-card text-text-primary font-semibold py-2 px-4 rounded-lg hover:bg-bg-card transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            </motion.div>
          )}
          </AnimatePresence>
        </motion.div>

        {/* Learning Opportunity */}
        {message.learningOpportunity && (
          <LearningOpportunity
            opportunity={message.learningOpportunity}
            messageId={message.id}
            onDismiss={() => onDismissLearning?.(message.id)}
          />
        )}

        {/* Action Buttons */}
        {message.actionButtons && message.actionButtons.length > 0 && (
          <ActionButtonGroup
            buttons={message.actionButtons}
            messageId={message.id}
            onButtonExecuted={(buttonId) => onButtonExecuted?.(message.id, buttonId)}
            onError={(msg) => console.error('Button error:', msg)}
            onSendPrompt={onSuggestionClick}
          />
        )}

        {/* Suggested Next Actions */}
        {message.suggestedNextActions && message.suggestedNextActions.length > 0 && (
          <SuggestedActions
            suggestions={message.suggestedNextActions}
            onSelect={(prompt) => onSuggestionClick?.(prompt)}
          />
        )}

        {/* Suggestion chips (legacy) */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
            {message.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="bg-bg-card border border-border-card text-text-primary text-sm px-4 py-2 rounded-full hover:bg-bg-card-hover transition-colors whitespace-nowrap flex-shrink-0"
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
    </motion.div>
  )
}
