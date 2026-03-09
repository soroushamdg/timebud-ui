import { AppShell } from '@/components/layout/AppShell'
import { MessageCircle } from 'lucide-react'

export default function ChatPage() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <MessageCircle size={64} className="text-text-sec" />
        <h1 className="text-xl font-bold text-white mt-4">AI assistant</h1>
        <p className="text-text-sec text-sm text-center mt-2">Coming soon</p>
      </div>
    </AppShell>
  )
}
