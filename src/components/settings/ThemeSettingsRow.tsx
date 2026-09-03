'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { ThemePreference } from '@/types/database'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Moon }[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
]

export function ThemeSettingsRow() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="w-full bg-bg-card rounded-none px-4 py-4 mb-2">
      <span className="text-text-primary block mb-3">Appearance</span>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={`flex flex-col items-center gap-1.5 py-2.5 rounded-lg border-2 transition-colors ${
              theme === value ? 'border-accent-yellow bg-accent-yellow/10' : 'border-border-card hover:bg-bg-card-hover'
            }`}
          >
            <Icon className={`w-4 h-4 ${theme === value ? 'text-accent-yellow' : 'text-text-sec'}`} />
            <span className={`text-xs font-medium ${theme === value ? 'text-accent-yellow' : 'text-text-sec'}`}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
