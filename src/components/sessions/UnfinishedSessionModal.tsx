'use client'

interface UnfinishedSessionModalProps {
  session: any
  onContinue: () => void
  onStartFresh: () => void
}

export function UnfinishedSessionModal({ session, onContinue, onStartFresh }: UnfinishedSessionModalProps) {
  const formatStartTime = (startTime: string) => {
    const date = new Date(startTime)
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-bg-card border border-border-card rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-white text-xl font-bold mb-2">Unfinished session</h2>
        
        <p className="text-text-sec mb-6">
          Started at {formatStartTime(session.start_time)}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onStartFresh}
            className="flex-1 bg-bg-card border border-border-card text-white py-3 px-4 rounded-lg hover:bg-bg-card-hover transition-colors"
          >
            Start fresh
          </button>
          <button
            onClick={onContinue}
            className="flex-1 bg-accent-yellow text-black font-bold py-3 px-4 rounded-lg hover:bg-yellow-400 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
