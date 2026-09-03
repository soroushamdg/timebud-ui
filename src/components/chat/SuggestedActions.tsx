'use client'

import { SuggestedAction } from '@/types/ai'

interface SuggestedActionsProps {
  suggestions: SuggestedAction[]
  onSelect: (prompt: string) => void
}

export function SuggestedActions({ suggestions, onSelect }: SuggestedActionsProps) {
  if (suggestions.length === 0) return null

  // Limit to 3 suggestions
  const displayedSuggestions = suggestions.slice(0, 3)

  return (
    <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
      {displayedSuggestions.map((suggestion, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(suggestion.prompt)}
          className="bg-bg-card border border-border-card text-text-primary text-sm px-4 py-2 rounded-full hover:border-accent-yellow transition-colors whitespace-nowrap flex-shrink-0"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  )
}
