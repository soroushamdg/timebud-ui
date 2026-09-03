'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { HomeIcon, CalendarDaysIcon, PlusIcon } from '@heroicons/react/24/outline'
import { QuickCaptureSheet } from '@/components/capture/QuickCaptureSheet'
import { SimpleToast } from '@/components/ui/SimpleToast'

export function TabBar() {
  const pathname = usePathname()
  const [showCapture, setShowCapture] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const tabs = [
    {
      icon: HomeIcon,
      label: 'Home',
      href: '/'
    },
    {
      icon: PlusIcon,
      label: 'Add',
      href: '#',
      isSpecial: true,
      onClick: () => setShowCapture(true)
    },
    {
      icon: CalendarDaysIcon,
      label: 'Logs',
      href: '/logs'
    },
  ]

  return (
    <>
      <div className="fixed bottom-5 left-0 right-0 bg-transparent h-20 z-50">
        <div className="flex justify-around items-center h-full max-w-md mx-auto px-4">
          {tabs.map(({ icon: Icon, label, href, isSpecial, onClick }) => {
            const isActive = pathname === href
            return (
              <div key={href}>
                {isSpecial ? (
                  <button
                    onClick={onClick}
                    className="relative flex items-center justify-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-accent-yellow flex items-center justify-center transition-all">
                      <Icon className="w-6 h-6 text-on-light-accent" />
                    </div>
                  </button>
                ) : (
                  <Link
                    href={href}
                    className="relative flex items-center justify-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-secondary-surface flex items-center justify-center transition-all">
                      <Icon
                        className={`w-6 h-6 transition-colors ${
                          isActive ? 'text-accent-yellow' : 'text-text-tertiary'
                        }`}
                      />
                    </div>
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {showCapture && (
        <QuickCaptureSheet
          onClose={() => setShowCapture(false)}
          onSuccess={(message) => setToastMessage(message)}
        />
      )}

      <SimpleToast
        isVisible={!!toastMessage}
        message={toastMessage ?? ''}
        type="success"
        onDismiss={() => setToastMessage(null)}
      />
    </>
  )
}
