'use client'

import { AppShell } from '@/components/layout/AppShell'

export default function LogsPage() {
  return (
    <AppShell>
      <div className="flex-1 flex flex-col bg-black">
        {/* Header */}
        <div className="bg-[#1A1A1A] border-b border-[#333333] px-4 py-3">
          <h1 className="text-white text-lg font-semibold">Logs</h1>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#2A2A2A] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">Activity Logs</h2>
            <p className="text-[#666666] text-center max-w-md">
              Your session history and activity logs will appear here. Track your productivity and monitor your progress over time.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
