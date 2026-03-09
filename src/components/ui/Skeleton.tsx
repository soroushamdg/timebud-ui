import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-bg-card', className)} />
}

export function TaskCardSkeleton() {
  return (
    <div className='flex items-center gap-3 p-4 bg-bg-card rounded-2xl border border-border-card'>
      <Skeleton className='w-10 h-10 rounded-full flex-shrink-0' />
      <div className='flex-1 space-y-2'>
        <Skeleton className='h-4 w-3/4 rounded-lg' />
        <Skeleton className='h-3 w-1/2 rounded-lg' />
      </div>
      <Skeleton className='w-6 h-6 rounded-full' />
    </div>
  )
}

export function ProjectCardSkeleton() {
  return (
    <div className='rounded-2xl overflow-hidden'>
      <Skeleton className='w-full aspect-square' />
      <Skeleton className='h-4 w-2/3 mt-2 mx-auto rounded-lg' />
      <Skeleton className='h-3 w-1/2 mt-1 mx-auto rounded-lg' />
    </div>
  )
}
