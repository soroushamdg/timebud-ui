export function TaskCardSkeleton() {
  return (
    <div className="bg-bg-card rounded-2xl px-4 py-3 flex items-center gap-3 border border-border-card">
      {/* Avatar skeleton */}
      <div className="w-10 h-10 rounded-xl bg-gray-700 animate-pulse flex-shrink-0" />
      
      {/* Content skeleton */}
      <div className="flex-1 min-w-0">
        <div className="h-5 bg-gray-700 rounded animate-pulse mb-2 w-3/4" />
        <div className="h-4 bg-gray-700 rounded animate-pulse w-1/2" />
      </div>
      
      {/* Checkmark skeleton */}
      <div className="w-6 h-6 rounded-full border-2 border-gray-600 flex-shrink-0" />
    </div>
  )
}
