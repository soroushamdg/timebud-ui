'use client'

import { useSyncExternalStore } from 'react'
import { Share, MoreVertical, Smartphone, X, PlusSquare } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useUIStore } from '@/stores/uiStore'

const DISMISS_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000 // re-offer after 14 days

function subscribeNever() {
  return () => {}
}

const IOS_STEPS = [
  { icon: Share, text: 'Tap the Share icon in Safari’s toolbar' },
  { icon: PlusSquare, text: 'Scroll down and tap "Add to Home Screen"' },
  { icon: Smartphone, text: 'Tap "Add" in the top-right corner' },
]

const ANDROID_STEPS = [
  { icon: MoreVertical, text: 'Tap the ⋮ menu in the top-right of Chrome' },
  { icon: PlusSquare, text: 'Tap "Add to Home screen" or "Install app"' },
  { icon: Smartphone, text: 'Tap "Install" to confirm' },
]

export function InstallPwaPrompt() {
  const { platform, isStandalone, canPromptNatively, promptInstall } = useInstallPrompt()
  const { installPromptDismissedAt, dismissInstallPrompt } = useUIStore()
  // Read "now" via useSyncExternalStore rather than directly in render — this is a
  // one-time-per-mount snapshot (nothing re-triggers it), just taken in a render-safe way.
  const now = useSyncExternalStore(subscribeNever, () => Date.now(), () => 0)

  const recentlyDismissed =
    installPromptDismissedAt !== null && now - installPromptDismissedAt < DISMISS_SNOOZE_MS

  if (!platform || isStandalone || recentlyDismissed) return null

  const steps = platform === 'ios' ? IOS_STEPS : ANDROID_STEPS

  const handleInstallClick = async () => {
    const accepted = await promptInstall()
    if (accepted) dismissInstallPrompt()
  }

  return (
    <div className="fixed bottom-28 left-4 right-4 max-w-md mx-auto z-40">
      <div className="bg-bg-card border border-border-card rounded-2xl p-4 shadow-lg">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-accent-yellow flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-on-light-accent" />
            </div>
            <div>
              <p className="text-text-primary font-semibold text-sm">Install TimeBud</p>
              <p className="text-text-sec text-xs">Faster, full-screen, works offline</p>
            </div>
          </div>
          <button
            onClick={dismissInstallPrompt}
            className="text-text-sec hover:text-text-primary transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {platform === 'android' && canPromptNatively ? (
          <button
            onClick={handleInstallClick}
            className="w-full bg-accent-yellow text-on-light-accent font-bold py-2.5 rounded-xl hover:bg-accent-yellow-hover transition-colors"
          >
            Install app
          </button>
        ) : (
          <ol className="space-y-2">
            {steps.map((step, index) => (
              <li key={index} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-secondary-surface flex items-center justify-center text-text-sec text-xs font-semibold flex-shrink-0">
                  {index + 1}
                </div>
                <step.icon className="w-4 h-4 text-accent-yellow flex-shrink-0" />
                <span className="text-text-primary text-sm">{step.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
