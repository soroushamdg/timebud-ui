'use client'

interface TypingIndicatorProps {
  message?: string
}

export function TypingIndicator({ message = 'AI is thinking...' }: TypingIndicatorProps) {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-bg-card text-white px-4 py-3 rounded-2xl rounded-bl-md">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-text-sec rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-text-sec rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-text-sec rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          {message && (
            <span className="text-sm text-text-sec ml-2">{message}</span>
          )}
        </div>
      </div>
    </div>
  )
}
