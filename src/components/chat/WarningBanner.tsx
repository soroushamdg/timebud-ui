'use client'

import { Warning } from '@/types/ai'
import { AlertTriangle, Info } from 'lucide-react'

interface WarningBannerProps {
  warnings: Warning[]
}

export function WarningBanner({ warnings }: WarningBannerProps) {
  if (warnings.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {warnings.map((warning, idx) => {
        const severityColors = {
          low: 'bg-gray-500/10 border-gray-500/30 text-gray-300',
          medium: 'bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow',
          high: 'bg-accent-pink/10 border-accent-pink/30 text-accent-pink',
        }

        const Icon = warning.severity === 'low' ? Info : AlertTriangle

        return (
          <div
            key={idx}
            className={`flex items-start gap-2 p-3 rounded-lg border ${severityColors[warning.severity]}`}
          >
            <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{warning.message}</span>
          </div>
        )
      })}
    </div>
  )
}
