'use client'

export function SkeletonMessage() {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] bg-bg-card px-4 py-3 rounded-2xl rounded-bl-md animate-pulse">
        <div className="space-y-2">
          <div className="h-4 bg-border-card rounded w-3/4" />
          <div className="h-4 bg-border-card rounded w-full" />
          <div className="h-4 bg-border-card rounded w-5/6" />
        </div>
      </div>
    </div>
  )
}
