'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Brain, Eye, EyeOff, Check } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useCurrentUser } from '@/hooks/useAuth'
import { useFocusSessions } from '@/hooks/useSessions'
import { getDiceBearUrl } from '@/lib/avatar'
import { ChangeSessionTimeDialog } from '@/components/dialogs/ChangeSessionTimeDialog'
import { PartialTasksDialog } from '@/components/dialogs/PartialTasksDialog'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useFocusSessionGuard } from '@/hooks/useSessionGuard'
import { useAISettings, useUpsertAISettings } from '@/hooks/useAISettings'
import { SUPPORTED_MODELS } from '@/lib/ai/config'
import { AIProvider } from '@/types/database'

export default function ProfilePage() {
  const router = useRouter()
  const { data: user } = useCurrentUser()
  const { data: focusSessions = [] } = useFocusSessions()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPartialDialogOpen, setIsPartialDialogOpen] = useState(false)

  // AI Settings
  const { data: aiSettings } = useAISettings()
  const upsertSettings = useUpsertAISettings()
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(aiSettings?.provider || 'anthropic')
  const [selectedModel, setSelectedModel] = useState(aiSettings?.model || 'claude-sonnet-4-20250514')
  const [apiKey, setApiKey] = useState(aiSettings?.api_key || '')
  const [thinkingMode, setThinkingMode] = useState(aiSettings?.thinking_mode || false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  // Focus session guard - auto-redirect to running focus session
  useFocusSessionGuard();

  // Query for completed tasks
  const { data: completedTasks = [] } = useQuery({
    queryKey: ['tasks', 'completed'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
      if (error) throw error
      return data
    },
  })

  // Calculate stats
  const totalSessions = focusSessions.length
  const totalMinutes = focusSessions
    .filter(session => session.end_time && session.start_time)
    .reduce((sum, session) => {
      const minutes = Math.round((new Date(session.end_time!).getTime() - new Date(session.start_time!).getTime()) / 60000)
      return sum + minutes
    }, 0)
  const tasksDone = completedTasks.length

  // Format time display
  const formatTimeDisplay = (minutes: number) => {
    if (minutes > 59) {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
    }
    return `${minutes}m`
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleBack = () => {
    router.back()
  }

  const handleSaveAISettings = async () => {
    try {
      await upsertSettings.mutateAsync({
        provider: selectedProvider,
        model: selectedModel,
        api_key: apiKey,
        thinking_mode: thinkingMode,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save AI settings:', error)
    }
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'ping' }],
          complexity: 'simple',
        }),
      })

      const data = await response.json()
      setTestResult(data.success ? 'success' : 'error')
    } catch (error) {
      setTestResult('error')
    } finally {
      setTestingConnection(false)
      setTimeout(() => setTestResult(null), 3000)
    }
  }

  const availableModels = SUPPORTED_MODELS.filter(m => m.provider === selectedProvider)
  const selectedModelConfig = SUPPORTED_MODELS.find(m => m.id === selectedModel)

  return (
    <AppShell showTabBar={false}>
      <div className="min-h-screen bg-bg-primary">
        {/* Header with back button */}
        <div className="flex items-center p-4">
          <button 
            onClick={handleBack}
            className="w-10 h-10 rounded-xl bg-bg-card border border-border-card flex items-center justify-center text-white hover:bg-opacity-80 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Profile section */}
        <div className="flex flex-col items-center px-6">
          {/* Profile Header */}
          <div className="flex items-center gap-4 mb-8">
            <img
              src={getDiceBearUrl(user?.id || 'default', (user as any)?.avatar_color || undefined)}
              alt="Profile"
              className="w-20 h-20 rounded-none border-4 border-black"
            />
            <div>
              <h1 className="text-white text-2xl font-bold">{(user as any)?.full_name || 'User'}</h1>
              <p className="text-text-sec">{user?.email || 'user@example.com'}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-3 w-full mb-8">
            <div className="flex-1 bg-bg-card rounded-none p-3 text-center">
              <div className="text-white font-bold text-lg">{totalSessions}</div>
              <div className="text-text-sec text-xs">Sessions</div>
            </div>
            <div className="flex-1 bg-bg-card rounded-none p-3 text-center">
              <div className="text-white font-bold text-lg">{formatTimeDisplay(totalMinutes)}</div>
              <div className="text-text-sec text-xs">Time</div>
            </div>
            <div className="flex-1 bg-bg-card rounded-none p-3 text-center">
              <div className="text-white font-bold text-lg">{tasksDone}</div>
              <div className="text-text-sec text-xs">Tasks</div>
            </div>
          </div>

          {/* Settings section */}
          <div className="w-full">
            <h2 className="text-lg font-bold text-white mb-4 px-4">Settings</h2>
            
            {/* Settings list */}
            <div className="px-4">
              <button
                onClick={() => setIsDialogOpen(true)}
                className="w-full bg-bg-card rounded-none px-4 py-4 mb-2 flex justify-between items-center hover:bg-bg-card/80 transition-colors"
              >
                <span className="text-white">Default duration</span>
                <ChevronRight className="w-5 h-5 text-text-sec" />
              </button>
              
              <button
                onClick={() => setIsPartialDialogOpen(true)}
                className="w-full bg-bg-card rounded-none px-4 py-4 mb-2 flex justify-between items-center hover:bg-bg-card/80 transition-colors"
              >
                <span className="text-white">Partial tasks</span>
                <ChevronRight className="w-5 h-5 text-text-sec" />
              </button>
              
              <button
                className="w-full bg-bg-card rounded-none px-4 py-4 mb-2 flex justify-between items-center hover:bg-bg-card/80 transition-colors"
                disabled
              >
                <span className="text-white">Notifications</span>
                <ChevronRight className="w-5 h-5 text-text-sec" />
              </button>
              
              <button
                className="w-full bg-bg-card rounded-none px-4 py-4 mb-2 flex justify-between items-center hover:bg-bg-card/80 transition-colors"
                disabled
              >
                <span className="text-white">About</span>
                <ChevronRight className="w-5 h-5 text-text-sec" />
              </button>
            </div>
          </div>

          {/* AI Settings section */}
          <div className="w-full mt-8">
            <h2 className="text-lg font-bold text-white mb-4 px-4">AI Settings</h2>
            
            <div className="px-4 space-y-4">
              {/* Provider selector */}
              <div>
                <label className="text-sm text-text-sec mb-2 block">AI Provider</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['anthropic', 'openai', 'google'] as AIProvider[]).map(provider => (
                    <button
                      key={provider}
                      onClick={() => {
                        setSelectedProvider(provider)
                        const firstModel = SUPPORTED_MODELS.find(m => m.provider === provider)
                        if (firstModel) setSelectedModel(firstModel.id)
                      }}
                      className={`bg-bg-card border-2 ${
                        selectedProvider === provider ? 'border-accent-yellow' : 'border-border-card'
                      } rounded-lg p-3 text-center hover:bg-bg-card-hover transition-colors`}
                    >
                      <p className="text-white font-medium text-sm capitalize">{provider}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Model selector */}
              <div>
                <label className="text-sm text-text-sec mb-2 block">Model</label>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {availableModels.map(model => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`${
                        selectedModel === model.id
                          ? 'bg-accent-yellow text-black'
                          : 'bg-bg-card text-white border border-border-card'
                      } px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 hover:opacity-90 transition-opacity flex items-center gap-2`}
                    >
                      {model.supportsThinking && <Brain className="w-4 h-4" />}
                      {model.displayName}
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key input */}
              <div>
                <label className="text-sm text-text-sec mb-2 block">API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="w-full bg-bg-card border border-border-card rounded-lg px-4 py-3 text-white placeholder-text-sec focus:outline-none focus:ring-2 focus:ring-accent-yellow pr-12"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-sec hover:text-white transition-colors"
                  >
                    {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-text-sec mt-1">Stored securely server-side only</p>
              </div>

              {/* Thinking mode toggle */}
              {selectedModelConfig?.supportsThinking && (
                <div className="flex items-center justify-between bg-bg-card border border-border-card rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-accent-yellow" />
                    <div>
                      <p className="text-white font-medium">Thinking Mode</p>
                      <p className="text-xs text-text-sec">Extended reasoning for complex tasks</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setThinkingMode(!thinkingMode)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      thinkingMode ? 'bg-accent-yellow' : 'bg-border-card'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        thinkingMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveAISettings}
                  disabled={!apiKey || upsertSettings.isPending}
                  className="flex-1 bg-accent-yellow text-black font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-5 h-5" />
                      Saved
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={!apiKey || testingConnection}
                  className="flex-1 bg-transparent border border-border-card text-white font-semibold py-3 rounded-lg hover:bg-bg-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingConnection ? 'Testing...' : testResult === 'success' ? '✓ Connected' : testResult === 'error' ? '✗ Failed' : 'Test Connection'}
                </button>
              </div>
            </div>
          </div>

          {/* Sign out button */}
          <div className="w-full px-4 mt-8">
            <button
              onClick={handleSignOut}
              className="w-full bg-accent-pink text-white font-bold py-3 rounded-none hover:bg-accent-pink/90 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Change Session Time Dialog */}
      <ChangeSessionTimeDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
      
      {/* Partial Tasks Dialog */}
      <PartialTasksDialog 
        isOpen={isPartialDialogOpen}
        onClose={() => setIsPartialDialogOpen(false)}
      />
    </AppShell>
  )
}
